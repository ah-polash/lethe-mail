// Minimal declarations: neither package ships types, and only these entry
// points are used.
declare module "gifenc" {
  export function GIFEncoder(): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: { palette?: number[][]; delay?: number; transparent?: boolean }
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };
  export function quantize(rgba: Uint8Array | Buffer, maxColors: number): number[][];
  export function applyPalette(rgba: Uint8Array | Buffer, palette: number[][]): Uint8Array;
}

declare module "upng-js" {
  const UPNG: {
    encode(
      frames: ArrayBuffer[],
      width: number,
      height: number,
      colorCount: number,
      delays?: number[]
    ): ArrayBuffer;
  };
  export default UPNG;
}
