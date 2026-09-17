import type { Diagram, DiagramNode } from "@/lib/diagram/types";

/**
 * Deterministically lays out and renders a Diagram spec as a standalone SVG
 * string with fixed light colors (this becomes a rasterized PPTX image, not
 * a themed on-screen element, so it must look correct without any CSS
 * variables). "flow" diagrams read top-to-bottom; "block" diagrams read
 * left-to-right — matching the two patterns confirmed during shaping.
 */

const NODE_W = 168;
const NODE_H = 70; // 2줄 라벨 + 참조부호가 겹치지 않을 최소 높이
const GAP_MAIN = 64; // between layers, along the reading direction
const GAP_CROSS = 26; // between nodes within the same layer
const PAD = 28;
// "Nanum Gothic" first so lib/pptx/generate-deck.ts's server-side raster
// (which bundles that exact font — see its DIAGRAM_FONT_FAMILY) matches;
// the rest are fallbacks for when this SVG is instead rendered live in a
// browser (see app/ideas/[id]/page.tsx), which resolves fonts by whatever
// the visitor's OS has, unlike the rasterizer's `loadSystemFonts: false`.
const FONT = "'Nanum Gothic', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";

const COLOR = {
  bg: "#ffffff",
  box: "#f4f4f5",
  boxBorder: "#d4d4d8",
  text: "#18181b",
  subtext: "#71717a",
  line: "#71717a",
};

function wrapLabel(label: string, maxCharsPerLine = 10): string[] {
  // Simple greedy wrap by character count (Korean has no natural word-break
  // requirement, so wrapping mid-phrase is acceptable for a diagram label).
  const lines: string[] = [];
  let current = "";
  for (const ch of label) {
    if (current.length >= maxCharsPerLine && ch !== " ") {
      lines.push(current.trim());
      current = "";
    }
    current += ch;
  }
  if (current.trim()) lines.push(current.trim());
  return lines.slice(0, 2);
}

function computeLayers(diagram: Diagram): Map<string, number> {
  const ids = diagram.nodes.map((n) => n.id);
  const incoming = new Map<string, Set<string>>(ids.map((id) => [id, new Set()]));
  for (const e of diagram.edges) {
    if (incoming.has(e.to) && incoming.has(e.from)) {
      incoming.get(e.to)!.add(e.from);
    }
  }

  const layer = new Map<string, number>();
  const resolving = new Set<string>();

  function resolve(id: string): number {
    if (layer.has(id)) return layer.get(id)!;
    if (resolving.has(id)) return 0; // cycle guard
    resolving.add(id);
    const preds = [...(incoming.get(id) ?? [])];
    const depth = preds.length === 0 ? 0 : Math.max(...preds.map(resolve)) + 1;
    layer.set(id, depth);
    resolving.delete(id);
    return depth;
  }

  for (const id of ids) resolve(id);
  return layer;
}

type Placed = { node: DiagramNode; layer: number; indexInLayer: number; x: number; y: number };

function layoutNodes(diagram: Diagram): Map<string, Placed> {
  const layers = computeLayers(diagram);
  const byLayer = new Map<number, DiagramNode[]>();
  for (const node of diagram.nodes) {
    const l = layers.get(node.id) ?? 0;
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l)!.push(node);
  }

  const maxCount = Math.max(1, ...[...byLayer.values()].map((n) => n.length));
  const crossExtent = maxCount * NODE_H + (maxCount - 1) * GAP_CROSS;

  const placed = new Map<string, Placed>();
  for (const [l, nodes] of byLayer) {
    const extent = nodes.length * NODE_H + (nodes.length - 1) * GAP_CROSS;
    const crossStart = (crossExtent - extent) / 2;
    nodes.forEach((node, i) => {
      const along = PAD + l * (diagram.kind === "flow" ? NODE_H + GAP_MAIN : NODE_W + GAP_MAIN);
      const cross = PAD + crossStart + i * (NODE_H + GAP_CROSS);
      placed.set(node.id, {
        node,
        layer: l,
        indexInLayer: i,
        x: diagram.kind === "flow" ? cross : along,
        y: diagram.kind === "flow" ? along : cross,
      });
    });
  }
  return placed;
}

function boxCenter(p: Placed): [number, number] {
  return [p.x + NODE_W / 2, p.y + NODE_H / 2];
}

function edgePath(
  from: Placed,
  to: Placed,
  kind: Diagram["kind"],
): { d: string; labelX: number; labelY: number } {
  const [fx, fy] = boxCenter(from);
  const [tx, ty] = boxCenter(to);
  const forward = kind === "flow" ? to.y > from.y : to.x > from.x;

  if (forward && from.layer !== to.layer) {
    // Straight connector between box borders along the reading direction.
    if (kind === "flow") {
      const y1 = from.y + NODE_H;
      const y2 = to.y;
      return { d: `M ${fx} ${y1} L ${tx} ${y2}`, labelX: (fx + tx) / 2 + 10, labelY: (y1 + y2) / 2 };
    }
    const x1 = from.x + NODE_W;
    const x2 = to.x;
    return { d: `M ${x1} ${fy} L ${x2} ${ty}`, labelX: (x1 + x2) / 2, labelY: (fy + ty) / 2 - 8 };
  }

  // Same-layer or backward edge: route as an elbow to the side so it never
  // crosses through a box.
  if (kind === "flow") {
    const side = Math.max(from.x + NODE_W, to.x + NODE_W) + 46;
    const y1 = fy;
    const y2 = ty;
    return {
      d: `M ${from.x + NODE_W} ${y1} L ${side} ${y1} L ${side} ${y2} L ${to.x + NODE_W} ${y2}`,
      labelX: side + 6,
      labelY: (y1 + y2) / 2,
    };
  }
  const side = Math.max(from.y + NODE_H, to.y + NODE_H) + 40;
  const x1 = fx;
  const x2 = tx;
  return {
    d: `M ${x1} ${from.y + NODE_H} L ${x1} ${side} L ${x2} ${side} L ${x2} ${to.y + NODE_H}`,
    labelX: (x1 + x2) / 2,
    labelY: side + 14,
  };
}

export function renderDiagramSvg(diagram: Diagram): { svg: string; width: number; height: number } {
  const placed = layoutNodes(diagram);
  const values = [...placed.values()];
  const maxX = Math.max(NODE_W, ...values.map((p) => p.x + NODE_W)) + PAD + 60;
  const maxY = Math.max(NODE_H, ...values.map((p) => p.y + NODE_H)) + PAD + 40;

  const boxes = values
    .map((p) => {
      const lines = wrapLabel(p.node.label);
      const lineEls = lines
        .map(
          (line, i) =>
            `<text x="${p.x + NODE_W / 2}" y="${
              p.y + NODE_H / 2 - ((lines.length - 1) * 15) / 2 + i * 15 + 5
            }" text-anchor="middle" font-size="13" fill="${COLOR.text}" font-family="${FONT}">${escapeXml(line)}</text>`,
        )
        .join("");
      const refEl = p.node.refNo
        ? `<text x="${p.x + NODE_W / 2}" y="${p.y + NODE_H - 8}" text-anchor="middle" font-size="11" fill="${COLOR.subtext}" font-family="${FONT}">(${escapeXml(p.node.refNo)})</text>`
        : "";
      return (
        `<rect x="${p.x}" y="${p.y}" width="${NODE_W}" height="${NODE_H}" rx="8" ` +
        `fill="${COLOR.box}" stroke="${COLOR.boxBorder}" stroke-width="1.2"/>` +
        lineEls +
        refEl
      );
    })
    .join("");

  const edges = diagram.edges
    .map((e) => {
      const from = placed.get(e.from);
      const to = placed.get(e.to);
      if (!from || !to) return "";
      const { d, labelX, labelY } = edgePath(from, to, diagram.kind);
      const label = e.label
        ? `<text x="${labelX}" y="${labelY}" font-size="11" fill="${COLOR.subtext}" font-family="${FONT}">${escapeXml(e.label)}</text>`
        : "";
      return (
        `<path d="${d}" fill="none" stroke="${COLOR.line}" stroke-width="1.4" marker-end="url(#arrow)"/>` +
        label
      );
    })
    .join("");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${maxX} ${maxY}" width="${maxX}" height="${maxY}">` +
    `<rect x="0" y="0" width="${maxX}" height="${maxY}" fill="${COLOR.bg}"/>` +
    `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">` +
    `<path d="M 0 0 L 10 5 L 0 10 z" fill="${COLOR.line}"/></marker></defs>` +
    edges +
    boxes +
    `</svg>`;

  return { svg, width: maxX, height: maxY };
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
