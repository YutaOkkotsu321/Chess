"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Brain, Play, Zap } from "lucide-react";

export function HeroReveal({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

const FEATURES = [
  {
    Icon: Play,
    title: "Play vs AI",
    desc: "Stockfish с настройкой сложности от 1 до 20 — от новичка до гроссмейстера.",
  },
  {
    Icon: Brain,
    title: "AI Coach",
    desc: "Найдёт критические ошибки в твоей партии и объяснит, как было лучше.",
  },
  {
    Icon: Zap,
    title: "Beautiful & fast",
    desc: "Mobile-first, dark/light темы, плавные анимации, без лишнего.",
  },
];

export function FeatureGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map(({ Icon, title, desc }, i) => (
        <motion.div
          key={title}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{
            delay: i * 0.08,
            duration: 0.5,
            ease: [0.16, 1, 0.3, 1],
          }}
          whileHover={{ y: -2 }}
          className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
        >
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 opacity-0 transition-opacity duration-300 group-hover:from-primary/5 group-hover:opacity-100" />
          <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Icon size={18} />
          </div>
          <h3 className="font-semibold tracking-tight">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {desc}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
