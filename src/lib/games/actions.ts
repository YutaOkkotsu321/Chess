"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { GameResult, PlayerColor } from "@/lib/supabase/types";

export type SaveGameInput = {
  pgn: string;
  result: GameResult;
  playerColor: PlayerColor;
  difficulty: number;
  outcomeReason: string;
  totalMoves: number;
};

export type SaveGameResponse =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Persists a finished game to Supabase. Silently no-ops if the user isn't
 * logged in (we don't want to throw on the happy path of a guest finishing
 * a game).
 */
export async function saveGame(
  input: SaveGameInput
): Promise<SaveGameResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "not-authenticated" };
  }

  const { data, error } = await supabase
    .from("games")
    .insert({
      user_id: user.id,
      pgn: input.pgn,
      result: input.result,
      player_color: input.playerColor,
      difficulty: input.difficulty,
      outcome_reason: input.outcomeReason,
      total_moves: input.totalMoves,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/profile");
  return { ok: true, id: data.id };
}
