import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { renderDiagramSvg } from "@/lib/diagram/render-svg";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Download } from "lucide-react";
import { RetryButton } from "@/app/ideas/[id]/retry-button";
import type { PatentIdeaRow } from "@/lib/patent-ideas/types";

// retryIdea(재분석)도 submitIdea와 같은 파이프라인을 타므로 동일하게 늘려둔다.
export const maxDuration = 60;

function bandBadgeVariant(band: PatentIdeaRow["score_band"]) {
  if (band === "가능") return "default" as const;
  if (band === "보완") return "secondary" as const;
  return "destructive" as const;
}

function bandFillClass(band: PatentIdeaRow["score_band"]) {
  if (band === "가능") return "bg-primary";
  if (band === "보완") return "bg-secondary-foreground";
  return "bg-destructive";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default async function IdeaResultPage({
  params,
}: PageProps<"/ideas/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  const { data: idea } = await supabase
    .from("patent_ideas")
    .select("*")
    .eq("id", id)
    .single<PatentIdeaRow>();

  if (!idea) notFound();

  const diagramSvg = idea.diagram ? renderDiagramSvg(idea.diagram).svg : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        render={<Link href="/ideas" />}
        nativeButton={false}
      >
        내 아이디어
      </Button>

      <div>
        <h1 className="font-heading text-xl font-semibold text-balance">{idea.title}</h1>
        <p className="text-xs text-muted-foreground">
          {formatDate(idea.created_at)}
          {idea.status === "completed"
            ? ` · 국내 공개 특허 ${idea.prior_arts?.length ?? 0}건 검토`
            : " · 분석이 끝나지 않았습니다"}
        </p>
      </div>

      {idea.status === "failed" && (
        <div className="flex flex-col gap-4">
          <Alert variant="destructive">
            <AlertTitle>
              {idea.failed_step === "search" ? "특허 검색에서 멈췄습니다" : "분석에서 멈췄습니다"}
            </AlertTitle>
            <AlertDescription>
              {idea.error_message ?? "원인을 알 수 없는 오류가 발생했습니다."} 아이디어는
              그대로 저장돼 있으니 다시 시도하면 처음부터 입력할 필요는 없습니다.
            </AlertDescription>
          </Alert>
          <div className="flex gap-2">
            <RetryButton ideaId={idea.id} />
            <Button variant="outline" render={<Link href="/ideas" />} nativeButton={false}>
              목록으로
            </Button>
          </div>
        </div>
      )}

      {idea.status === "completed" && (
        <>
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-7">
              <div className="flex items-baseline gap-1">
                <strong className="text-4xl font-semibold tabular-nums">{idea.score}</strong>
                <span className="text-muted-foreground">/ 100</span>
              </div>
              <div className="flex min-w-56 flex-1 flex-col gap-2">
                <Badge variant={bandBadgeVariant(idea.score_band)} className="w-fit">
                  {idea.score_band}
                </Badge>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${bandFillClass(idea.score_band)}`}
                    style={{ width: `${idea.score}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                  <span>0 출원 불가</span>
                  <span>50 보완 필요</span>
                  <span>70 출원 가능</span>
                  <span>100</span>
                </div>
              </div>
            </div>
            <Separator className="my-5" />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {(idea.criteria ?? []).map((c) => (
                <div key={c.key} className="rounded-md border p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{c.label}</span>
                    <span className="text-sm font-semibold tabular-nums">
                      {c.score} / {c.max}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{c.reason}</p>
                </div>
              ))}
            </div>
            {idea.improvement_points && (
              <>
                <Separator className="my-5" />
                <Alert>
                  <AlertTitle>이 점을 채우면 점수를 높일 수 있습니다</AlertTitle>
                  <AlertDescription>{idea.improvement_points}</AlertDescription>
                </Alert>
              </>
            )}
          </Card>

          {idea.features && idea.features.length > 0 && (
            <Card className="p-5">
              <p className="mb-3 text-sm font-semibold">발명의 특징</p>
              <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                {idea.features.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="text-muted-foreground">·</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {idea.prior_problems && (
            <Card className="p-5">
              <p className="mb-1 text-sm font-semibold">종래 기술의 문제점</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {idea.prior_problems}
              </p>
            </Card>
          )}

          {idea.effects && idea.effects.length > 0 && (
            <Card className="p-5">
              <p className="mb-3 text-sm font-semibold">발명의 효과</p>
              <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                {idea.effects.map((e, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="text-muted-foreground">·</span>
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {idea.keywords && idea.keywords.length > 0 && (
            <Card className="p-5">
              <p className="mb-1 text-sm font-semibold">검색에 사용한 키워드</p>
              <p className="mb-3 text-xs text-muted-foreground">
                아이디어에서 뽑은 말로 검색했습니다. 빠진 표현이 있으면 그 표현을 아이디어에
                넣어 다시 분석하세요.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {idea.keywords.map((k) => (
                  <Badge key={k} variant="secondary">
                    {k}
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-5">
            <p className="mb-1 text-sm font-semibold">겹치는 선행 특허</p>
            <p className="mb-3 text-xs text-muted-foreground">
              검색 결과를 겹침이 큰 순서로 보여줍니다.
            </p>
            {idea.prior_arts && idea.prior_arts.length > 0 ? (
              <div className="flex flex-col gap-3">
                {idea.prior_arts.map((p) => (
                  <div key={p.applicationNumber} className="rounded-md border p-4">
                    <div className="mb-1.5 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-balance">{p.inventionTitle}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {p.publicationNumber || p.applicationNumber}
                          {p.applicantName ? ` · ${p.applicantName}` : ""}
                        </p>
                      </div>
                      <Badge
                        variant={
                          p.overlapLevel === "많이 겹침"
                            ? "destructive"
                            : p.overlapLevel === "일부 겹침"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {p.overlapLevel}
                      </Badge>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {p.overlapDescription}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-[11px] text-muted-foreground">
                        {p.relevantClaims.length > 0
                          ? `청구항 ${p.relevantClaims.join(", ")} 검토`
                          : ""}
                      </span>
                      {p.sourceUrl && (
                        <a
                          href={p.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary underline underline-offset-4"
                        >
                          원문 보기
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                겹치는 선행 특허가 검색되지 않았습니다.
              </p>
            )}
          </Card>

          {diagramSvg && (
            <Card className="p-5">
              <p className="mb-3 text-sm font-semibold">앱이 그린 도면</p>
              <div
                className="overflow-x-auto rounded-md border bg-white p-4"
                // Generated by our own render-svg.ts from a Gemini-produced
                // structured diagram spec, not raw user/model text — safe
                // to render directly. See lib/diagram/render-svg.ts.
                dangerouslySetInnerHTML={{ __html: diagramSvg }}
              />
            </Card>
          )}

          <Card className="flex-row items-center justify-between gap-3 p-5">
            <div>
              <p className="text-sm font-semibold">특허팀에 넘길 문서</p>
              <p className="text-xs text-muted-foreground">
                아이디어 내용, 특징, 도면, 선행 특허 검색 결과가 담긴 PPT입니다.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                render={<a href={`/ideas/${idea.id}/pptx`} download />}
                nativeButton={false}
              >
                <Download data-icon="inline-start" />
                PPT 내려받기
              </Button>
              <Button
                variant="outline"
                render={<Link href="/ideas/new" />}
                nativeButton={false}
              >
                고쳐서 다시 분석
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
