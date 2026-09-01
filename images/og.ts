// Render the social-preview image (Open Graph / Twitter card) for the game,
// committed as app/assets/og.png and served at /assets/og.png.
//
// This is offline authoring, like the room and character images: the file that
// ships is committed, and the runtime never regenerates it. It is drawn with a
// headless browser rather than the image model so the title uses the game's
// own bundled pixel font and the same crisp outline the in-game room titles
// use, over a real room as the background.
//
//   pnpm og
//
// 1200x630 is the size link unfurlers (Slack, Discord, iMessage, X, Facebook)
// expect for a large-image card.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = resolve(root, "app/assets");

// The central hub, and the most establishing of the room shots: symmetrical
// statues, a lit ceiling, an archway with depth. Change this id to re-theme
// the card.
const BACKGROUND = "images/rooms/Hollow_Atrium.webp";
const OUT = resolve(ASSETS, "og.png");

const WIDTH = 1200;
const HEIGHT = 630;

// Pinned Chromium in this environment. Same binary the screenshots use.
const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

function dataUrl(path: string, mime: string): string {
  return `data:${mime};base64,${readFileSync(path).toString("base64")}`;
}

function html(): string {
  const bg = dataUrl(resolve(ASSETS, BACKGROUND), "image/webp");
  const font = dataUrl(resolve(ASSETS, "fonts/PressStart2P.woff2"), "font/woff2");
  // The outline is the .pixel-title treatment from app/globals.css, scaled up
  // for the larger type: eight 1px-ish shadows become 3px here.
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Press Start 2P"; src: url(${font}) format("woff2"); }
* { margin: 0; box-sizing: border-box; }
html, body { width: ${WIDTH}px; height: ${HEIGHT}px; }
.card { position: relative; width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden;
        background: #111827; font-family: "Press Start 2P", monospace; }
.bg { position: absolute; inset: 0; background-image: url(${bg});
      background-size: cover; background-position: center 42%;
      image-rendering: pixelated; }
/* Darken for legibility: a little from the top, more from the bottom, plus a
   soft vignette. */
.shade { position: absolute; inset: 0;
         background:
           radial-gradient(120% 90% at 50% 38%, transparent 45%, rgba(8,11,20,.55) 100%),
           linear-gradient(180deg, rgba(8,11,20,.55) 0%, rgba(8,11,20,.1) 30%,
                           rgba(8,11,20,.35) 62%, rgba(8,11,20,.9) 100%); }
.center { position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; text-align: center; }
.title { font-size: 132px; letter-spacing: 12px; color: #fff; line-height: 1;
         padding-left: 12px; /* balance the letter-spacing */
         text-shadow: -3px -3px 0 #000, 0 -3px 0 #000, 3px -3px 0 #000, 3px 0 0 #000,
                      3px 3px 0 #000, 0 3px 0 #000, -3px 3px 0 #000, -3px 0 0 #000; }
.tag { margin-top: 34px; font-size: 22px; letter-spacing: 4px; color: #facc15;
       text-shadow: -2px -2px 0 #000, 0 -2px 0 #000, 2px -2px 0 #000, 2px 0 0 #000,
                    2px 2px 0 #000, 0 2px 0 #000, -2px 2px 0 #000, -2px 0 0 #000; }
.url { position: absolute; bottom: 34px; left: 0; right: 0; text-align: center;
       font-size: 16px; letter-spacing: 3px; color: #cbd5e1;
       text-shadow: -2px -2px 0 #000, 0 -2px 0 #000, 2px -2px 0 #000, 2px 0 0 #000,
                    2px 2px 0 #000, 0 2px 0 #000, -2px 2px 0 #000, -2px 0 0 #000; }
</style></head><body>
<div class="card">
  <div class="bg"></div>
  <div class="shade"></div>
  <div class="center">
    <div class="title">INTRA</div>
    <div class="tag">a text adventure</div>
  </div>
  <div class="url">playintra.win</div>
</div>
</body></html>`;
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ executablePath: CHROME });
  try {
    const page = await browser.newPage({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 1,
    });
    await page.setContent(html(), { waitUntil: "networkidle" });
    // The font is embedded as a data URL; wait for it to actually apply before
    // the screenshot, or the title falls back to a system font.
    await page.evaluate(() => document.fonts.ready);
    const shot = await page.screenshot({ type: "png" });
    // The card is mostly flat pixel blocks over a shaded gradient, so a 256-
    // colour palette shrinks it by most of its size with no visible loss.
    const buffer = await sharp(shot)
      .png({ palette: true, compressionLevel: 9 })
      .toBuffer();
    writeFileSync(OUT, buffer);
    console.log(`wrote app/assets/og.png (${Math.round(buffer.length / 1024)}KB)`);
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
