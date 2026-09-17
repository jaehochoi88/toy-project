import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | undefined;

export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY is not set. Add it to .env.local to analyze patent ideas.",
      );
    }
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

/**
 * As of this project's implementation (2026-09), gemini-2.5-flash is no
 * longer available to new Gemini API keys — the API itself points new
 * projects at this model. See AGENTS.md's "외부 서비스 문서 조회" for where
 * to re-check this before changing it.
 */
export const GEMINI_MODEL = "gemini-3.6-flash";
