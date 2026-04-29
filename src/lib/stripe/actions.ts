"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  getSiteUrl,
  getStripe,
  getStripePriceId,
  isStripeConfigured,
} from "@/lib/stripe/server";

/**
 * Starts a Stripe Checkout session for the Pro subscription and redirects
 * the user to Stripe-hosted checkout. Idempotent on the customer side: we
 * reuse `stripe_customer_id` from the profile when one already exists.
 */
export async function startCheckout(): Promise<void> {
  if (!isStripeConfigured()) {
    redirect("/pricing?error=stripe_not_configured");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=/pricing");

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, is_pro")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.is_pro) {
    redirect("/profile?already_pro=1");
  }

  const stripe = getStripe();
  const siteUrl = getSiteUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: getStripePriceId(), quantity: 1 }],
    success_url: `${siteUrl}/profile?upgraded=1`,
    cancel_url: `${siteUrl}/pricing?canceled=1`,
    client_reference_id: user.id,
    customer: profile?.stripe_customer_id ?? undefined,
    customer_email: profile?.stripe_customer_id ? undefined : user.email,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { user_id: user.id },
    },
    metadata: { user_id: user.id },
  });

  if (!session.url) {
    redirect("/pricing?error=checkout_failed");
  }
  redirect(session.url);
}

/**
 * Opens the Stripe-hosted Billing Portal so a Pro user can update payment
 * details or cancel. Requires a stripe_customer_id, which is written by the
 * webhook on first checkout.
 */
export async function openBillingPortal(): Promise<void> {
  if (!isStripeConfigured()) {
    redirect("/pricing?error=stripe_not_configured");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=/pricing");

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.stripe_customer_id) {
    redirect("/pricing?error=no_subscription");
  }

  const stripe = getStripe();
  const siteUrl = getSiteUrl();

  const portal = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${siteUrl}/profile`,
  });

  redirect(portal.url);
}
