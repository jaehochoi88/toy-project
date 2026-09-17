import { z } from "zod";

/**
 * Runtime validation for Gemini's structured JSON output. The Gemini-native
 * response schema that guides generation lives in response-schemas.ts —
 * these zod schemas are the independent check that what came back actually
 * matches, since a model can still emit JSON that satisfies its own schema
 * loosely (e.g. an out-of-range score) without this catching it.
 */

export const MissingItemSchema = z.object({
  id: z.enum(["problem", "mechanism", "differentiation"]),
  label: z.string(),
  description: z.string(),
  placeholder: z.string(),
});
export type MissingItem = z.infer<typeof MissingItemSchema>;

export const SufficiencySchema = z.object({
  sufficient: z.boolean(),
  missing: z.array(MissingItemSchema).max(3),
});
export type Sufficiency = z.infer<typeof SufficiencySchema>;

export const KeywordsSchema = z.object({
  keywords: z.array(z.string()).min(1).max(6),
});

const CriterionSchema = z.object({
  score: z.number().int().min(0),
  reason: z.string(),
});

const OverlapLevelSchema = z.enum(["많이 겹침", "일부 겹침", "거의 겹치지 않음"]);
export type OverlapLevel = z.infer<typeof OverlapLevelSchema>;

export const PriorArtJudgmentSchema = z.object({
  applicationNumber: z.string(),
  overlapLevel: OverlapLevelSchema,
  overlapDescription: z.string(),
  relevantClaims: z.array(z.string()).default([]),
});

const DiagramNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  refNo: z.string().optional(),
});

const DiagramEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
});

export const DiagramSchema = z.object({
  kind: z.enum(["flow", "block"]),
  title: z.string(),
  nodes: z.array(DiagramNodeSchema).min(2).max(8),
  edges: z.array(DiagramEdgeSchema).min(1).max(12),
});

export const AnalysisSchema = z.object({
  title: z.string(),
  concreteness: CriterionSchema,
  novelty: CriterionSchema,
  inventiveness: CriterionSchema,
  priorArts: z.array(PriorArtJudgmentSchema).max(5),
  improvementPoints: z.string().nullable(),
  diagram: DiagramSchema,
  // 명세서 관점 콘텐츠 — 점수 근거(reason)와는 별개로, 특허팀에 넘길 PPT/화면에
  // 쓰인다. see docs/specs/patent-idea-to-proposal/spec.md AC 11.
  features: z.array(z.string()).min(1).max(6),
  priorProblems: z.string(),
  effects: z.array(z.string()).min(1).max(5),
});
export type Analysis = z.infer<typeof AnalysisSchema>;
