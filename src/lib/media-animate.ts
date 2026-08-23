import { Resvg } from "@resvg/resvg-js";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import UPNG from "upng-js";
import jpeg from "jpeg-js";

// resvg renders a single static frame — it does not run SMIL animation. So for
// animated output we ask the model for a sequence of SVG keyframes, rasterise
// each one, and encode the frames into a GIF or APNG here.

export type OutputFormat = "png" | "jpg" | "gif" | "apng";

// Milliseconds per frame. Shared with the browser preview so what you see before
// saving runs at the same speed as the encoded file.
export const FRAME_DELAY_MS = 120;

// High enough that gradients stay clean; low enough to be worth choosing over PNG.
const JPEG_QUALITY = 88;

export const OUTPUT_FORMATS: {
  key: OutputFormat;
  label: string;
  mimeType: string;
  extension: string;
  animated: boolean;
  note: string;
}[] = [
  {
    key: "png",
    label: "PNG (static)",
    mimeType: "image/png",
    extension: "png",
    animated: false,
    note: "Renders everywhere. The safe default for email.",
  },
  {
    key: "jpg",
    label: "JPEG",
    mimeType: "image/jpeg",
    extension: "jpg",
    animated: false,
    note: "Much smaller than PNG, but no transparency — flattened onto white.",
  },
  {
    key: "gif",
    label: "Animated GIF",
    mimeType: "image/gif",
    extension: "gif",
    animated: true,
    note: "Animates in most clients; Outlook shows the first frame only. 256 colours, so gradients band slightly.",
  },
  {
    key: "apng",
    label: "Animated PNG",
    mimeType: "image/apng",
    extension: "png",
    animated: true,
    note: "Full colour and smooth gradients, but only Apple Mail animates it — others show the first frame.",
  },
];

export interface EncodedImage {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  frameCount: number;
}

// JPEG has no alpha channel, and jpeg-js reads transparent pixels as black, so
// anything see-through is composited onto white first.
function flattenOnWhite(rgba: Buffer): Buffer {
  const out = Buffer.allocUnsafe(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3] / 255;
    out[i] = Math.round(rgba[i] * a + 255 * (1 - a));
    out[i + 1] = Math.round(rgba[i + 1] * a + 255 * (1 - a));
    out[i + 2] = Math.round(rgba[i + 2] * a + 255 * (1 - a));
    out[i + 3] = 255;
  }
  return out;
}

function renderFrame(svg: string, width: number): { rgba: Buffer; width: number; height: number } {
  const img = new Resvg(svg, { fitTo: { mode: "width", value: width } }).render();
  return { rgba: Buffer.from(img.pixels), width: img.width, height: img.height };
}

/** Rasterise SVG keyframes and encode them in the requested format. */
export function encodeFrames(
  svgFrames: string[],
  format: OutputFormat,
  targetWidth: number,
  frameDelayMs = FRAME_DELAY_MS
): EncodedImage {
  if (svgFrames.length === 0) throw new Error("No frames to encode");

  const spec = OUTPUT_FORMATS.find((f) => f.key === format) || OUTPUT_FORMATS[0];

  // Still output needs only the first frame — as does an animated format that
  // was somehow handed a single frame.
  if (!spec.animated || svgFrames.length === 1) {
    const still = spec.animated ? OUTPUT_FORMATS[0] : spec;
    const image = new Resvg(svgFrames[0], { fitTo: { mode: "width", value: targetWidth } }).render();
    const buffer =
      still.key === "jpg"
        ? Buffer.from(
            jpeg.encode(
              { data: flattenOnWhite(Buffer.from(image.pixels)), width: image.width, height: image.height },
              JPEG_QUALITY
            ).data
          )
        : Buffer.from(image.asPng());
    return {
      buffer,
      mimeType: still.mimeType,
      extension: still.extension,
      frameCount: 1,
    };
  }

  const rendered = svgFrames.map((f) => renderFrame(f, targetWidth));
  const { width, height } = rendered[0];
  // Frames must share dimensions or the encoders produce garbage.
  const consistent = rendered.every((r) => r.width === width && r.height === height);
  if (!consistent) throw new Error("Animation frames rendered at different sizes");

  if (format === "gif") {
    const encoder = GIFEncoder();
    for (const frame of rendered) {
      const palette = quantize(frame.rgba, 256);
      const indexed = applyPalette(frame.rgba, palette);
      encoder.writeFrame(indexed, width, height, { palette, delay: frameDelayMs });
    }
    encoder.finish();
    return {
      buffer: Buffer.from(encoder.bytes()),
      mimeType: "image/gif",
      extension: "gif",
      frameCount: rendered.length,
    };
  }

  // APNG: lossless, keeps gradients clean.
  const buffers = rendered.map((r) => Uint8Array.from(r.rgba).buffer as ArrayBuffer);
  const delays = rendered.map(() => frameDelayMs);
  const apng = UPNG.encode(buffers, width, height, 0, delays);
  return {
    buffer: Buffer.from(apng),
    mimeType: "image/apng",
    extension: "png",
    frameCount: rendered.length,
  };
}
