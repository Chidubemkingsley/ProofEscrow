/**
 * Post-build script: generates index.html for static/Vercel deployment.
 * Searches for the assets folder — handles both dist/client/assets and
 * dist/client/client/assets (tanstackStart adds an extra client/ subfolder).
 */
import { readdir, writeFile, access } from "fs/promises";
import { join } from "path";

// Try both possible asset locations
async function findAssetsDir() {
  const candidates = [
    "dist/client/assets",
    "dist/client/client/assets",
  ];
  for (const dir of candidates) {
    try {
      await access(dir);
      return dir;
    } catch {
      // not found, try next
    }
  }
  throw new Error("Could not find assets directory in dist/client");
}

const assetsDir = await findAssetsDir();
const outputDir = assetsDir.replace("/assets", "");

console.log(`  → assets dir: ${assetsDir}`);
console.log(`  → output dir: ${outputDir}`);

const files = await readdir(assetsDir);
const clientJs = files.find((f) => f.startsWith("client-") && f.endsWith(".js"));
const stylesCSS = files.find((f) => f.startsWith("styles-") && f.endsWith(".css"));

if (!clientJs) {
  console.error("Could not find client entry JS in", assetsDir);
  process.exit(1);
}

// Asset paths relative to the HTML file (which sits in outputDir)
const assetBase = "/assets";

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LocalP2P — Non-Custodial OTC Exchange</title>
    <meta name="description" content="Buy and sell USDC with NGN, GHS, KES on a non-custodial P2P marketplace. On-chain Soroban escrow — funds can never be frozen." />
    <meta property="og:title" content="LocalP2P — Non-Custodial OTC Exchange" />
    <meta property="og:description" content="Trade USDC for local fiat without trusting anyone. Powered by Stellar Soroban." />
    <meta name="twitter:card" content="summary" />
    ${stylesCSS ? `<link rel="stylesheet" href="${assetBase}/${stylesCSS}" />` : ""}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${assetBase}/${clientJs}"></script>
  </body>
</html>`;

await writeFile(`${outputDir}/index.html`, html, "utf-8");
console.log(`✓ Generated ${outputDir}/index.html`);
console.log(`  → client entry: ${clientJs}`);
if (stylesCSS) console.log(`  → styles: ${stylesCSS}`);

// Write the actual output dir to a temp file so vercel.json can be updated
// (we print it so the CI log shows the correct outputDirectory)
console.log(`\n📦 Vercel outputDirectory should be: ${outputDir}`);
