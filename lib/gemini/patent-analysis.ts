import { getGeminiClient, GEMINI_MODEL } from "@/lib/gemini/client";
import {
  SUFFICIENCY_RESPONSE_SCHEMA,
  KEYWORDS_RESPONSE_SCHEMA,
  ANALYSIS_RESPONSE_SCHEMA,
} from "@/lib/gemini/response-schemas";
import {
  SufficiencySchema,
  KeywordsSchema,
  AnalysisSchema,
  type Sufficiency,
  type Analysis,
} from "@/lib/gemini/schemas";
import type { PriorArtCandidate } from "@/lib/kipris/types";

function parseJson(text: string | undefined): unknown {
  if (!text) throw new Error("Gemini가 빈 응답을 반환했습니다.");
  return JSON.parse(text);
}

/**
 * Judges whether the idea already carries enough detail to be scored well,
 * and if not, what to ask for. This is the app's single "되묻기" gate — see
 * docs/specs/patent-idea-to-proposal/spec.md acceptance criteria 1-2.
 */
export async function checkIdeaSufficiency(ideaBody: string): Promise<Sufficiency> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: ideaBody,
    config: {
      systemInstruction:
        "당신은 한국 특허 출원 가능성을 판단하는 심사관 보조입니다. 사용자가 적은 특허 " +
        "아이디어 초안을 보고, 뒤에 이어질 분석(구체성/신규성/진보성 평가와 선행 특허 " +
        "겹침 판단)을 제대로 할 수 있을 만큼 정보가 충분한지 판단하세요. " +
        "충분하다는 것은 (1) 어떤 문제를 해결하는지, (2) 무엇이 무엇을 측정/판단해서 " +
        "어떻게 동작하는지, (3) 기존 방식과 다른 점이 이미 드러나 있다는 뜻입니다. " +
        "하나라도 비어 있으면 sufficient를 false로 하고, 그 항목만 missing에 담으세요. " +
        "짧은 한두 문장짜리 초안이라도 세 가지가 실제로 다 담겨 있다면 true로 판단하세요.",
      responseMimeType: "application/json",
      responseSchema: SUFFICIENCY_RESPONSE_SCHEMA,
    },
  });

  try {
    return SufficiencySchema.parse(parseJson(response.text));
  } catch {
    return {
      sufficient: false,
      missing: [
        {
          id: "mechanism",
          label: "핵심 구성과 동작",
          description: "무엇이 무엇을 측정하고, 그 값으로 어떤 판단을 하는지 적으세요.",
          placeholder: "",
        },
      ],
    };
  }
}

/** Extracts Korean search phrases for the KIPRIS full-text search. */
export async function extractSearchKeywords(fullText: string): Promise<string[]> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: fullText,
    config: {
      systemInstruction:
        "특허 아이디어 설명에서 한국 특허 전문 검색(KIPRIS)에 넣을 검색어를 뽑으세요. " +
        "너무 일반적인 단어(예: 장치, 방법, 시스템) 단독으로는 쓰지 말고, 핵심 기술 " +
        "명사구를 2~6개 뽑으세요.",
      responseMimeType: "application/json",
      responseSchema: KEYWORDS_RESPONSE_SCHEMA,
    },
  });
  const parsed = KeywordsSchema.parse(parseJson(response.text));
  return parsed.keywords;
}

const CRITERION_MAX = { concreteness: 30, novelty: 40, inventiveness: 30 } as const;

function candidatesToPrompt(candidates: PriorArtCandidate[]): string {
  return candidates
    .map((c, i) =>
      [
        `[후보 ${i + 1}] applicationNumber: ${c.applicationNumber}`,
        `발명의 명칭: ${c.inventionTitle}`,
        `공개/등록 상태: ${c.registerStatus}, 공개일: ${c.openDate || c.publicationDate || "미상"}`,
        `초록: ${c.abstract}`,
        c.claims.length > 0
          ? `청구항 일부:\n${c.claims.slice(0, 3).join("\n")}`
          : "청구항: (조회되지 않음)",
      ].join("\n"),
    )
    .join("\n\n");
}

/**
 * The main judgment call: scores the idea against KIPRIS search results,
 * picks the prior art that actually overlaps, and produces the diagram
 * spec this app renders and embeds in the PPTX.
 */
export async function analyzeIdea(
  fullText: string,
  candidates: PriorArtCandidate[],
): Promise<{ analysis: Analysis; score: number; scoreBand: "가능" | "보완" | "불가" }> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents:
      `# 아이디어\n${fullText}\n\n# 검색된 선행 특허/실용신안 후보\n` +
      (candidates.length > 0
        ? candidatesToPrompt(candidates)
        : "(검색 결과 없음 — 겹치는 선행 특허가 없다고 보고 판단하세요)"),
    config: {
      systemInstruction:
        "당신은 한국 특허 출원 가능성을 판단하는 심사관 보조입니다. 사용자의 특허 " +
        "아이디어와, 검색으로 찾은 선행 특허/실용신안 후보 목록을 받습니다.\n\n" +
        "다음을 수행하세요:\n" +
        `1. 구체성(0~${CRITERION_MAX.concreteness}점): 청구항으로 옮길 수 있을 만큼 측정 대상, ` +
        "판정 조건, 동작 구간이 특정되어 있는지.\n" +
        `2. 신규성(0~${CRITERION_MAX.novelty}점): 후보들과 비교했을 때 이미 공개된 구성과 ` +
        "얼마나 겹치는지. 겹칠수록 낮은 점수.\n" +
        `3. 진보성(0~${CRITERION_MAX.inventiveness}점): 겹치는 후보가 있어도 효과나 구성상 ` +
        "차이로 통상의 기술자가 쉽게 떠올리기 어려운지.\n" +
        "4. 후보 중 실제로 겹치는 것만 골라(최대 5개, 겹침이 큰 순서) overlapDescription을 " +
        "쓰세요. 청구항 일부를 좁히거나 추가하면 그 선행 특허를 비켜갈 수 있다고 판단되면 " +
        "그 사실을 overlapDescription에 명시하고, 그만큼 진보성/신규성 점수를 더 높게 " +
        "주세요. 반대로 독립항 전체가 이미 그대로 청구되어 있어 종속항을 더해도 권리 " +
        "범위를 벗어날 수 없다면 그 사실도 명시하고 점수를 낮게 주세요.\n" +
        "5. 총점이 70 미만이면 무엇을 채워야 70을 넘는지 improvementPoints에 적으세요. " +
        "70 이상이면 improvementPoints는 null로 두세요.\n" +
        "6. 아이디어를 가장 잘 표현하는 도면 하나를 diagram으로 설계하세요. 판정 순서나 " +
        "동작 절차가 핵심이면 kind: 'flow'로 단계를 순서대로, 구성 요소 사이의 신호 " +
        "흐름이 핵심이면 kind: 'block'으로 설계하세요. 각 node에는 특허 도면다운 참조" +
        "부호(refNo)를 100 단위로 붙이세요.\n" +
        "7. features, priorProblems, effects는 심사 근거(위 1~3번 reason)와는 다른, " +
        "특허팀에 넘길 명세서 관점의 글입니다. 점수 근거를 그대로 옮기지 마세요.\n" +
        "   - features: 청구항으로 옮길 수 있을 만큼 구체적인 기술 특징을 2~6개 " +
        "불릿으로 쓰세요. diagram의 node와 대응되는 특징이면 그 node의 refNo를 " +
        "문장 끝에 자연스럽게 붙이세요(예: '토양 수분과 조도를 실시간으로 측정한다 " +
        "(100)').\n" +
        "   - priorProblems: 선행 특허와의 겹침과는 무관하게, 이 아이디어가 해결하려는 " +
        "기존 기술/방식 자체의 한계를 한 문단으로 서술하세요.\n" +
        "   - effects: 이 발명을 실제로 적용했을 때 얻는 효과를 1~5개 불릿으로 " +
        "쓰세요.",
      responseMimeType: "application/json",
      responseSchema: ANALYSIS_RESPONSE_SCHEMA,
    },
  });

  const analysis = AnalysisSchema.parse(parseJson(response.text));

  const concreteness = Math.min(analysis.concreteness.score, CRITERION_MAX.concreteness);
  const novelty = Math.min(analysis.novelty.score, CRITERION_MAX.novelty);
  const inventiveness = Math.min(analysis.inventiveness.score, CRITERION_MAX.inventiveness);
  const score = concreteness + novelty + inventiveness;
  const scoreBand = score >= 70 ? "가능" : score >= 50 ? "보완" : "불가";

  return {
    analysis: {
      ...analysis,
      concreteness: { ...analysis.concreteness, score: concreteness },
      novelty: { ...analysis.novelty, score: novelty },
      inventiveness: { ...analysis.inventiveness, score: inventiveness },
    },
    score,
    scoreBand,
  };
}
