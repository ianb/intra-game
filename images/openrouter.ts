// The image-generation call and the PNG<->WebP conversions.
//
// The model returns a PNG as a base64 data URL on message.images; we downscale
// it and store lossy WebP, which is a fraction of the size at no visible cost
// for pixel art. Runs only from the Node CLI (images/generate.ts), never in the
// Worker or the browser.

import sharp from "sharp";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

interface ImageApiResponse {
  choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
  usage?: { cost?: number };
}

export interface GeneratedImage {
  png: Buffer;
  costUsd: number;
}

export async function generateImage(options: {
  prompt: string;
  apiKey: string;
  model: string;
  // Reference PNGs passed in as conditioning for style stability.
  references?: Buffer[];
}): Promise<GeneratedImage> {
  const content: ContentPart[] = [{ type: "text", text: options.prompt }];
  for (const ref of options.references ?? []) {
    content.push({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${ref.toString("base64")}` },
    });
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      modalities: ["image", "text"],
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`image API ${res.status}: ${detail}`);
  }

  const json = (await res.json()) as ImageApiResponse;
  const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) {
    throw new Error(
      `no image in response: ${JSON.stringify(json).slice(0, 300)}`,
    );
  }
  return {
    png: Buffer.from(url.split(",")[1] ?? "", "base64"),
    costUsd: json.usage?.cost ?? 0,
  };
}

export function pngToWebp(
  png: Buffer,
  width: number,
  height: number,
  quality: number,
): Promise<Buffer> {
  // Crop to the target aspect and hard-downscale to a small pixel grid: this is
  // what turns a smoothly-rendered image into chunky pixel art. The file stays
  // this small; the UI upscales it with image-rendering: pixelated so the pixels
  // read as crisp blocks at any display size.
  return sharp(png)
    .resize(width, height, { fit: "cover", kernel: sharp.kernel.nearest })
    .webp({ quality })
    .toBuffer();
}

export function webpToPng(webp: Buffer): Promise<Buffer> {
  return sharp(webp).png().toBuffer();
}
