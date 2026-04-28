import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Play vs AI",
  description:
    "Play chess against Stockfish — adjust difficulty from 1 to 20, switch sides, and pick up where you left off.",
};

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
