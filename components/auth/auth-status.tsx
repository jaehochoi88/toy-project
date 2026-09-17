import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/auth/sign-out-button";

export async function AuthStatus() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    return (
      <Link href="/login" className="text-sm font-medium underline">
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/ideas" className="text-sm font-medium underline">
        내 아이디어
      </Link>
      <Link href="/settings" className="text-sm font-medium underline">
        Settings
      </Link>
      <SignOutButton />
    </div>
  );
}
