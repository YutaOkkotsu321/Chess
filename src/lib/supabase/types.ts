/**
 * Hand-written DB types. If the schema grows, regenerate via:
 *   npx supabase gen types typescript --project-id <ref> --schema public
 */

export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_pro: boolean;
  created_at: string;
  updated_at: string;
};

export type GameResult = "win" | "loss" | "draw";
export type PlayerColor = "white" | "black";

export type Game = {
  id: string;
  user_id: string;
  pgn: string;
  result: GameResult;
  player_color: PlayerColor;
  difficulty: number;
  outcome_reason: string | null;
  total_moves: number;
  played_at: string;
};
