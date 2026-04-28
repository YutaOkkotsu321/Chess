import type { GameStatus } from "@/hooks/use-chess-game";
import type { GameResult, PlayerColor } from "@/lib/supabase/types";

/**
 * Translate a finished `useChessGame` status into a persisted result row.
 * Returns `null` if the game isn't actually over.
 */
export function deriveGameOutcome(
  status: GameStatus,
  playerColor: PlayerColor
): { result: GameResult; reason: string } | null {
  if (!status.isGameOver) return null;

  if (status.isCheckmate) {
    const playerWon =
      (status.winner === "white" && playerColor === "white") ||
      (status.winner === "black" && playerColor === "black");
    return {
      result: playerWon ? "win" : "loss",
      reason: "checkmate",
    };
  }

  if (status.isStalemate) {
    return { result: "draw", reason: "stalemate" };
  }

  if (status.isDraw) {
    return {
      result: "draw",
      reason:
        status.drawReason === "repetition"
          ? "threefold-repetition"
          : status.drawReason === "fifty-moves"
            ? "fifty-move-rule"
            : status.drawReason === "insufficient-material"
              ? "insufficient-material"
              : "draw",
    };
  }

  return null;
}
