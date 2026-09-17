import { XMLParser } from "fast-xml-parser";
import type { PriorArtCandidate } from "@/lib/kipris/types";

/**
 * KIPRIS Plus (한국특허정보원) open API. See AGENTS.md's "외부 서비스 문서 조회"
 * section for the current API specification to consult before changing this
 * file — request/response shapes here were confirmed against a live call
 * with the project's own KIPRIS_SERVICE_KEY, not from the (paywalled) PDF
 * spec.
 */
const WORD_SEARCH_URL =
  "https://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getWordSearch";
const DETAIL_URL =
  "https://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getBibliographyDetailInfoSearch";

const SEARCH_POOL_SIZE = 15;
const CLAIM_FETCH_LIMIT = 8;
const CLAIMS_PER_CANDIDATE = 3;

const parser = new XMLParser({
  ignoreAttributes: true,
  isArray: (name) => ["item", "claimInfo"].includes(name),
});

function getServiceKey(): string {
  const key = process.env.KIPRIS_SERVICE_KEY;
  if (!key) {
    throw new Error("KIPRIS_SERVICE_KEY is not set. Add it to .env.local.");
  }
  return key;
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function assertSuccess(body: unknown, context: string) {
  const header = (body as { response?: { header?: Record<string, unknown> } })?.response
    ?.header;
  if (!header || textOf(header.successYN) !== "Y") {
    const message = textOf(header?.resultMsg) || "알 수 없는 오류";
    throw new Error(`KIPRIS ${context} 실패: ${message}`);
  }
}

/** Runs a keyword search and returns raw hits, cheapest call first. */
async function searchWordHits(keywords: string[]): Promise<
  Array<{
    applicationNumber: string;
    publicationNumber: string;
    applicantName: string;
    inventionTitle: string;
    abstract: string;
    openDate: string;
    publicationDate: string;
    registerStatus: string;
  }>
> {
  const url = new URL(WORD_SEARCH_URL);
  url.searchParams.set("word", keywords.join(" "));
  url.searchParams.set("patent", "true");
  url.searchParams.set("utility", "true");
  url.searchParams.set("numOfRows", String(SEARCH_POOL_SIZE));
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("ServiceKey", getServiceKey());

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`KIPRIS 검색 요청이 실패했습니다 (HTTP ${res.status}).`);
  }
  const xml = await res.text();
  const body = parser.parse(xml);
  assertSuccess(body, "검색");

  const rawItems: unknown[] = body?.response?.body?.items?.item ?? [];
  return rawItems.map((raw) => {
    const item = raw as Record<string, unknown>;
    return {
      applicationNumber: textOf(item.applicationNumber),
      publicationNumber: textOf(item.publicationNumber) || textOf(item.openNumber),
      applicantName: textOf(item.applicantName),
      inventionTitle: textOf(item.inventionTitle),
      abstract: textOf(item.astrtCont),
      openDate: textOf(item.openDate),
      publicationDate: textOf(item.publicationDate),
      registerStatus: textOf(item.registerStatus),
    };
  });
}

/** Fetches claim text for one application. Returns [] on any failure — the
 * candidate is still usable for title/abstract-level judgment without it. */
async function fetchClaims(applicationNumber: string): Promise<string[]> {
  try {
    const url = new URL(DETAIL_URL);
    url.searchParams.set("applicationNumber", applicationNumber);
    url.searchParams.set("ServiceKey", getServiceKey());

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const body = parser.parse(await res.text());
    assertSuccess(body, "상세 조회");

    const claimInfos: unknown[] =
      body?.response?.body?.item?.claimInfoArray?.claimInfo ?? [];
    return claimInfos
      .map((c) => textOf((c as Record<string, unknown>).claim))
      .filter(Boolean)
      .slice(0, CLAIMS_PER_CANDIDATE);
  } catch {
    return [];
  }
}

function sourceUrlFor(publicationNumber: string, applicationNumber: string): string {
  const number = publicationNumber || applicationNumber;
  // KIPRIS Plus doesn't expose a stable public deep-link for a single
  // application in its API response, and the public kipris.or.kr search
  // page's own URL scheme couldn't be confirmed at implementation time —
  // see docs/follow-ups/kipris-source-link.md.
  return `https://www.google.com/search?q=${encodeURIComponent(`${number} KIPRIS`)}`;
}

/**
 * Searches KIPRIS for the given keywords and returns a pool of candidates
 * with claim text where available, for Gemini to judge overlap against.
 */
export async function searchPatents(keywords: string[]): Promise<PriorArtCandidate[]> {
  const hits = await searchWordHits(keywords);

  const withClaims = await Promise.all(
    hits.map(async (hit, index) => ({
      ...hit,
      claims: index < CLAIM_FETCH_LIMIT ? await fetchClaims(hit.applicationNumber) : [],
      sourceUrl: sourceUrlFor(hit.publicationNumber, hit.applicationNumber),
    })),
  );

  return withClaims;
}
