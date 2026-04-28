"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  CircleDot,
  Crown,
  FlipVertical2,
  RotateCcw,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChessGameApi } from "@/hooks/use-chess-game";

type Props = {
  game: ChessGameApi;
  onFlip: () => void;
  onUndo?: () => void;
  onReset?: () => void;
  canUndo?: boolean;
};

export function GamePanel({
  game,
  onFlip,
  onUndo,
  onReset,
  canUndo,
}: Props) {
  const handleUndo = onUndo ?? (() => game.undo());
  const handleReset = onReset ?? (() => game.reset());
  const undoEnabled = canUndo ?? game.history.length > 0;

  return (
    <aside className="flex flex-col gap-4">
      <StatusCard game={game} />
      <MoveHistory game={game} />
      <Controls
        onUndo={handleUndo}
        onReset={handleReset}
        onFlip={onFlip}
        canUndo={undoEnabled}
      />
    </aside>
  );
}

function StatusCard({ game }: { game: ChessGameApi }) {
  const { status, turn } = game;
  const turnLabel = turn === "w" ? "White" : "Black";

  let title: string;
  let tone: "neutral" | "good" | "bad" | "warn" = "neutral";

  if (status.isCheckmate) {
    title = `Checkmate — ${status.winner === "white" ? "White" : "Black"} wins`;
    tone = "good";
  } else if (status.isStalemate) {
    title = "Stalemate — draw";
    tone = "warn";
  } else if (status.isDraw) {
    const reason =
      status.drawReason === "repetition"
        ? "threefold repetition"
        : status.drawReason === "fifty-moves"
          ? "fifty-move rule"
          : status.drawReason === "insufficient-material"
            ? "insufficient material"
            : "draw";
    title = `Draw — ${reason}`;
    tone = "warn";
  } else if (status.isCheck) {
    title = `${turnLabel} to move — check`;
    tone = "bad";
  } else {
    title = `${turnLabel} to move`;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "grid h-10 w-10 place-items-center rounded-lg ring-1",
            tone === "good" &&
              "bg-primary/15 text-primary ring-primary/30",
            tone === "bad" &&
              "bg-destructive/15 text-destructive ring-destructive/30",
            tone === "warn" &&
              "bg-amber-500/15 text-amber-500 ring-amber-500/30",
            tone === "neutral" &&
              "bg-muted text-foreground ring-border"
          )}
        >
          {status.isCheckmate ? (
            <Crown size={18} />
          ) : status.isCheck ? (
            <CircleDot size={18} />
          ) : (
            <span
              className={cn(
                "h-3 w-3 rounded-full ring-2 ring-offset-2 ring-offset-card",
                turn === "w"
                  ? "bg-white ring-zinc-300"
                  : "bg-zinc-900 ring-zinc-600"
              )}
            />
          )}
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Status
          </div>
          <div className="truncate text-sm font-semibold">{title}</div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Move {Math.floor(game.history.length / 2) + 1}</span>
        <span className="font-mono">{game.history.length} plies</span>
      </div>
    </div>
  );
}

function MoveHistory({ game }: { game: ChessGameApi }) {
  const pairs = React.useMemo(() => {
    const list = game.history;
    const result: { num: number; white: string; black?: string }[] = [];
    for (let i = 0; i < list.length; i += 2) {
      result.push({
        num: Math.floor(i / 2) + 1,
        white: list[i],
        black: list[i + 1],
      });
    }
    return result;
  }, [game.history]);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [game.history.length]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Moves
        </div>
        <div className="text-xs text-muted-foreground">PGN</div>
      </div>
      <div
        ref={scrollRef}
        className="max-h-[260px] overflow-y-auto px-2 py-2 text-sm"
      >
        {pairs.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No moves yet — drag or tap a piece to play.
          </div>
        ) : (
          <ol className="divide-y divide-border/60">
            {pairs.map((p, i) => (
              <li
                key={p.num}
                className="grid grid-cols-[2.5rem_1fr_1fr] items-center px-2 py-1.5 font-mono text-[13px]"
              >
                <span className="text-muted-foreground">{p.num}.</span>
                <motion.span
                  initial={i === pairs.length - 1 ? { opacity: 0, x: -4 } : false}
                  animate={{ opacity: 1, x: 0 }}
                  className="truncate"
                >
                  {p.white}
                </motion.span>
                <motion.span
                  initial={
                    i === pairs.length - 1 && p.black
                      ? { opacity: 0, x: -4 }
                      : false
                  }
                  animate={{ opacity: 1, x: 0 }}
                  className="truncate text-muted-foreground"
                >
                  {p.black ?? ""}
                </motion.span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function Controls({
  onUndo,
  onFlip,
  onReset,
  canUndo,
}: {
  onUndo: () => void;
  onFlip: () => void;
  onReset: () => void;
  canUndo: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Button
        variant="outline"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Undo move"
      >
        <Undo2 size={16} /> Undo
      </Button>
      <Button variant="outline" onClick={onFlip} aria-label="Flip board">
        <FlipVertical2 size={16} /> Flip
      </Button>
      <Button variant="outline" onClick={onReset} aria-label="New game">
        <RotateCcw size={16} /> New
      </Button>
    </div>
  );
}
