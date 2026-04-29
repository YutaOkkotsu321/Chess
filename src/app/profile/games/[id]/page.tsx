import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { GameReview } from "@/components/chess/game-review";
import { Button } from "@/components/ui/button";
import { getGameById } from "@/lib/games/queries";
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

  const game = await getGameById(id, user.id);
  if (!game) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/profile" className="inline-flex items-center gap-1">
            <ChevronLeft size={16} />
            Back to profile
          </Link>
        </Button>
        <div className="ml-auto text-xs text-muted-foreground tabular-nums">
          {new Date(game.played_at).toLocaleString()}
        </div>
      </header>

      <GameReview
        pgn={game.pgn}
        playerColor={game.player_color}
        difficulty={game.difficulty}
        result={game.result}
        outcomeReason={game.outcome_reason}
      />
    </div>
  );
}
