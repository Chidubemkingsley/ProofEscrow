/**
 * Post-build script: generates dist/client/index.html for static/Vercel deployment.
 * TanStack Start's client build outputs JS/CSS chunks but no HTML shell.
 * This script creates the minimal HTML entry point that loads the client bundle.
 */
import { readdir, writeFile, readFile } from "fs/promises";
import { join } from "path";

const distClient = "dist/client/assets";

// Find the main client entry chunk (named client-*.js)
const files = await readdir(distClient);
const clientJs = files.find((f) => f.startsWith("client-") && f.endsWith(".js"));
const stylesCSS = files.find((f) => f.startsWith("styles-") && f.endsWith(".css"));

if (!clientJs) {
  console.error("Could not find client entry JS in dist/client/assets");
  process.exit(1);
}

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
    ${stylesCSS ? `<link rel="stylesheet" href="/assets/${stylesCSS}" />` : ""}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/${clientJs}"></script>
  </body>
</html>`;

await writeFile("dist/client/index.html", html, "utf-8");
console.log(`✓ Generated dist/client/index.html`);
console.log(`  → client entry: ${clientJs}`);
if (stylesCSS) console.log(`  → styles: ${stylesCSS}`);
