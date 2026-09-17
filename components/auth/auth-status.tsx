import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/auth/sign-out-button";

export async function AuthStatus() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  // 로그아웃 상태에서는 로그인 화면 자체가 "Continue with Google" 버튼을
  // 이미 보여주므로, 헤더에는 아무것도(빈 줄조차) 띄우지 않는다.
  if (!data?.claims) {
    return null;
  }

  return (
    <header className="flex justify-end border-b px-6 py-3">
      <div className="flex items-center gap-3">
        <Link href="/ideas" className="text-sm font-medium underline">
          내 아이디어
        </Link>
        <SignOutButton />
      </div>
    </header>
  );
}
