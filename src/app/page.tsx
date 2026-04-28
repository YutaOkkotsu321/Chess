import Link from "next/link";
import { Play, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FeatureGrid, HeroReveal } from "@/components/landing";

export default function HomePage() {
  return (
    <div className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-10%] h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-br from-primary/25 via-primary/5 to-transparent blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[400px] w-[400px] rounded-full bg-gradient-to-br from-cyan-500/10 via-transparent to-transparent blur-3xl" />
      </div>

      <section className="mx-auto max-w-6xl px-4 pb-12 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pt-32">
        <HeroReveal>
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles size={12} className="text-primary" />
              Powered by AI Coach
            </div>
            <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Play chess the{" "}
              <span className="bg-gradient-to-r from-primary via-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                smart
              </span>{" "}
              way.
            </h1>
            <p className="mt-6 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg lg:text-xl">
              ChessTech — твой персональный шахматный тренер. Игра против ИИ,
              глубокий анализ партий и красивый интерфейс. Без компромиссов.
            </p>
            <div className="mt-10 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/play">
                  <Play size={18} /> Play now
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full sm:w-auto"
              >
                <Link href="/pricing">Upgrade to Pro</Link>
              </Button>
            </div>
          </div>
        </HeroReveal>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
        <FeatureGrid />
      </section>
    </div>
  );
}
