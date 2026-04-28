import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware helper: refreshes the Supabase auth token cookies on every
 * navigation. Without this, server components would see stale sessions.
 *
 * If env vars are missing (e.g. during a fresh local checkout) it
 * passes through without touching cookies — auth simply won't work.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // IMPORTANT: getUser() validates the token server-side; getSession() only
  // reads cookies and is spoofable. Always use getUser in server contexts.
  await supabase.auth.getUser();

  return response;
}
