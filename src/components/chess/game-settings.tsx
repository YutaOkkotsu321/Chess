"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, CircleSlash, Loader2, Swords } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EngineStatus } from "@/hooks/use-stockfish";

export type PlayerColor = "white" | "black";

type Props = {
  playerColor: PlayerColor;
  onPlayerColorChange: (color: PlayerColor) => void;
  difficulty: number;
  onDifficultyChange: (n: number) => void;
  engineStatus: EngineStatus;
  onNewGame: () => void;
  isAiThinking: boolean;
};

export function GameSettings({
  playerColor,
  onPlayerColorChange,
  difficulty,
  onDifficultyChange,
  engineStatus,
  onNewGame,
  isAiThinking,
}: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Swords size={16} className="text-primary" />
          <span className="text-sm font-semibold tracking-tight">
            Match settings
          </span>
        </div>
        <EngineBadge status={engineStatus} thinking={isAiThinking} />
      </div>

      <div className="mt-5 space-y-5">
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Play as
          </label>
          <div className="grid grid-cols-2 gap-2">
            <ColorChip
              active={playerColor === "white"}
              color="white"
              onClick={() => onPlayerColorChange("white")}
            />
            <ColorChip
              active={playerColor === "black"}
              color="black"
              onClick={() => onPlayerColorChange("black")}
            />
          </div>
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
            Сменить цвет можно только при новой партии.
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Difficulty
            </label>
            <span className="font-mono text-sm font-semibold tabular-nums">
              {difficulty}
              <span className="text-muted-foreground"> / 20</span>
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={difficulty}
            onChange={(e) => onDifficultyChange(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary outline-none"
            aria-label="Difficulty"
          />
          <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Beginner</span>
            <span>Intermediate</span>
            <span>Master</span>
          </div>
        </div>

        <Button
          onClick={onNewGame}
          variant="default"
          className="w-full"
          disabled={engineStatus === "loading"}
        >
          New game
        </Button>
      </div>
    </div>
  );
}

function ColorChip({
  active,
  color,
  onClick,
}: {
  active: boolean;
  color: PlayerColor;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all",
        active
          ? "border-primary/60 bg-primary/10 text-foreground shadow-sm shadow-primary/10"
          : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground"
      )}
      aria-pressed={active}
    >
      <span
        className={cn(
          "h-4 w-4 rounded-full ring-2 transition-transform group-hover:scale-110",
          color === "white"
            ? "bg-white ring-zinc-300"
            : "bg-zinc-900 ring-zinc-600"
        )}
      />
      <span className="capitalize">{color}</span>
    </button>
  );
}

function EngineBadge({
  status,
  thinking,
}: {
  status: EngineStatus;
  thinking: boolean;
}) {
  if (status === "error") {
    return (
      <Pill tone="bad" icon={<CircleSlash size={11} />}>
        Engine offline
      </Pill>
    );
  }
  if (status !== "ready") {
    return (
      <Pill tone="warn" icon={<Loader2 size={11} className="animate-spin" />}>
        Loading…
      </Pill>
    );
  }
  if (thinking) {
    return (
      <Pill tone="primary" icon={<ThinkingDots />}>
        Thinking
      </Pill>
    );
  }
  return (
    <Pill tone="good" icon={<CheckCircle2 size={11} />}>
      Ready
    </Pill>
  );
}

function Pill({
  children,
  icon,
  tone,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  tone: "good" | "bad" | "warn" | "primary";
}) {
  return (
    <motion.span
      layout
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
        tone === "good" &&
          "bg-primary/10 text-primary ring-primary/30",
        tone === "primary" &&
          "bg-primary/15 text-primary ring-primary/40",
        tone === "warn" &&
          "bg-amber-500/10 text-amber-500 ring-amber-500/30",
        tone === "bad" && "bg-destructive/10 text-destructive ring-destructive/30"
      )}
    >
      {icon}
      {children}
    </motion.span>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block h-1 w-1 rounded-full bg-current"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            delay: i * 0.18,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}
