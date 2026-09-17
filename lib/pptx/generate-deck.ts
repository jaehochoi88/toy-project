import path from "node:path";
import PptxGenJS from "pptxgenjs";
import { Resvg } from "@resvg/resvg-js";
import { renderDiagramSvg } from "@/lib/diagram/render-svg";
import type { PatentIdeaRow } from "@/lib/patent-ideas/types";

// Bundled so the diagram renders identically everywhere, including a
// deployment platform's serverless runtime, which normally has no CJK
// fonts installed — without this, Korean text in the rasterized diagram
// comes out as tofu boxes (□□□). resvg-js is given this file directly
// (loadSystemFonts: false) instead of asking the OS/fontconfig for a
// font by name, which is what made "Malgun Gothic" work only on the
// developer's own Windows machine. SIL OFL-licensed — see fonts/OFL.txt.
const DIAGRAM_FONT_PATH = path.join(process.cwd(), "lib/pptx/fonts/NanumGothic-Regular.ttf");
const DIAGRAM_FONT_FAMILY = "Nanum Gothic";

const NAVY = "1E3A5F";
const INK = "27272A";
const MUTED = "71717A";
const LINE = "D4D4D8";

// pptx.layout = "LAYOUT_WIDE" is 13.33in x 7.5in — every slide's content
// box uses this full width (with a 0.4in margin each side), not the 10in
// width of LAYOUT_16x9. Getting this wrong is why the diagram used to look
// tiny and off-center: it was sized/centered as if the slide were 10in wide.
const SLIDE_W = 13.33;
const MARGIN = 0.4;
const CONTENT_W = SLIDE_W - MARGIN * 2;

function addSlideHeading(slide: PptxGenJS.Slide, no: number, title: string) {
  slide.addText(`${no}`, {
    x: MARGIN,
    y: 0.35,
    w: 0.6,
    h: 0.5,
    fontSize: 12,
    color: MUTED,
    fontFace: "Malgun Gothic",
  });
  slide.addText(title, {
    x: 1.0,
    y: 0.3,
    w: CONTENT_W - 0.6,
    h: 0.6,
    fontSize: 22,
    bold: true,
    color: NAVY,
    fontFace: "Malgun Gothic",
  });
  slide.addShape("line", {
    x: MARGIN,
    y: 0.95,
    w: CONTENT_W,
    h: 0,
    line: { color: LINE, width: 1 },
  });
}

async function diagramToPngDataUri(idea: PatentIdeaRow): Promise<{
  data: string;
  aspectRatio: number;
} | null> {
  if (!idea.diagram) return null;
  const { svg, width, height } = renderDiagramSvg(idea.diagram);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "zoom", value: 2 }, // 2x the SVG's own px size, for print-quality sharpness
    font: {
      fontFiles: [DIAGRAM_FONT_PATH],
      loadSystemFonts: false,
      defaultFontFamily: DIAGRAM_FONT_FAMILY,
    },
  });
  const png = resvg.render().asPng();
  return { data: `image/png;base64,${png.toString("base64")}`, aspectRatio: width / height };
}

/**
 * Builds the four-slide handoff deck described in
 * docs/specs/patent-idea-to-proposal/spec.md: invention title & summary,
 * prior-art problems + features + effects (one slide), diagram, and
 * prior-art search results.
 */
export async function generatePatentDeck(idea: PatentIdeaRow): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "특허 아이디어 도구";
  pptx.title = idea.title;

  // Slide 1 — 발명의 명칭과 요약
  {
    const slide = pptx.addSlide();
    addSlideHeading(slide, 1, "발명의 명칭과 요약");
    slide.addText(idea.title, {
      x: MARGIN,
      y: 1.3,
      w: CONTENT_W,
      h: 0.8,
      fontSize: 26,
      bold: true,
      color: INK,
      fontFace: "Malgun Gothic",
    });
    slide.addText(idea.original_input, {
      x: MARGIN,
      y: 2.2,
      w: CONTENT_W,
      h: 2.4,
      fontSize: 13,
      color: INK,
      fontFace: "Malgun Gothic",
      valign: "top",
    });
    if (idea.status === "completed" && idea.score !== null) {
      const bandColor = idea.score_band === "가능" ? "1E7A46" : idea.score_band === "보완" ? "B45309" : "B91C1C";
      slide.addText(`${idea.score} / 100  ·  ${idea.score_band}`, {
        x: MARGIN,
        y: 4.8,
        w: 6,
        h: 0.6,
        fontSize: 20,
        bold: true,
        color: bandColor,
        fontFace: "Malgun Gothic",
      });
    }
  }

  // Slide 2 — 종래 기술의 문제점 · 발명의 특징 · 발명의 효과 (한 페이지)
  {
    const slide = pptx.addSlide();
    addSlideHeading(slide, 2, "발명의 배경과 특징");

    // 구버전 행(이 필드가 생기기 전에 분석됨)은 예전 문구/점수 근거로 폴백한다.
    const problem = idea.prior_problems ?? idea.clarifications?.problem ?? idea.original_input;
    const featureLines =
      idea.features && idea.features.length > 0
        ? idea.features
        : (idea.criteria ?? []).map((c) => `${c.label} (${c.score}/${c.max}점) — ${c.reason}`);
    const effectLines = idea.effects && idea.effects.length > 0 ? idea.effects : null;

    function sectionHeader(text: string, y: number) {
      slide.addText(text, {
        x: MARGIN,
        y,
        w: CONTENT_W,
        h: 0.32,
        fontSize: 13,
        bold: true,
        color: NAVY,
        fontFace: "Malgun Gothic",
      });
    }
    function bulletBlock(lines: string[], y: number, h: number) {
      slide.addText(
        lines.map((text) => ({ text, options: { bullet: true, breakLine: true, paraSpaceAfter: 4 } })),
        { x: MARGIN, y, w: CONTENT_W, h, fontSize: 12, color: INK, fontFace: "Malgun Gothic", valign: "top" },
      );
    }

    sectionHeader("종래 기술의 문제점", 1.15);
    slide.addText(problem, {
      x: MARGIN,
      y: 1.5,
      w: CONTENT_W,
      h: 1.15,
      fontSize: 12,
      color: INK,
      fontFace: "Malgun Gothic",
      valign: "top",
    });

    sectionHeader("발명의 특징", 2.75);
    bulletBlock(featureLines, 3.1, 1.85);

    sectionHeader("발명의 효과", 5.05);
    if (effectLines) {
      bulletBlock(effectLines, 5.4, 1.7);
    } else {
      slide.addText("효과 정보가 없습니다. '고쳐서 다시 분석'으로 새로 생성하세요.", {
        x: MARGIN,
        y: 5.4,
        w: CONTENT_W,
        h: 0.4,
        fontSize: 12,
        color: MUTED,
        fontFace: "Malgun Gothic",
      });
    }
  }

  // Slide 3 — 도면
  {
    const slide = pptx.addSlide();
    addSlideHeading(slide, 3, idea.diagram?.title || "도면");
    const image = await diagramToPngDataUri(idea);
    if (image) {
      const maxW = CONTENT_W;
      const maxH = 5.6;
      let w = maxW;
      let h = w / image.aspectRatio;
      if (h > maxH) {
        h = maxH;
        w = h * image.aspectRatio;
      }
      slide.addImage({
        data: image.data,
        x: (SLIDE_W - w) / 2,
        y: 1.2 + (maxH - h) / 2,
        w,
        h,
      });
    } else {
      slide.addText("도면이 생성되지 않았습니다.", {
        x: MARGIN,
        y: 2.5,
        w: CONTENT_W,
        h: 0.6,
        fontSize: 13,
        color: MUTED,
        fontFace: "Malgun Gothic",
      });
    }
  }

  // Slide 4 — 선행 특허 검색 결과
  {
    const slide = pptx.addSlide();
    addSlideHeading(slide, 4, "선행 특허 검색 결과");
    const priorArts = idea.prior_arts ?? [];
    if (priorArts.length === 0) {
      slide.addText("겹치는 선행 특허가 검색되지 않았습니다.", {
        x: MARGIN,
        y: 1.4,
        w: CONTENT_W,
        h: 0.6,
        fontSize: 13,
        color: MUTED,
        fontFace: "Malgun Gothic",
      });
    } else {
      const rows: PptxGenJS.TableRow[] = [
        [
          { text: "출원/공개번호", options: { bold: true, fill: { color: "F4F4F5" } } },
          { text: "발명의 명칭", options: { bold: true, fill: { color: "F4F4F5" } } },
          { text: "겹침 정도 및 설명", options: { bold: true, fill: { color: "F4F4F5" } } },
        ],
        ...priorArts.map((p): PptxGenJS.TableRow => [
          { text: p.publicationNumber || p.applicationNumber },
          { text: p.inventionTitle },
          { text: `[${p.overlapLevel}] ${p.overlapDescription}` },
        ]),
      ];
      slide.addTable(rows, {
        x: MARGIN,
        y: 1.2,
        w: CONTENT_W,
        h: 5.6,
        fontSize: 10,
        fontFace: "Malgun Gothic",
        color: INK,
        border: { type: "solid", color: LINE, pt: 0.75 },
        colW: [2.2, 4.3, CONTENT_W - 2.2 - 4.3],
        valign: "top",
        autoPage: true,
      });
    }
  }

  const output = await pptx.write({ outputType: "nodebuffer" });
  return output as Buffer;
}
