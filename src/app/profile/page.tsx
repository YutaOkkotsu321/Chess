import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/auth/sign-out-button";
import {
  getGameStats,
  getProfile,
  getRecentGames,
} from "@/lib/games/queries";
import {
  FREE_DAILY_REVIEW_LIMIT,
  getReviewsUsedToday,
} from "@/lib/reviews/usage";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Profile",
};

// Profile is per-user — never prerender.
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  if (!isSupabaseConfigured()) {
    return <NotConfigured />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=/profile");

  const [profile, stats, recent, reviewsUsedToday] = await Promise.all([
    getProfile(user.id),
    getGameStats(user.id),
    getRecentGames(user.id, 10),
    getReviewsUsedToday(user.id),
  ]);

  const isPro = profile?.is_pro ?? false;
  const reviewsRemaining = isPro
    ? null
    : Math.max(0, FREE_DAILY_REVIEW_LIMIT - reviewsUsedToday);

  const displayName =
    profile?.display_name || user.email?.split("@")[0] || "Player";
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              className="h-14 w-14 rounded-full ring-2 ring-border object-cover"
            />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-primary/80 to-primary/40 text-xl font-semibold text-primary-foreground ring-2 ring-border">
              {avatarLetter}
            </div>
          )}
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {displayName}
              {profile?.is_pro && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400/20 to-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-500 ring-1 ring-amber-500/30">
                  <Sparkles size={10} />
                  Pro
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <SignOutButton />
      </header>

      <section className="mb-8 grid gap-3 sm:grid-cols-4">
        <StatCard label="Games" value={stats.total} />
        <StatCard label="Wins" value={stats.wins} tone="good" />
        <StatCard label="Losses" value={stats.losses} tone="bad" />
        <StatCard label="Draws" value={stats.draws} tone="warn" />
      </section>

      {stats.total > 0 && (
        <section className="mb-8 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-primary" />
            <h2 className="text-sm font-semibold tracking-tight">Win rate</h2>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all"
              style={{ width: `${stats.winRate}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{stats.winRate}% won</span>
            <span>
              {stats.wins} W · {stats.losses} L · {stats.draws} D
            </span>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent games
          </h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <ReviewQuotaBadge
              isPro={isPro}
              used={reviewsUsedToday}
              remaining={reviewsRemaining}
            />
            <span>
              {recent.length} of {stats.total}
            </span>
          </div>
        </header>
        {recent.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No games yet. Play a game to see it here.
            </p>
            <Button asChild size="sm">
              <Link href="/play">Start playing</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {recent.map((g) => (
              <li
                key={g.id}
                className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-5 py-3 sm:gap-4"
              >
                <ResultBadge result={g.result} />
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    vs Stockfish · Lvl {g.difficulty}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {g.player_color === "white" ? "Played White" : "Played Black"}
                    {" · "}
                    {g.total_moves} plies
                    {g.outcome_reason ? ` · ${g.outcome_reason}` : ""}
                  </div>
                </div>
                <time
                  className="text-xs tabular-nums text-muted-foreground"
                  dateTime={g.played_at}
                  title={g.played_at}
                >
                  {formatRelative(g.played_at)}
                </time>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/profile/games/${g.id}`}>Review</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ReviewQuotaBadge({
  isPro,
  used,
  remaining,
}: {
  isPro: boolean;
  used: number;
  remaining: number | null;
}) {
  if (isPro) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-600 ring-1 ring-amber-500/30 dark:text-amber-300">
        Reviews · ∞
      </span>
    );
  }
  const exhausted = remaining === 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ${
        exhausted
          ? "bg-destructive/10 text-destructive ring-destructive/20"
          : "bg-muted text-muted-foreground ring-border"
      }`}
      title={
        exhausted
          ? "Free quota used up. Resets at 00:00 UTC, or upgrade to Pro."
          : `${used} of ${used + (remaining ?? 0)} reviews used today`
      }
    >
      Reviews · {used}/{used + (remaining ?? 0)} today
    </span>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "good" | "bad" | "warn";
}) {
  const toneClass =
    tone === "good"
      ? "text-primary"
      : tone === "bad"
        ? "text-destructive"
        : tone === "warn"
          ? "text-amber-500"
          : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1.5 text-3xl font-bold tabular-nums ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}

function ResultBadge({ result }: { result: "win" | "loss" | "draw" }) {
  const map = {
    win: {
      label: "W",
      className: "bg-primary/15 text-primary ring-primary/30",
    },
    loss: {
      label: "L",
      className: "bg-destructive/15 text-destructive ring-destructive/30",
    },
    draw: {
      label: "D",
      className: "bg-amber-500/15 text-amber-500 ring-amber-500/30",
    },
  };
  const cfg = map[result];
  return (
    <span
      className={`inline-grid h-7 w-7 place-items-center rounded-md text-xs font-semibold ring-1 ${cfg.className}`}
      aria-label={result}
    >
      {cfg.label}
    </span>
  );
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diffSec = Math.floor((now - t) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 7 * 86400) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function NotConfigured() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="mb-2 text-2xl font-bold tracking-tight">
        Auth not configured
      </h1>
      <p className="text-sm text-muted-foreground">
        Set <code className="font-mono text-foreground">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
        and{" "}
        <code className="font-mono text-foreground">
          NEXT_PUBLIC_SUPABASE_ANON_KEY
        </code>{" "}
        in <code className="font-mono text-foreground">.env.local</code> (see{" "}
        <code className="font-mono text-foreground">.env.example</code>) and run
        the SQL in{" "}
        <code className="font-mono text-foreground">
          supabase/migrations/0001_init.sql
        </code>{" "}
        in the Supabase dashboard.
      </p>
    </div>
  );
}
