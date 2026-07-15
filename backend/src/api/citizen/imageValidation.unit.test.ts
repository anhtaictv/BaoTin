import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { extractExifGps, validateImageBuffer } from "./imageValidation.js";

async function makeTestPng(): Promise<Buffer> {
  return sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toBuffer();
}

describe("validateImageBuffer", () => {
  it("accepts a real, well-formed PNG and reports its actual dimensions/format", async () => {
    const buffer = await makeTestPng();
    const result = await validateImageBuffer(buffer);
    expect(result.valid).toBe(true);
    expect(result.format).toBe("png");
    expect(result.width).toBe(8);
    expect(result.height).toBe(8);
  });

  it("rejects a buffer that isn't a real image, regardless of claimed mimetype", async () => {
    const notAnImage = Buffer.from("this is definitely not image bytes");
    const result = await validateImageBuffer(notAnImage);
    expect(result.valid).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("rejects an empty buffer", async () => {
    const result = await validateImageBuffer(Buffer.alloc(0));
    expect(result.valid).toBe(false);
  });
});

describe("extractExifGps", () => {
  it("returns null (not an error) for an image with no EXIF GPS data — the common case", async () => {
    const buffer = await makeTestPng();
    const gps = await extractExifGps(buffer);
    expect(gps).toBeNull();
  });

  it("returns null for a non-image buffer without throwing", async () => {
    const gps = await extractExifGps(Buffer.from("not an image"));
    expect(gps).toBeNull();
  });
});
