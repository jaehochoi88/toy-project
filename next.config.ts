import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Unlike sharp, @resvg/resvg-js isn't in Next's built-in auto-external
  // list, so its runtime platform-conditional require() (picking the
  // right @resvg/resvg-js-<platform> binding) breaks under Next's server
  // bundling. This opts it out of bundling and uses plain Node `require`.
  serverExternalPackages: ["@resvg/resvg-js"],
  // Bundled Korean font for rasterizing the PPTX diagram (see
  // lib/pptx/generate-deck.ts) — resvg-js reads it from disk at request
  // time via a plain fs path, which Next's output-file tracer doesn't
  // always pick up on its own. Without this, the font is missing from the
  // deployed function and the diagram renders as tofu boxes.
  outputFileTracingIncludes: {
    "/ideas/[id]/pptx": ["./lib/pptx/fonts/**/*"],
  },
};

export default nextConfig;
