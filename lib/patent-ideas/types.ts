import type { Diagram } from "@/lib/diagram/types";
import type { OverlapLevel } from "@/lib/gemini/schemas";

export type Clarifications = {
  problem?: string;
  mechanism?: string;
  differentiation?: string;
};

export type CriterionResult = {
  key: "concreteness" | "novelty" | "inventiveness";
  label: string;
  score: number;
  max: number;
  reason: string;
};

export type PriorArtResult = {
  applicationNumber: string;
  publicationNumber: string;
  inventionTitle: string;
  applicantName: string;
  openDate: string;
  overlapLevel: OverlapLevel;
  overlapDescription: string;
  relevantClaims: string[];
  sourceUrl: string;
};

export type ScoreBand = "가능" | "보완" | "불가";

/** Row shape of public.patent_ideas — see supabase/patent_ideas.sql. */
export type PatentIdeaRow = {
  id: string;
  user_id: string;
  title: string;
  original_input: string;
  clarifications: Clarifications | null;
  status: "completed" | "failed";
  failed_step: "search" | "analysis" | null;
  error_message: string | null;
  score: number | null;
  score_band: ScoreBand | null;
  criteria: CriterionResult[] | null;
  keywords: string[] | null;
  prior_arts: PriorArtResult[] | null;
  improvement_points: string | null;
  diagram: Diagram | null;
  features: string[] | null;
  prior_problems: string | null;
  effects: string[] | null;
  created_at: string;
};
