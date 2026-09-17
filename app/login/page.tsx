import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Card } from "@/components/ui/card";
import {
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
} from "@/components/ui/empty";
import { Lightbulb } from "lucide-react";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect("/ideas");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-6 py-10">
      <Card className="w-full max-w-sm p-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Lightbulb />
          </EmptyMedia>
          <EmptyTitle>특허 아이디어 도구</EmptyTitle>
          <EmptyDescription>
            떠오른 특허 아이디어를 적어두면 국내 공개 특허와 얼마나 겹치는지 확인하고,
            출원 가능성 점수와 특허팀에 넘길 PPT를 받을 수 있습니다.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <GoogleSignInButton />
        </EmptyContent>
      </Card>
    </div>
  );
}
