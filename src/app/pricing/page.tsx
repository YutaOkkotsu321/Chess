import type { Metadata } from "next";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isStripeConfigured } from "@/lib/stripe/server";
import { openBillingPortal, startCheckout } from "@/lib/stripe/actions";

export const metadata: Metadata = {
  title: "Pricing",
  description: "ChessTech Free and Pro plans.",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  canceled?: string;
  upgraded?: string;
  error?: string;
}>;

export default async function PricingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  let isPro = false;
  let signedIn = false;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = !!user;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_pro")
        .eq("id", user.id)
        .maybeSingle();
      isPro = profile?.is_pro ?? false;
    }
  }

  const stripeReady = isStripeConfigured();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <header className="mx-auto mb-10 max-w-2xl text-center">
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles size={12} className="text-amber-500" />
          Pricing
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          Simple pricing for serious practice
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Start free. Upgrade when you want unlimited deep analysis on every
          game you play.
        </p>
      </header>

      {sp.canceled && (
        <Banner tone="muted">
          Checkout canceled — you have not been charged.
        </Banner>
      )}
      {sp.upgraded && (
        <Banner tone="success">
          Welcome to ChessTech Pro! Your account is being upgraded — refresh in
          a few seconds if the badge doesn&apos;t show yet.
        </Banner>
      )}
      {sp.error && <Banner tone="error">{errorCopy(sp.error)}</Banner>}

      <div className="grid gap-6 md:grid-cols-2">
        <PlanCard
          name="Free"
          price="$0"
          cadence="forever"
          highlight={!isPro}
          features={[
            "Unlimited games vs Stockfish",
            "Pick your color and engine level",
            "Full game history saved",
            "Up to 5 game reviews per day",
          ]}
          cta={
            <Button asChild variant="outline" className="w-full">
              <Link href={signedIn ? "/play" : "/auth/sign-up"}>
                {signedIn ? "Keep playing" : "Get started"}
              </Link>
            </Button>
          }
        />

        <PlanCard
          name="Pro"
          price="$2"
          cadence="per month"
          accent
          highlight={isPro}
          features={[
            "Everything in Free",
            "Unlimited game reviews",
            "Engine evaluation on every position",
            "Best-move arrows + automatic mistake detection",
            "Cancel anytime from the billing portal",
          ]}
          cta={
            isPro ? (
              <form action={openBillingPortal}>
                <Button type="submit" className="w-full">
                  Manage subscription
                </Button>
              </form>
            ) : !signedIn ? (
              <Button asChild className="w-full">
                <Link href="/auth/sign-in?next=/pricing">
                  Sign in to upgrade
                </Link>
              </Button>
            ) : !stripeReady ? (
              <Button className="w-full" disabled>
                Checkout unavailable
              </Button>
            ) : (
              <form action={startCheckout}>
                <Button type="submit" className="w-full">
                  Upgrade to Pro
                </Button>
              </form>
            )
          }
        />
      </div>

      <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-muted-foreground">
        Secure payments by{" "}
        <a
          href="https://stripe.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:underline"
        >
          Stripe
        </a>
        . Reviews reset at 00:00 UTC for free users. Cancel anytime — your Pro
        access stays active until the end of the current billing period.
      </p>
    </div>
  );
}

function PlanCard({
  name,
  price,
  cadence,
  features,
  cta,
  accent,
  highlight,
}: {
  name: string;
  price: string;
  cadence: string;
  features: string[];
  cta: React.ReactNode;
  accent?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "relative flex flex-col rounded-2xl border bg-card p-6 sm:p-8 " +
        (accent
          ? "border-primary/40 shadow-lg shadow-primary/10"
          : "border-border")
      }
    >
      {highlight && (
        <span className="absolute -top-3 right-6 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-950 shadow">
          Current plan
        </span>
      )}
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold tracking-tight">{name}</h2>
        {accent && (
          <Sparkles size={14} className="text-amber-500" aria-hidden />
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-4xl font-bold tracking-tight tabular-nums">
          {price}
        </span>
        <span className="text-sm text-muted-foreground">{cadence}</span>
      </div>
      <ul className="mt-6 space-y-2.5 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check
              size={16}
              className={
                "mt-0.5 shrink-0 " +
                (accent ? "text-primary" : "text-muted-foreground")
              }
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-7">{cta}</div>
    </div>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "success" | "error" | "muted";
  children: React.ReactNode;
}) {
  const cls =
    tone === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "error"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-border bg-muted text-muted-foreground";
  return (
    <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${cls}`}>
      {children}
    </div>
  );
}

function errorCopy(code: string): string {
  switch (code) {
    case "stripe_not_configured":
      return "Payments aren't configured on this deployment yet. Set STRIPE_SECRET_KEY, STRIPE_PRICE_ID and NEXT_PUBLIC_SITE_URL to enable checkout.";
    case "no_subscription":
      return "We couldn't find an active subscription on your account.";
    case "checkout_failed":
      return "Stripe didn't return a checkout URL. Please try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}
