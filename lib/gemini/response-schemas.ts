import { Type, type Schema } from "@google/genai";

/**
 * Gemini-native response schemas (config.responseSchema) that guide
 * generation. These mirror lib/gemini/schemas.ts's zod schemas by shape;
 * the zod schemas remain the source of truth for validating what actually
 * comes back.
 */

export const SUFFICIENCY_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    sufficient: { type: Type.BOOLEAN },
    missing: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, enum: ["problem", "mechanism", "differentiation"] },
          label: { type: Type.STRING },
          description: { type: Type.STRING },
          placeholder: { type: Type.STRING },
        },
        required: ["id", "label", "description", "placeholder"],
      },
    },
  },
  required: ["sufficient", "missing"],
};

export const KEYWORDS_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["keywords"],
};

const criterionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.INTEGER },
    reason: { type: Type.STRING },
  },
  required: ["score", "reason"],
};

const diagramNodeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    label: { type: Type.STRING },
    refNo: { type: Type.STRING },
  },
  required: ["id", "label"],
};

const diagramEdgeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    from: { type: Type.STRING },
    to: { type: Type.STRING },
    label: { type: Type.STRING },
  },
  required: ["from", "to"],
};

export const ANALYSIS_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    concreteness: criterionSchema,
    novelty: criterionSchema,
    inventiveness: criterionSchema,
    priorArts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          applicationNumber: { type: Type.STRING },
          overlapLevel: {
            type: Type.STRING,
            enum: ["많이 겹침", "일부 겹침", "거의 겹치지 않음"],
          },
          overlapDescription: { type: Type.STRING },
          relevantClaims: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["applicationNumber", "overlapLevel", "overlapDescription"],
      },
    },
    improvementPoints: { type: Type.STRING, nullable: true },
    diagram: {
      type: Type.OBJECT,
      properties: {
        kind: { type: Type.STRING, enum: ["flow", "block"] },
        title: { type: Type.STRING },
        nodes: { type: Type.ARRAY, items: diagramNodeSchema },
        edges: { type: Type.ARRAY, items: diagramEdgeSchema },
      },
      required: ["kind", "title", "nodes", "edges"],
    },
    features: { type: Type.ARRAY, items: { type: Type.STRING } },
    priorProblems: { type: Type.STRING },
    effects: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    "title",
    "concreteness",
    "novelty",
    "inventiveness",
    "priorArts",
    "improvementPoints",
    "diagram",
    "features",
    "priorProblems",
    "effects",
  ],
};
