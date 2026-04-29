"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Chess, type Move } from "chess.js";
import {
  AlertTriangle,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useStockfish } from "@/hooks/use-stockfish";
import type { AnalysisResult } from "@/lib/stockfish/engine";
import type { GameResult, PlayerColor } from "@/lib/supabase/types";

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
  pgn: string;
  playerColor: PlayerColor;
  difficulty: number;
  result: GameResult;
  outcomeReason: string | null;
};

type PlyMove = {
  san: string;
  from: string;
  to: string;
  before: string;
  after: string;
  mover: "w" | "b";
};

const ANALYSIS_MOVETIME_MS = 250;
const MIN_LOSS_FOR_FLAG_CP = 100;
const MAX_FLAGGED = 3;

export function GameReview({
  pgn,
  playerColor,
  difficulty,
  result,
  outcomeReason,
}: Props) {
  const moves = React.useMemo<PlyMove[]>(() => parsePgnToMoves(pgn), [pgn]);

  // Distinct positions: starting FEN + after each move.
  const positions = React.useMemo<string[]>(() => {
    if (moves.length === 0) {
      return [new Chess().fen()];
    }
    return [moves[0].before, ...moves.map((m) => m.after)];
  }, [moves]);

  const [ply, setPly] = React.useState(0);
  const [analyses, setAnalyses] = React.useState<(AnalysisResult | null)[]>(
    () => new Array(positions.length).fill(null)
  );
  const [analysisDone, setAnalysisDone] = React.useState(false);

  const { engine, status: engineStatus } = useStockfish();

  React.useEffect(() => {
    setAnalyses(new Array(positions.length).fill(null));
    setAnalysisDone(false);
  }, [positions]);

  // Drive sequential analysis once the engine is ready.
  React.useEffect(() => {
    if (engineStatus !== "ready" || !engine) return;
    if (positions.length === 0) {
      setAnalysisDone(true);
      return;
    }

    let cancelled = false;
    (async () => {
      for (let i = 0; i < positions.length; i++) {
        if (cancelled) return;
        try {
          const result = await engine.analyze({
            fen: positions[i],
            movetime: ANALYSIS_MOVETIME_MS,
          });
          if (cancelled) return;
          setAnalyses((prev) => {
            const next = prev.slice();
            next[i] = result;
            return next;
          });
        } catch (err) {
          console.error("[GameReview] analyze failed at ply", i, err);
        }
      }
      if (!cancelled) setAnalysisDone(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [engine, engineStatus, positions]);

  const whitePovScores = React.useMemo<(number | null)[]>(
    () =>
      analyses.map((a, i) => {
        if (!a) return null;
        const sideToMove: "w" | "b" = i === 0 ? "w" : (moves[i - 1]?.mover === "w" ? "b" : "w");
        return sideToMove === "w" ? a.scoreCp : -a.scoreCp;
      }),
    [analyses, moves]
  );

  const playerLosses = React.useMemo<(number | null)[]>(
    () =>
      moves.map((m, i) => {
        const before = whitePovScores[i];
        const after = whitePovScores[i + 1];
        if (before == null || after == null) return null;
        if (m.mover !== (playerColor === "white" ? "w" : "b")) return null;
        return m.mover === "w" ? before - after : after - before;
      }),
    [moves, playerColor, whitePovScores]
  );

  const topMistakes = React.useMemo<{ index: number; loss: number }[]>(() => {
    const scored = playerLosses
      .map((loss, index) => ({ index, loss: loss ?? -Infinity }))
      .filter((m) => m.loss >= MIN_LOSS_FOR_FLAG_CP);
    scored.sort((a, b) => b.loss - a.loss);
    return scored.slice(0, MAX_FLAGGED);
  }, [playerLosses]);

  const flaggedSet = React.useMemo(
    () => new Set(topMistakes.map((m) => m.index)),
    [topMistakes]
  );

  // For each position, derive the engine's recommended move in SAN form.
  // Done once per (analyses, positions) so the move list and best-move
  // badge can render synchronously.
  const bestMoveSans = React.useMemo<(string | null)[]>(
    () =>
      analyses.map((a, i) => {
        if (!a?.bestMove) return null;
        const tmp = new Chess();
        try {
          tmp.load(positions[i]);
          const m = tmp.move({
            from: a.bestMove.from,
            to: a.bestMove.to,
            promotion: a.bestMove.promotion,
          });
          return m?.san ?? null;
        } catch {
          return null;
        }
      }),
    [analyses, positions]
  );

  const orientation = playerColor;
  const currentFen = positions[ply] ?? positions[0];
  const lastMove = ply > 0 ? moves[ply - 1] : null;
  const currentScoreWhite = whitePovScores[ply];
  const currentMate = analyses[ply]?.mate ?? null;
  const currentBestMove = analyses[ply]?.bestMove ?? null;
  const currentBestSan = bestMoveSans[ply] ?? null;
  const playedNextSan = ply < moves.length ? moves[ply].san : null;
  const totalAnalyzed = analyses.filter(Boolean).length;
  const analysisProgress =
    positions.length === 0 ? 1 : totalAnalyzed / positions.length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <ReplayBoard
          fen={currentFen}
          orientation={orientation}
          lastMove={lastMove ? { from: lastMove.from, to: lastMove.to } : null}
          isMistake={ply > 0 && flaggedSet.has(ply - 1)}
          bestMove={currentBestMove}
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <EvalReadout
            scoreWhitePov={currentScoreWhite}
            mate={currentMate}
            isLoading={analyses[ply] === null}
          />
          <BestMoveBadge
            san={currentBestSan}
            playedSan={playedNextSan}
            isLoading={analyses[ply] === null}
            atGameEnd={ply >= positions.length - 1 && positions.length > 1}
          />
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPly(0)}
              disabled={ply === 0}
              aria-label="First move"
            >
              <ChevronFirst size={16} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPly((p) => Math.max(0, p - 1))}
              disabled={ply === 0}
              aria-label="Previous move"
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPly((p) => Math.min(positions.length - 1, p + 1))}
              disabled={ply >= positions.length - 1}
              aria-label="Next move"
            >
              <ChevronRight size={16} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPly(positions.length - 1)}
              disabled={ply >= positions.length - 1}
              aria-label="Last move"
            >
              <ChevronLast size={16} />
            </Button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Game
          </div>
          <div className="mt-1 font-medium">
            vs Stockfish · Lvl {difficulty} · Played{" "}
            {playerColor === "white" ? "White" : "Black"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Result: {result.toUpperCase()}
            {outcomeReason ? ` · ${outcomeReason}` : ""}
          </div>
        </div>
      </div>

      <aside className="flex min-h-0 flex-col gap-4">
        <MistakesPanel
          engineStatus={engineStatus}
          analysisProgress={analysisProgress}
          analysisDone={analysisDone}
          mistakes={topMistakes}
          moves={moves}
          bestMoveSans={bestMoveSans}
          onJump={(plyIndex) => setPly(plyIndex)}
        />
        <MoveList
          moves={moves}
          ply={ply}
          flaggedSet={flaggedSet}
          losses={playerLosses}
          onJump={setPly}
        />
      </aside>
    </div>
  );
}

function ReplayBoard({
  fen,
  orientation,
  lastMove,
  isMistake,
  bestMove,
}: {
  fen: string;
  orientation: "white" | "black";
  lastMove: { from: string; to: string } | null;
  isMistake: boolean;
  bestMove: { from: string; to: string } | null;
}) {
  const { resolvedTheme } = useTheme();
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
    if (lastMove) {
      const bg = isMistake
        ? "rgba(239, 68, 68, 0.28)"
        : "rgba(34, 197, 94, 0.18)";
      styles[lastMove.from] = { background: bg };
      styles[lastMove.to] = { background: bg };
    }
    return styles;
  }, [lastMove, isMistake]);

  const arrows = React.useMemo(
    () =>
      bestMove
        ? [
            {
              startSquare: bestMove.from,
              endSquare: bestMove.to,
              color: "rgba(34, 197, 94, 0.85)",
            },
          ]
        : [],
    [bestMove]
  );

  return (
    <div className="relative w-full" style={{ filter: "saturate(1.05)" }}>
      <div
        className="aspect-square w-full overflow-hidden rounded-xl ring-1"
        style={{ boxShadow: palette.shadow, borderColor: palette.border }}
      >
        <Chessboard
          options={{
            id: "review-board",
            position: fen,
            boardOrientation: orientation,
            allowDragging: false,
            animationDurationInMs: 200,
            showAnimations: true,
            showNotation: true,
            darkSquareStyle: { background: palette.dark },
            lightSquareStyle: { background: palette.light },
            squareStyles,
            arrows,
          }}
        />
      </div>
    </div>
  );
}

function BestMoveBadge({
  san,
  playedSan,
  isLoading,
  atGameEnd,
}: {
  san: string | null;
  playedSan: string | null;
  isLoading: boolean;
  atGameEnd: boolean;
}) {
  if (atGameEnd) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
        Game over
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
        <Loader2 size={14} className="animate-spin" />
        Best move…
      </div>
    );
  }
  if (!san) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
        Best: —
      </div>
    );
  }
  const matchesPlayed = playedSan != null && san === playedSan;
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium ${
        matchesPlayed
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
          : "border-border bg-card"
      }`}
    >
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        Best
      </span>
      <span className="font-mono">{san}</span>
      {matchesPlayed && (
        <span className="text-[11px] font-normal text-muted-foreground">
          (played)
        </span>
      )}
    </div>
  );
}

function EvalReadout({
  scoreWhitePov,
  mate,
  isLoading,
}: {
  scoreWhitePov: number | null;
  mate: number | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
        <Loader2 size={14} className="animate-spin" />
        Analyzing…
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium tabular-nums">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        Eval
      </span>
      <span>{formatEval(scoreWhitePov, mate)}</span>
    </div>
  );
}

function MistakesPanel({
  engineStatus,
  analysisProgress,
  analysisDone,
  mistakes,
  moves,
  bestMoveSans,
  onJump,
}: {
  engineStatus: string;
  analysisProgress: number;
  analysisDone: boolean;
  mistakes: { index: number; loss: number }[];
  moves: PlyMove[];
  bestMoveSans: (string | null)[];
  onJump: (ply: number) => void;
}) {
  const isAnalyzing = !analysisDone;

  return (
    <section className="rounded-2xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <AlertTriangle size={14} />
          Key mistakes
        </h2>
        {isAnalyzing && (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {Math.round(analysisProgress * 100)}%
          </span>
        )}
      </header>

      {isAnalyzing && (
        <div className="px-4 pt-3">
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.round(analysisProgress * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {engineStatus === "loading" || engineStatus === "idle"
              ? "Loading engine…"
              : "Stockfish is reviewing each move."}
          </p>
        </div>
      )}

      {analysisDone && mistakes.length === 0 && (
        <div className="px-4 py-6 text-center text-xs text-muted-foreground">
          No major mistakes found. Clean game!
        </div>
      )}

      {mistakes.length > 0 && (
        <ul className="divide-y divide-border/60">
          {mistakes.map(({ index, loss }) => {
            const move = moves[index];
            const moveNumber = Math.floor(index / 2) + 1;
            const dotted = move.mover === "w" ? "." : "...";
            const bestSan = bestMoveSans[index];
            const severity = severityLabel(loss);
            return (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => onJump(index)}
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-accent/40"
                >
                  <div className="min-w-0">
                    <div className="font-medium">
                      {moveNumber}
                      {dotted} {move.san}
                      <span className="ml-2 inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive ring-1 ring-destructive/20">
                        {severity}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Engine preferred:{" "}
                      <span className="font-mono text-foreground">
                        {bestSan ?? "—"}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    −{(loss / 100).toFixed(1)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function MoveList({
  moves,
  ply,
  flaggedSet,
  losses,
  onJump,
}: {
  moves: PlyMove[];
  ply: number;
  flaggedSet: Set<number>;
  losses: (number | null)[];
  onJump: (ply: number) => void;
}) {
  // Pair plies into full moves: [white, black?] per row.
  const pairs: { number: number; white?: PlyMove; black?: PlyMove }[] = [];
  for (let i = 0; i < moves.length; i++) {
    const isWhite = moves[i].mover === "w";
    const moveNumber = Math.floor(i / 2) + 1;
    if (isWhite) {
      pairs.push({ number: moveNumber, white: moves[i] });
    } else {
      const last = pairs[pairs.length - 1];
      if (last && last.number === moveNumber) {
        last.black = moves[i];
      } else {
        pairs.push({ number: moveNumber, black: moves[i] });
      }
    }
  }

  return (
    <section className="flex max-h-[420px] flex-col rounded-2xl border border-border bg-card">
      <header className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Moves ({moves.length})
      </header>
      <ol className="flex-1 overflow-y-auto px-2 py-2 text-sm">
        {pairs.map((pair, idx) => {
          const whiteIndex = (pair.number - 1) * 2;
          const blackIndex = whiteIndex + 1;
          return (
            <li
              key={idx}
              className="grid grid-cols-[2.25rem_1fr_1fr] items-center gap-1 rounded px-2 py-1"
            >
              <span className="text-xs tabular-nums text-muted-foreground">
                {pair.number}.
              </span>
              {pair.white ? (
                <MoveCell
                  san={pair.white.san}
                  active={ply === whiteIndex + 1}
                  flagged={flaggedSet.has(whiteIndex)}
                  loss={losses[whiteIndex]}
                  onClick={() => onJump(whiteIndex + 1)}
                />
              ) : (
                <span />
              )}
              {pair.black ? (
                <MoveCell
                  san={pair.black.san}
                  active={ply === blackIndex + 1}
                  flagged={flaggedSet.has(blackIndex)}
                  loss={losses[blackIndex]}
                  onClick={() => onJump(blackIndex + 1)}
                />
              ) : (
                <span />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function MoveCell({
  san,
  active,
  flagged,
  loss,
  onClick,
}: {
  san: string;
  active: boolean;
  flagged: boolean;
  loss: number | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center justify-between rounded px-2 py-1 font-mono text-sm transition ${
        active
          ? "bg-primary/15 text-foreground ring-1 ring-primary/30"
          : "hover:bg-accent/40"
      }`}
    >
      <span className="inline-flex items-center gap-1.5">
        {flagged && (
          <AlertTriangle size={12} className="text-destructive" aria-hidden />
        )}
        {san}
      </span>
      {loss != null && loss >= MIN_LOSS_FOR_FLAG_CP && (
        <span className="text-[10px] tabular-nums text-destructive/80">
          −{(loss / 100).toFixed(1)}
        </span>
      )}
    </button>
  );
}

function parsePgnToMoves(pgn: string): PlyMove[] {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    return [];
  }
  const verbose = chess.history({ verbose: true }) as Move[];
  return verbose.map((m) => ({
    san: m.san,
    from: m.from,
    to: m.to,
    before: m.before,
    after: m.after,
    mover: m.color,
  }));
}

function formatEval(scoreWhitePov: number | null, mate: number | null): string {
  if (mate != null) {
    const sign = mate >= 0 ? "+" : "−";
    return `${sign}M${Math.abs(mate)}`;
  }
  if (scoreWhitePov == null) return "—";
  const pawns = scoreWhitePov / 100;
  return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(2)}`;
}

function severityLabel(lossCp: number): string {
  if (lossCp >= 300) return "Blunder";
  if (lossCp >= 150) return "Mistake";
  return "Inaccuracy";
}
