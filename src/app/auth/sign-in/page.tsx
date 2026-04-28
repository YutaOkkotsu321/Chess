import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = {
  title: "Sign in",
};

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignInPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <>
      {params.error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {params.error}
        </div>
      )}
      <AuthForm mode="sign-in" />
    </>
  );
}
