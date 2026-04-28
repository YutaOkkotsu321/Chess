"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for client components / browser code.
 * Reads `NEXT_PUBLIC_*` env vars.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
