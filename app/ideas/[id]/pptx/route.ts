import { createClient } from "@/lib/supabase/server";
import { generatePatentDeck } from "@/lib/pptx/generate-deck";
import type { PatentIdeaRow } from "@/lib/patent-ideas/types";

// sharp로 도면을 래스터화하는 부분이 콜드 스타트 직후엔 느릴 수 있어 여유를 둔다.
export const maxDuration = 30;

function sanitizeFilename(title: string): string {
  const cleaned = title.replace(/[\\/:*?"<>|]/g, "").trim();
  return cleaned.length > 0 ? cleaned.slice(0, 60) : "특허아이디어";
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/ideas/[id]/pptx">,
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) {
    return new Response("로그인이 필요합니다.", { status: 401 });
  }

  const { data: idea } = await supabase
    .from("patent_ideas")
    .select("*")
    .eq("id", id)
    .single<PatentIdeaRow>();

  if (!idea || idea.status !== "completed") {
    return new Response("문서를 생성할 수 없습니다.", { status: 404 });
  }

  const buffer = await generatePatentDeck(idea);
  const filename = encodeURIComponent(`${sanitizeFilename(idea.title)}.pptx`);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
    },
  });
}
