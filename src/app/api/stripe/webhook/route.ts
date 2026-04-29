import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { createSupabaseAdmin, getStripe } from "@/lib/stripe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook receiver. Stripe signs the request body with the secret
 * configured in the dashboard; we verify it with `constructEvent` against
 * the *raw* body (req.text()) — never JSON.parse the body, the bytes must
 * match exactly or signature verification will fail.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new NextResponse("Webhook secret not configured", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new NextResponse("Missing stripe-signature header", { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      secret
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return new NextResponse(`Webhook signature verification failed: ${message}`, {
      status: 400,
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await onCheckoutCompleted(session);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await onSubscriptionUpserted(sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await onSubscriptionDeleted(sub);
        break;
      }
      default:
        // Ignore other events; Stripe sends a lot we don't care about.
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook]", event.type, err);
    return new NextResponse("Webhook handler error", { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId =
    session.client_reference_id ??
    (session.metadata?.user_id as string | undefined);
  if (!userId) {
    console.warn("[stripe-webhook] checkout.session.completed without user_id");
    return;
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({
      stripe_customer_id: customerId ?? null,
      stripe_subscription_id: subscriptionId ?? null,
      is_pro: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}

async function onSubscriptionUpserted(sub: Stripe.Subscription) {
  const userId = await resolveUserId(sub);
  if (!userId) return;

  const isActive = sub.status === "active" || sub.status === "trialing";
  const periodEndUnix = (sub as unknown as { current_period_end?: number })
    .current_period_end;

  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({
      stripe_customer_id:
        typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      stripe_current_period_end:
        typeof periodEndUnix === "number"
          ? new Date(periodEndUnix * 1000).toISOString()
          : null,
      is_pro: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}

async function onSubscriptionDeleted(sub: Stripe.Subscription) {
  const userId = await resolveUserId(sub);
  if (!userId) return;

  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({
      is_pro: false,
      stripe_subscription_id: null,
      stripe_current_period_end: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}

async function resolveUserId(sub: Stripe.Subscription): Promise<string | null> {
  const fromMetadata = sub.metadata?.user_id;
  if (fromMetadata) return fromMetadata;

  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.id ?? null;
}
