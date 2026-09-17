import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IdeaForm } from "@/app/ideas/new/idea-form";

// submitIdea (KIPRIS 검색 + Gemini 분석)는 30초 안팎이 걸릴 수 있어,
// 배포 플랫폼의 기본 서버리스 함수 제한 시간보다 넉넉하게 늘려둔다.
export const maxDuration = 60;

export default async function NewIdeaPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <IdeaForm />
    </div>
  );
}
