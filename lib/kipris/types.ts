/** A single KIPRIS search hit, enriched with claim text where available. */
export type PriorArtCandidate = {
  applicationNumber: string;
  publicationNumber: string;
  applicantName: string;
  inventionTitle: string;
  abstract: string;
  /** Raw KIPRIS date strings (YYYYMMDD), possibly empty. */
  openDate: string;
  publicationDate: string;
  registerStatus: string;
  /** Claim text pulled from the detail API, when it succeeded. */
  claims: string[];
  /** Best-effort link a user can follow to read the source themselves. */
  sourceUrl: string;
};
