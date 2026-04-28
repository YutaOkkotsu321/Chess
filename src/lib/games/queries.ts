import { createClient } from "@/lib/supabase/server";
import type { Game, GameResult, Profile } from "@/lib/supabase/types";

export type GameStats = {
  total: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return data as Profile | null;
}

export async function getRecentGames(
  userId: string,
  limit = 10
): Promise<Game[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select("*")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .limit(limit);
  return (data as Game[] | null) ?? [];
}

export async function getGameStats(userId: string): Promise<GameStats> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select("result")
    .eq("user_id", userId);

  const rows = (data as { result: GameResult }[] | null) ?? [];
  const total = rows.length;
  const wins = rows.filter((r) => r.result === "win").length;
  const losses = rows.filter((r) => r.result === "loss").length;
  const draws = rows.filter((r) => r.result === "draw").length;
  const decided = wins + losses;
  const winRate = decided === 0 ? 0 : Math.round((wins / decided) * 100);

  return { total, wins, losses, draws, winRate };
}
