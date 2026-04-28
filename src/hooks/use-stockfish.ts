"use client";

import * as React from "react";

import { StockfishEngine } from "@/lib/stockfish/engine";

export type EngineStatus = "idle" | "loading" | "ready" | "error";

export type UseStockfishApi = {
  engine: StockfishEngine | null;
  status: EngineStatus;
  error: Error | null;
};

/**
 * Boots a Stockfish worker on mount and tears it down on unmount.
 * Returns the engine handle plus a coarse status state for UI.
 */
export function useStockfish(): UseStockfishApi {
  const [status, setStatus] = React.useState<EngineStatus>("idle");
  const [error, setError] = React.useState<Error | null>(null);
  const engineRef = React.useRef<StockfishEngine | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const engine = new StockfishEngine();
    engineRef.current = engine;
    setStatus("loading");

    engine
      .init()
      .then(() => {
        if (cancelled) return;
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const e = err instanceof Error ? err : new Error(String(err));
        console.error("[useStockfish] init failed:", e);
        setError(e);
        setStatus("error");
      });

    return () => {
      cancelled = true;
      engine.destroy();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, []);

  return { engine: engineRef.current, status, error };
}
