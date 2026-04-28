"use client";

import * as React from "react";
import { Chess, type Move, type Piece, type Square } from "chess.js";

const STORAGE_KEY = "chesstech:current-game-fen";

export type DrawReason =
  | "stalemate"
  | "repetition"
  | "fifty-moves"
  | "insufficient-material";

export type GameStatus = {
  isGameOver: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  drawReason: DrawReason | null;
  winner: "white" | "black" | null;
};

export type ChessGameApi = {
  fen: string;
  pgn: string;
  turn: "w" | "b";
  history: string[];
  verboseHistory: Move[];
  status: GameStatus;
  isHydrated: boolean;
  getPiece: (square: Square) => Piece | undefined;
  legalMovesFrom: (square: Square) => Move[];
  move: (params: {
    from: string;
    to: string;
    promotion?: string;
  }) => Move | null;
  reset: () => void;
  undo: () => Move | null;
  /** Undo up to N plies (or until history empty). Returns plies actually undone. */
  undoMultiple: (plies: number) => number;
  loadFen: (fen: string) => boolean;
};

function computeStatus(chess: Chess): GameStatus {
  const isCheckmate = chess.isCheckmate();
  const isStalemate = chess.isStalemate();
  const isDraw = chess.isDraw();
  const isCheck = chess.isCheck();
  const isGameOver = chess.isGameOver();

  let drawReason: DrawReason | null = null;
  if (isStalemate) drawReason = "stalemate";
  else if (chess.isThreefoldRepetition()) drawReason = "repetition";
  else if (chess.isDrawByFiftyMoves()) drawReason = "fifty-moves";
  else if (chess.isInsufficientMaterial()) drawReason = "insufficient-material";

  const winner: GameStatus["winner"] = isCheckmate
    ? chess.turn() === "w"
      ? "black"
      : "white"
    : null;

  return {
    isGameOver,
    isCheck,
    isCheckmate,
    isStalemate,
    isDraw,
    drawReason,
    winner,
  };
}

export function useChessGame(): ChessGameApi {
  const chessRef = React.useRef<Chess | null>(null);
  if (chessRef.current === null) chessRef.current = new Chess();

  const [fen, setFen] = React.useState<string>(() => chessRef.current!.fen());
  const [isHydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const tmp = new Chess();
        tmp.load(saved);
        chessRef.current = tmp;
        setFen(tmp.fen());
      }
    } catch {
      // invalid stored FEN — keep default position
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, fen);
    } catch {
      // quota / privacy mode — ignore
    }
  }, [fen, isHydrated]);

  const sync = React.useCallback(() => {
    setFen(chessRef.current!.fen());
  }, []);

  const move = React.useCallback<ChessGameApi["move"]>(
    ({ from, to, promotion }) => {
      try {
        const result = chessRef.current!.move({
          from,
          to,
          promotion: promotion ?? "q",
        });
        sync();
        return result;
      } catch {
        return null;
      }
    },
    [sync]
  );

  const reset = React.useCallback(() => {
    chessRef.current = new Chess();
    sync();
  }, [sync]);

  const undo = React.useCallback(() => {
    const result = chessRef.current!.undo();
    if (result) sync();
    return result;
  }, [sync]);

  const undoMultiple = React.useCallback<ChessGameApi["undoMultiple"]>(
    (plies) => {
      let count = 0;
      for (let i = 0; i < plies; i++) {
        const r = chessRef.current!.undo();
        if (!r) break;
        count++;
      }
      if (count > 0) sync();
      return count;
    },
    [sync]
  );

  const loadFen = React.useCallback<ChessGameApi["loadFen"]>(
    (next) => {
      try {
        chessRef.current!.load(next);
        sync();
        return true;
      } catch {
        return false;
      }
    },
    [sync]
  );

  const legalMovesFrom = React.useCallback<ChessGameApi["legalMovesFrom"]>(
    (square) => chessRef.current!.moves({ square, verbose: true }),
    []
  );

  const getPiece = React.useCallback<ChessGameApi["getPiece"]>(
    (square) => chessRef.current!.get(square),
    []
  );

  // Re-derive on each fen change. The void-fen statement keeps fen in deps.
  const status = React.useMemo(() => {
    void fen;
    return computeStatus(chessRef.current!);
  }, [fen]);

  const verboseHistory = React.useMemo<Move[]>(() => {
    void fen;
    return chessRef.current!.history({ verbose: true });
  }, [fen]);

  const history = React.useMemo<string[]>(() => {
    void fen;
    return chessRef.current!.history();
  }, [fen]);

  const turn = chessRef.current!.turn();

  const pgn = React.useMemo<string>(() => {
    void fen;
    return chessRef.current!.pgn();
  }, [fen]);

  return {
    fen,
    pgn,
    turn,
    history,
    verboseHistory,
    status,
    isHydrated,
    getPiece,
    legalMovesFrom,
    move,
    reset,
    undo,
    undoMultiple,
    loadFen,
  };
}
