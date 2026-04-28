"use client";

import * as React from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Reactive auth indicator on the right side of the navbar:
 * - signed in  → avatar circle linking to /profile
 * - signed out → "Sign in" button
 *
 * Subscribes to Supabase auth state so it updates immediately on login/logout
 * without a full page reload.
 */
export function NavbarUser() {
  const [user, setUser] = React.useState<User | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      setLoaded(true);
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoaded(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!loaded) {
    return (
      <div
        aria-hidden
        className="h-9 w-9 animate-pulse rounded-full bg-muted/60"
      />
    );
  }

  if (!user) {
    return (
      <Button asChild variant="outline" size="sm" className="gap-1.5">
        <Link href="/auth/sign-in">
          <LogIn size={14} />
          <span className="hidden sm:inline">Sign in</span>
        </Link>
      </Button>
    );
  }

  const meta = user.user_metadata as
    | { full_name?: string; name?: string; avatar_url?: string }
    | undefined;
  const avatarUrl = meta?.avatar_url;
  const name = meta?.full_name || meta?.name || user.email || "Player";
  const letter = name.charAt(0).toUpperCase();

  return (
    <Link
      href="/profile"
      aria-label="Profile"
      className="group relative grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-primary/80 to-primary/40 text-xs font-semibold text-primary-foreground ring-1 ring-border transition-transform hover:scale-105"
      title={name}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>{letter}</span>
      )}
    </Link>
  );
}
