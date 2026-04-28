"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import type { Square } from "chess.js";

import type { ChessGameApi } from "@/hooks/use-chess-game";

const Chessboard = dynamic(
  () => import("react-chessboard").then((m) => ({ default: m.Chessboard })),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-square w-full animate-pulse rounded-xl bg-muted/60" />
    ),
  }
);

type Props = {
  game: ChessGameApi;
  orientation?: "white" | "black";
  disabled?: boolean;
};

export function ChessBoard({
  game,
  orientation = "white",
  disabled = false,
}: Props) {
  const { resolvedTheme } = useTheme();
  const [selected, setSelected] = React.useState<Square | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  const palette = React.useMemo(
    () =>
      isDark
        ? {
            light: "#2a2d36",
            dark: "#181a21",
            border: "rgba(255,255,255,0.06)",
            shadow: "0 30px 60px -20px rgba(0,0,0,0.5)",
          }
        : {
            light: "#eef2f7",
            dark: "#7c8aa1",
            border: "rgba(0,0,0,0.06)",
            shadow: "0 30px 60px -25px rgba(15,23,42,0.25)",
          },
    [isDark]
  );

  const squareStyles = React.useMemo<Record<string, React.CSSProperties>>(() => {
    const styles: Record<string, React.CSSProperties> = {};

    // Last move highlight
    const last = game.verboseHistory.at(-1);
    if (last) {
      const lastBg = "rgba(34, 197, 94, 0.18)";
      styles[last.from] = { background: lastBg };
      styles[last.to] = { background: lastBg };
    }

    // Selected square + legal move dots
    if (selected) {
      styles[selected] = {
        background: "rgba(34, 197, 94, 0.32)",
        boxShadow: "inset 0 0 0 2px rgba(34, 197, 94, 0.65)",
      };
      for (const m of game.legalMovesFrom(selected)) {
        const isCapture = !!m.captured;
        styles[m.to] = {
          ...(styles[m.to] ?? {}),
          background: isCapture
            ? "radial-gradient(circle, transparent 58%, rgba(239,68,68,0.55) 60%)"
            : "radial-gradient(circle, rgba(34,197,94,0.55) 18%, transparent 22%)",
        };
      }
    }

    // Check highlight: outline king square
    if (game.status.isCheck) {
      const kingColor = game.turn;
      const board = chessRefBoardScan(game.fen, kingColor);
      if (board) {
        styles[board] = {
          ...(styles[board] ?? {}),
          boxShadow: "inset 0 0 0 3px rgba(239, 68, 68, 0.7)",
        };
      }
    }

    return styles;
  }, [selected, game.verboseHistory, game.fen, game.status.isCheck, game.turn, game.legalMovesFrom]);

  const handlePieceDrop = React.useCallback(
    ({
      sourceSquare,
      targetSquare,
    }: {
      sourceSquare: string;
      targetSquare: string | null;
    }) => {
      setSelected(null);
      if (disabled || !targetSquare) return false;
      const result = game.move({ from: sourceSquare, to: targetSquare });
      return !!result;
    },
    [game, disabled]
  );

  const handleSquareClick = React.useCallback(
    ({ square }: { square: string }) => {
      if (disabled) return;
      const sq = square as Square;
      const piece = game.getPiece(sq);

      if (selected) {
        if (selected === sq) {
          setSelected(null);
          return;
        }
        const result = game.move({ from: selected, to: sq });
        if (result) {
          setSelected(null);
          return;
        }
        // Move failed: if clicked own piece, switch selection; else deselect
        if (piece && piece.color === game.turn) {
          setSelected(sq);
        } else {
          setSelected(null);
        }
        return;
      }

      // No selection yet
      if (piece && piece.color === game.turn) {
        setSelected(sq);
      }
    },
    [selected, game, disabled]
  );

  // Reset selection when the underlying position resets (e.g. New game)
  React.useEffect(() => {
    if (game.history.length === 0) setSelected(null);
  }, [game.history.length]);

  return (
    <div
      className="relative w-full"
      style={{ filter: "saturate(1.05)" }}
    >
      <div
        className="aspect-square w-full overflow-hidden rounded-xl ring-1"
        style={{
          boxShadow: palette.shadow,
          borderColor: palette.border,
        }}
      >
        <Chessboard
          options={{
            id: "play-board",
            position: game.fen,
            boardOrientation: orientation,
            allowDragging: !disabled,
            animationDurationInMs: 200,
            showAnimations: true,
            showNotation: true,
            darkSquareStyle: { background: palette.dark },
            lightSquareStyle: { background: palette.light },
            squareStyles,
            onPieceDrop: handlePieceDrop,
            onSquareClick: handleSquareClick,
          }}
        />
      </div>
    </div>
  );
}

// Find king square of a given color from FEN string (no chess.js import needed
// here since we want to keep this module thin; helpers here are minimal).
function chessRefBoardScan(fen: string, color: "w" | "b"): Square | null {
  const target = color === "w" ? "K" : "k";
  const board = fen.split(" ")[0];
  const ranks = board.split("/");
  for (let r = 0; r < 8; r++) {
    let file = 0;
    for (const ch of ranks[r]) {
      if (/\d/.test(ch)) {
        file += Number(ch);
      } else {
        if (ch === target) {
          const fileChar = String.fromCharCode("a".charCodeAt(0) + file);
          const rankChar = String(8 - r);
          return `${fileChar}${rankChar}` as Square;
        }
        file += 1;
      }
    }
  }
  return null;
}
