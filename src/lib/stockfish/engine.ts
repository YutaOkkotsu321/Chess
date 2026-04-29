/**
 * Browser-only wrapper around the Stockfish 18 (lite-single) WASM engine.
 *
 * Communicates over UCI: the engine is a Web Worker that accepts plain-text
 * commands via postMessage and emits plain-text lines back. This class
 * handshakes (`uci` → `uciok`, `isready` → `readyok`) on `init()`, then
 * exposes a Promise-based `findBestMove()` plus skill-level setting.
 */

const ENGINE_URL = "/stockfish/stockfish-18-lite-single.js";

export type BestMove = {
  from: string;
  to: string;
  promotion?: string;
};

export type FindBestMoveOptions = {
  fen: string;
  /** Stockfish skill (0-20). Higher = stronger. */
  skillLevel: number;
  /** Engine think time in ms. */
  movetime: number;
};

export type AnalyzeOptions = {
  fen: string;
  /** Engine think time in ms. */
  movetime: number;
};

/**
 * Result of an analysis at a given position.
 * `scoreCp` is centipawns from the side-to-move's perspective.
 * If the engine reported a mate score, `mate` holds the signed mate-in-N value
 * (positive = side-to-move mates; negative = side-to-move gets mated) and
 * `scoreCp` is normalized to ±100_000 for comparisons.
 */
export type AnalysisResult = {
  scoreCp: number;
  mate: number | null;
  bestMove: BestMove | null;
};

type LineListener = (line: string) => void;

const MATE_SCORE_CP = 100_000;

export class StockfishEngine {
  private worker: Worker | null = null;
  private rawListeners = new Set<LineListener>();
  private currentSkill: number | null = null;
  private ready = false;
  private destroyed = false;

  /**
   * Boots the worker and waits for it to be ready.
   * Safe to call multiple times — subsequent calls resolve immediately.
   */
  async init(): Promise<void> {
    if (this.ready) return;
    if (this.destroyed) {
      throw new Error("Engine has been destroyed");
    }
    if (typeof window === "undefined") {
      throw new Error("StockfishEngine can only be used in the browser");
    }

    this.worker = new Worker(ENGINE_URL);
    this.worker.onmessage = (event) => {
      const data = event.data;
      const text = typeof data === "string" ? data : String(data);
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        for (const listener of this.rawListeners) listener(trimmed);
      }
    };
    this.worker.onerror = (err) => {
      // Surface as a thrown error to any pending waiters; not ideal but better
      // than silently hanging.
      console.error("[stockfish] worker error:", err);
    };

    this.send("uci");
    await this.waitForLine((l) => l === "uciok", 15_000);

    this.send("isready");
    await this.waitForLine((l) => l === "readyok", 15_000);

    // Keep things deterministic across games.
    this.send("ucinewgame");
    this.send("isready");
    await this.waitForLine((l) => l === "readyok", 5_000);

    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  /**
   * Asks the engine for the best move at the given FEN, with the requested
   * skill level and think-time budget. Resolves with the move in
   * {from, to, promotion?} form. Promotion (if any) is one letter: q/r/b/n.
   */
  async findBestMove(opts: FindBestMoveOptions): Promise<BestMove> {
    if (!this.ready || !this.worker) {
      throw new Error("Engine is not ready");
    }

    const skill = clamp(Math.round(opts.skillLevel), 0, 20);
    if (this.currentSkill !== skill) {
      this.send(`setoption name Skill Level value ${skill}`);
      this.currentSkill = skill;
    }

    this.send(`position fen ${opts.fen}`);
    this.send(`go movetime ${Math.max(50, Math.round(opts.movetime))}`);

    return new Promise<BestMove>((resolve, reject) => {
      const timeoutMs = opts.movetime + 10_000;
      const timer = setTimeout(() => {
        this.rawListeners.delete(handler);
        reject(new Error("stockfish: bestmove timed out"));
      }, timeoutMs);

      const handler: LineListener = (line) => {
        if (!line.startsWith("bestmove")) return;
        clearTimeout(timer);
        this.rawListeners.delete(handler);

        const tokens = line.split(/\s+/);
        const move = tokens[1];
        if (!move || move === "(none)" || move === "0000") {
          reject(new Error("stockfish: no legal moves"));
          return;
        }

        resolve({
          from: move.slice(0, 2),
          to: move.slice(2, 4),
          promotion: move.length > 4 ? move[4] : undefined,
        });
      };

      this.rawListeners.add(handler);
    });
  }

  /**
   * Evaluates the given position at full strength and returns the engine's
   * latest score plus its preferred move. Used for post-game analysis where
   * we want an honest verdict, not a difficulty-tuned reply.
   */
  async analyze(opts: AnalyzeOptions): Promise<AnalysisResult> {
    if (!this.ready || !this.worker) {
      throw new Error("Engine is not ready");
    }

    if (this.currentSkill !== 20) {
      this.send("setoption name Skill Level value 20");
      this.currentSkill = 20;
    }

    this.send(`position fen ${opts.fen}`);
    this.send(`go movetime ${Math.max(50, Math.round(opts.movetime))}`);

    return new Promise<AnalysisResult>((resolve, reject) => {
      const timeoutMs = opts.movetime + 10_000;
      let lastScoreCp: number | null = null;
      let lastMate: number | null = null;

      const timer = setTimeout(() => {
        this.rawListeners.delete(handler);
        reject(new Error("stockfish: analyze timed out"));
      }, timeoutMs);

      const handler: LineListener = (line) => {
        if (line.startsWith("info")) {
          const mateMatch = line.match(/\bscore mate (-?\d+)\b/);
          if (mateMatch) {
            lastMate = Number(mateMatch[1]);
            lastScoreCp = lastMate >= 0 ? MATE_SCORE_CP : -MATE_SCORE_CP;
            return;
          }
          const cpMatch = line.match(/\bscore cp (-?\d+)\b/);
          if (cpMatch) {
            lastScoreCp = Number(cpMatch[1]);
            lastMate = null;
          }
          return;
        }
        if (!line.startsWith("bestmove")) return;
        clearTimeout(timer);
        this.rawListeners.delete(handler);

        const tokens = line.split(/\s+/);
        const moveStr = tokens[1];
        let bestMove: BestMove | null = null;
        if (moveStr && moveStr !== "(none)" && moveStr !== "0000") {
          bestMove = {
            from: moveStr.slice(0, 2),
            to: moveStr.slice(2, 4),
            promotion: moveStr.length > 4 ? moveStr[4] : undefined,
          };
        }

        resolve({
          scoreCp: lastScoreCp ?? 0,
          mate: lastMate,
          bestMove,
        });
      };

      this.rawListeners.add(handler);
    });
  }

  /** Cancels any in-flight search. Safe to call when idle. */
  stop(): void {
    if (this.worker) this.send("stop");
  }

  /** Tears down the worker. Engine cannot be used afterwards. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.ready = false;
    this.rawListeners.clear();
    if (this.worker) {
      try {
        this.send("quit");
      } catch {
        // worker might already be gone
      }
      this.worker.terminate();
      this.worker = null;
    }
  }

  private send(cmd: string): void {
    this.worker?.postMessage(cmd);
  }

  private waitForLine(
    predicate: (line: string) => boolean,
    timeoutMs: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.rawListeners.delete(handler);
        reject(new Error("stockfish: handshake timed out"));
      }, timeoutMs);
      const handler: LineListener = (line) => {
        if (predicate(line)) {
          clearTimeout(timer);
          this.rawListeners.delete(handler);
          resolve();
        }
      };
      this.rawListeners.add(handler);
    });
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Maps user-facing difficulty (1-20) to engine think-time (ms). */
export function movetimeForDifficulty(difficulty: number): number {
  // Roughly: lvl 1 → ~150ms, lvl 10 → ~700ms, lvl 20 → ~1800ms
  const d = clamp(difficulty, 1, 20);
  return Math.round(120 + d * 85);
}

/** Maps user-facing difficulty (1-20) to Stockfish Skill Level (0-20). */
export function skillForDifficulty(difficulty: number): number {
  return clamp(Math.round(difficulty - 1), 0, 20);
}
