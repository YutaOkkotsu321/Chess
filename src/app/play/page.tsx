"use client";

import * as React from "react";

import { ChessBoard } from "@/components/chess/chess-board";
import { GamePanel } from "@/components/chess/game-panel";
import {
  GameSettings,
  type PlayerColor,
} from "@/components/chess/game-settings";
import { useChessGame } from "@/hooks/use-chess-game";
import { useStockfish } from "@/hooks/use-stockfish";
import {
  movetimeForDifficulty,
  skillForDifficulty,
} from "@/lib/stockfish/engine";
import { saveGame } from "@/lib/games/actions";
import { deriveGameOutcome } from "@/lib/games/result";

const SETTINGS_KEY = "chesstech:play-settings";

type Settings = {
  playerColor: PlayerColor;
  difficulty: number;
};

const DEFAULT_SETTINGS: Settings = {
  playerColor: "white",
  difficulty: 5,
};

export default function PlayPage() {
  const game = useChessGame();
  const { engine, status: engineStatus } = useStockfish();

  const [settings, setSettings] = React.useState<Settings>(DEFAULT_SETTINGS);
  const [orientation, setOrientation] = React.useState<PlayerColor>("white");
  const [aiThinking, setAiThinking] = React.useState(false);
  // FEN of the last finished game we already persisted — guards against
  // double-saving when status props recompute on re-render.
  const savedFenRef = React.useRef<string | null>(null);

  // Restore settings from localStorage. Orientation follows playerColor.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Settings>;
        const next: Settings = {
          playerColor:
            parsed.playerColor === "black" ? "black" : "white",
          difficulty:
            typeof parsed.difficulty === "number"
              ? clamp(Math.round(parsed.difficulty), 1, 20)
              : DEFAULT_SETTINGS.difficulty,
        };
        setSettings(next);
        setOrientation(next.playerColor);
      }
    } catch {
      // ignore corrupted settings
    }
  }, []);

  // Persist settings.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // quota / privacy mode
    }
  }, [settings]);

  // Drive the AI: when it's the engine's turn and the game isn't over,
  // ask Stockfish for a move and apply it.
  React.useEffect(() => {
    if (!engine || engineStatus !== "ready") return;
    if (game.status.isGameOver) return;
    if (!game.isHydrated) return;

    const aiColorIsWhite = settings.playerColor === "black";
    const aiTurn =
      (aiColorIsWhite && game.turn === "w") ||
      (!aiColorIsWhite && game.turn === "b");
    if (!aiTurn) return;

    let cancelled = false;
    setAiThinking(true);

    engine
      .findBestMove({
        fen: game.fen,
        skillLevel: skillForDifficulty(settings.difficulty),
        movetime: movetimeForDifficulty(settings.difficulty),
      })
      .then((move) => {
        if (cancelled) return;
        setAiThinking(false);
        const applied = game.move(move);
        if (!applied) {
          console.warn("[play] engine returned illegal move", move);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setAiThinking(false);
        console.error("[play] engine move failed:", err);
      });

    return () => {
      // Always reset the thinking flag when we abandon a search — otherwise
      // a cancelled-mid-flight `findBestMove` would leave the board disabled
      // forever (the resolved closure short-circuits on `cancelled`).
      cancelled = true;
      engine.stop();
      setAiThinking(false);
    };
  }, [
    engine,
    engineStatus,
    game.fen,
    game.turn,
    game.isHydrated,
    game.status.isGameOver,
    game.move,
    settings.playerColor,
    settings.difficulty,
  ]);

  const handlePlayerColorChange = React.useCallback(
    (color: PlayerColor) => {
      setSettings((s) => ({ ...s, playerColor: color }));
      setOrientation(color);
      game.reset();
    },
    [game]
  );

  const handleDifficultyChange = React.useCallback(
    (difficulty: number) => {
      setSettings((s) => ({ ...s, difficulty }));
    },
    []
  );

  const handleNewGame = React.useCallback(() => {
    engine?.stop();
    setAiThinking(false);
    savedFenRef.current = null;
    game.reset();
    setOrientation(settings.playerColor);
  }, [engine, game, settings.playerColor]);

  // Persist completed games to Supabase (no-ops if user is signed out).
  React.useEffect(() => {
    if (!game.status.isGameOver) return;
    if (game.history.length === 0) return;
    if (savedFenRef.current === game.fen) return;

    const outcome = deriveGameOutcome(game.status, settings.playerColor);
    if (!outcome) return;

    savedFenRef.current = game.fen;

    saveGame({
      pgn: game.pgn,
      result: outcome.result,
      playerColor: settings.playerColor,
      difficulty: settings.difficulty,
      outcomeReason: outcome.reason,
      totalMoves: game.history.length,
    })
      .then((res) => {
        if (!res.ok && res.error !== "not-authenticated") {
          console.warn("[play] saveGame failed:", res.error);
          // allow retry on next state tick
          savedFenRef.current = null;
        }
      })
      .catch((err) => {
        console.warn("[play] saveGame threw:", err);
        savedFenRef.current = null;
      });
  }, [
    game.status,
    game.fen,
    game.pgn,
    game.history.length,
    settings.playerColor,
    settings.difficulty,
  ]);

  const handleFlip = React.useCallback(() => {
    setOrientation((o) => (o === "white" ? "black" : "white"));
  }, []);

  // Smart undo for AI mode: cancel the engine and roll back to *before*
  // the player's last move. If AI just moved we undo 2 plies (its reply +
  // our move); if AI is still thinking we undo only our move (1 ply).
  const handleUndo = React.useCallback(() => {
    if (game.history.length === 0) return;
    engine?.stop();
    setAiThinking(false);
    const playerLetter = settings.playerColor === "white" ? "w" : "b";
    const plies = game.turn === playerLetter ? 2 : 1;
    game.undoMultiple(plies);
  }, [
    engine,
    game,
    settings.playerColor,
  ]);

  const playerHasMove = React.useMemo(() => {
    if (!game.isHydrated) return false;
    if (game.status.isGameOver) return false;
    const isPlayerTurn =
      (settings.playerColor === "white" && game.turn === "w") ||
      (settings.playerColor === "black" && game.turn === "b");
    return isPlayerTurn;
  }, [
    game.isHydrated,
    game.status.isGameOver,
    game.turn,
    settings.playerColor,
  ]);

  const boardDisabled = !playerHasMove || aiThinking;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <header className="mb-6 flex flex-col gap-1 sm:mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Play vs AI
        </h1>
        <p className="text-sm text-muted-foreground">
          Stockfish 18 (lite, single-threaded). Difficulty 1–20. Position is
          auto-saved between sessions.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
        <div className="mx-auto w-full max-w-[640px] lg:mx-0">
          <ChessBoard
            game={game}
            orientation={orientation}
            disabled={boardDisabled}
          />
        </div>
        <div className="flex flex-col gap-4">
          <GameSettings
            playerColor={settings.playerColor}
            onPlayerColorChange={handlePlayerColorChange}
            difficulty={settings.difficulty}
            onDifficultyChange={handleDifficultyChange}
            engineStatus={engineStatus}
            onNewGame={handleNewGame}
            isAiThinking={aiThinking}
          />
          <GamePanel
            game={game}
            onFlip={handleFlip}
            onUndo={handleUndo}
            onReset={handleNewGame}
            canUndo={game.history.length > 0 && !game.status.isGameOver}
          />
        </div>
      </div>
    </div>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
