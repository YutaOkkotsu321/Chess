"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Loader2, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";

function Inner() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4" />
      )}
      Sign out
    </Button>
  );
}

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Inner />
    </form>
  );
}
