/**
 * Structured "diagram code" that Gemini generates and this app renders
 * deterministically to SVG (see render-svg.ts), rather than asking an
 * image-generation model to draw a picture. This keeps every label legible
 * and every box/arrow relationship exact — both required for a diagram a
 * patent team will actually read. See docs/specs/patent-idea-to-proposal/spec.md
 * ("확정된 제약").
 */
export type DiagramNode = {
  id: string;
  label: string;
  /** Optional reference numeral shown under the label, e.g. "110". */
  refNo?: string;
};

export type DiagramEdge = {
  from: string;
  to: string;
  label?: string;
};

export type Diagram = {
  /**
   * "flow": a sequence of steps/decisions, laid out top-to-bottom.
   * "block": components and the signals between them, laid out left-to-right.
   */
  kind: "flow" | "block";
  title: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
};
