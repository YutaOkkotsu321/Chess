import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Lock, Sparkles } from "lucide-react";

import { GameReview } from "@/components/chess/game-review";
import { Button } from "@/components/ui/button";
import { getGameById, getProfile } from "@/lib/games/queries";
import { checkAndRecordReview } from "@/lib/reviews/usage";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Review",
};

export const dynamic = "force-dynamic";

export default async function GameReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) {
    redirect("/profile");
  }

  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/sign-in?next=/profile/games/${id}`);

  const [game, profile] = await Promise.all([
    getGameById(id, user.id),
    getProfile(user.id),
  ]);
  if (!game) notFound();

  const quota = await checkAndRecordReview({
    userId: user.id,
    gameId: game.id,
    isPro: profile?.is_pro ?? false,
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/profile" className="inline-flex items-center gap-1">
            <ChevronLeft size={16} />
            Back to profile
          </Link>
        </Button>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
          {!quota.allowed || quota.limit != null ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
              {quota.usedToday}/{quota.limit ?? "∞"} reviews today
            </span>
          ) : null}
          <span>{new Date(game.played_at).toLocaleString()}</span>
        </div>
      </header>

      {quota.allowed ? (
        <GameReview
          pgn={game.pgn}
          playerColor={game.player_color}
          difficulty={game.difficulty}
          result={game.result}
          outcomeReason={game.outcome_reason}
        />
      ) : (
        <ReviewPaywall used={quota.usedToday} limit={quota.limit} />
      )}
    </div>
  );
}

function ReviewPaywall({ used, limit }: { used: number; limit: number }) {
  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-muted">
        <Lock size={20} className="text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">
        Daily review limit reached
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        You&apos;ve used {used} of {limit} free reviews today. Reviews reset at
        00:00 UTC, or upgrade to Pro for unlimited analysis.
      </p>

      <div className="mt-6 rounded-xl border border-border bg-background p-5 text-left">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-amber-500" />
          <span className="text-sm font-semibold">ChessTech Pro</span>
          <span className="ml-auto text-sm font-medium tabular-nums">
            $2 / month
          </span>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <li>· Unlimited game reviews</li>
          <li>· Engine evaluation and best-move suggestions on every position</li>
          <li>· Automatic mistake detection</li>
        </ul>
        <Button asChild className="mt-5 w-full">
          <Link href="/pricing">Upgrade to Pro</Link>
        </Button>
      </div>

      <Button variant="outline" size="sm" className="mt-6" asChild>
        <Link href="/profile">Back to profile</Link>
      </Button>
    </section>
  );
}
