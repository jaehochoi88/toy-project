import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia } from "@/components/ui/empty";
import { Lightbulb } from "lucide-react";
import type { PatentIdeaRow } from "@/lib/patent-ideas/types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function bandBadgeVariant(band: PatentIdeaRow["score_band"]) {
  if (band === "가능") return "default" as const;
  if (band === "보완") return "secondary" as const;
  return "destructive" as const;
}

export default async function IdeasPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  const { data: ideas } = await supabase
    .from("patent_ideas")
    .select(
      "id, title, status, score, score_band, prior_arts, created_at",
    )
    .order("created_at", { ascending: false })
    .returns<Pick<PatentIdeaRow, "id" | "title" | "status" | "score" | "score_band" | "prior_arts" | "created_at">[]>();

  const rows = ideas ?? [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-semibold">내 아이디어</h1>
          <p className="text-xs text-muted-foreground">분석한 아이디어가 여기에 쌓입니다.</p>
        </div>
        <Button render={<Link href="/ideas/new" />} nativeButton={false}>
          새 아이디어
        </Button>
      </div>

      {rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Lightbulb />
            </EmptyMedia>
            <EmptyTitle>아직 분석한 아이디어가 없습니다</EmptyTitle>
            <EmptyDescription>
              떠오른 특허 아이디어를 적어두면 국내 공개 특허와 얼마나 겹치는지 확인하고,
              특허팀에 넘길 문서를 받을 수 있습니다.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button render={<Link href="/ideas/new" />} nativeButton={false}>
              첫 아이디어 넣기
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((idea) => (
            <Link key={idea.id} href={`/ideas/${idea.id}`}>
              <Card className="flex-row items-center gap-4 px-4 py-3 transition-colors hover:bg-accent">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{idea.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(idea.created_at)}
                    {idea.status === "completed"
                      ? ` · 선행 특허 ${idea.prior_arts?.length ?? 0}건 검토`
                      : " · 분석 실패"}
                  </p>
                </div>
                {idea.status === "completed" ? (
                  <>
                    <Badge variant={bandBadgeVariant(idea.score_band)}>
                      {idea.score_band ?? "-"}
                    </Badge>
                    <span className="text-lg font-semibold tabular-nums">{idea.score}</span>
                  </>
                ) : (
                  <Badge variant="destructive">실패</Badge>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
