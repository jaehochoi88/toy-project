"use server";

import { createClient } from "@/lib/supabase/server";
import { checkIdeaSufficiency, extractSearchKeywords, analyzeIdea } from "@/lib/gemini/patent-analysis";
import { searchPatents } from "@/lib/kipris/client";
import type { MissingItem } from "@/lib/gemini/schemas";
import type { Clarifications, CriterionResult, PriorArtResult } from "@/lib/patent-ideas/types";

export type SubmitIdeaResult =
  | { status: "needs_clarification"; questions: MissingItem[] }
  | { status: "done"; ideaId: string }
  | { status: "error"; message: string };

const CRITERION_LABELS = {
  concreteness: "구체성",
  novelty: "신규성",
  inventiveness: "진보성",
} as const;

function buildFullText(body: string, clarifications?: Clarifications): string {
  if (!clarifications) return body;
  const parts = [body];
  if (clarifications.problem) parts.push(`해결하려는 문제: ${clarifications.problem}`);
  if (clarifications.mechanism) parts.push(`핵심 구성과 동작: ${clarifications.mechanism}`);
  if (clarifications.differentiation)
    parts.push(`기존 방식과 다른 점: ${clarifications.differentiation}`);
  return parts.join("\n\n");
}

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) throw new Error("로그인이 필요합니다.");
  return userId;
}

/** Runs the KIPRIS search + Gemini judgment pipeline and writes one row.
 * Any failure inside the pipeline is persisted as a "failed" row (with the
 * step it failed at) rather than thrown, so the user still gets an idea
 * page they can retry from — see spec.md acceptance criterion 15. */
async function runPipelineAndPersist(
  userId: string,
  body: string,
  clarifications: Clarifications | undefined,
  existingIdeaId?: string,
): Promise<string> {
  const supabase = await createClient();
  const fullText = buildFullText(body, clarifications);

  let keywords: string[] = [];
  try {
    keywords = await extractSearchKeywords(fullText);
  } catch (error) {
    keywords = [];
    // Keyword extraction failing isn't fatal — fall through to an empty
    // search below, which Gemini is instructed to treat as "no prior art
    // found" rather than crashing the whole pipeline.
    console.error("extractSearchKeywords failed", error);
  }

  const baseRow = {
    user_id: userId,
    title: body.slice(0, 60),
    original_input: body,
    clarifications: clarifications ?? null,
  };

  let candidates: Awaited<ReturnType<typeof searchPatents>> = [];
  try {
    candidates = keywords.length > 0 ? await searchPatents(keywords) : [];
  } catch (error) {
    const message = error instanceof Error ? error.message : "선행 특허 검색에 실패했습니다.";
    return persistFailure(supabase, existingIdeaId, { ...baseRow, failed_step: "search", error_message: message });
  }

  try {
    const { analysis, score, scoreBand } = await analyzeIdea(fullText, candidates);

    const criteria: CriterionResult[] = (
      ["concreteness", "novelty", "inventiveness"] as const
    ).map((key) => ({
      key,
      label: CRITERION_LABELS[key],
      score: analysis[key].score,
      max: key === "novelty" ? 40 : 30,
      reason: analysis[key].reason,
    }));

    const priorArts: PriorArtResult[] = analysis.priorArts.map((judged) => {
      const candidate = candidates.find((c) => c.applicationNumber === judged.applicationNumber);
      return {
        applicationNumber: judged.applicationNumber,
        publicationNumber: candidate?.publicationNumber ?? "",
        inventionTitle: candidate?.inventionTitle ?? judged.applicationNumber,
        applicantName: candidate?.applicantName ?? "",
        openDate: candidate?.openDate ?? candidate?.publicationDate ?? "",
        overlapLevel: judged.overlapLevel,
        overlapDescription: judged.overlapDescription,
        relevantClaims: judged.relevantClaims,
        sourceUrl: candidate?.sourceUrl ?? "",
      };
    });

    const completeRow = {
      ...baseRow,
      title: analysis.title,
      status: "completed" as const,
      failed_step: null,
      error_message: null,
      score,
      score_band: scoreBand,
      criteria,
      keywords,
      prior_arts: priorArts,
      improvement_points: analysis.improvementPoints,
      diagram: analysis.diagram,
      features: analysis.features,
      prior_problems: analysis.priorProblems,
      effects: analysis.effects,
    };

    if (existingIdeaId) {
      const { error } = await supabase.from("patent_ideas").update(completeRow).eq("id", existingIdeaId);
      if (error) throw new Error(error.message);
      return existingIdeaId;
    }
    const { data, error } = await supabase.from("patent_ideas").insert(completeRow).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "저장에 실패했습니다.");
    return data.id as string;
  } catch (error) {
    const message = error instanceof Error ? error.message : "분석에 실패했습니다.";
    return persistFailure(supabase, existingIdeaId, { ...baseRow, failed_step: "analysis", error_message: message });
  }
}

async function persistFailure(
  supabase: Awaited<ReturnType<typeof createClient>>,
  existingIdeaId: string | undefined,
  row: {
    user_id: string;
    title: string;
    original_input: string;
    clarifications: Clarifications | null;
    failed_step: "search" | "analysis";
    error_message: string;
  },
): Promise<string> {
  const failedRow = { ...row, status: "failed" as const, score: null, score_band: null };
  if (existingIdeaId) {
    const { error } = await supabase.from("patent_ideas").update(failedRow).eq("id", existingIdeaId);
    if (error) throw new Error(error.message);
    return existingIdeaId;
  }
  const { data, error } = await supabase.from("patent_ideas").insert(failedRow).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "저장에 실패했습니다.");
  return data.id as string;
}

export async function submitIdea(input: {
  body: string;
  clarifications?: Clarifications;
}): Promise<SubmitIdeaResult> {
  const body = input.body.trim();
  if (!body) return { status: "error", message: "아이디어를 입력하세요." };

  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { status: "error", message: "로그인이 필요합니다." };
  }

  if (!input.clarifications) {
    try {
      const sufficiency = await checkIdeaSufficiency(body);
      if (!sufficiency.sufficient && sufficiency.missing.length > 0) {
        return { status: "needs_clarification", questions: sufficiency.missing };
      }
    } catch (error) {
      // If the sufficiency check itself fails, don't block the user —
      // proceed straight to the full pipeline, which will surface any
      // real failure as a "failed" idea the user can retry.
      console.error("checkIdeaSufficiency failed", error);
    }
  }

  try {
    const ideaId = await runPipelineAndPersist(userId, body, input.clarifications);
    return { status: "done", ideaId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return { status: "error", message };
  }
}

export async function retryIdea(
  ideaId: string,
): Promise<{ status: "done" } | { status: "error"; message: string }> {
  const supabase = await createClient();
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { status: "error", message: "로그인이 필요합니다." };
  }

  const { data: row, error } = await supabase
    .from("patent_ideas")
    .select("original_input, clarifications, user_id")
    .eq("id", ideaId)
    .single();

  if (error || !row || row.user_id !== userId) {
    return { status: "error", message: "해당 아이디어를 찾을 수 없습니다." };
  }

  try {
    await runPipelineAndPersist(
      userId,
      row.original_input,
      (row.clarifications as Clarifications | null) ?? undefined,
      ideaId,
    );
    return { status: "done" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return { status: "error", message };
  }
}
