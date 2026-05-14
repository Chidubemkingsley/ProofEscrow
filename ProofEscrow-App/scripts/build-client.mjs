/**
 * Builds only the client bundle using Vite's programmatic API.
 * This skips the SSR/Cloudflare Worker build that fails in CI.
 * Used by the Vercel deployment pipeline.
 */
import { build } from "vite";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");

await build({
  root,
  configFile: resolve(root, "vite.config.ts"),
  logLevel: "info",
  // Build only the client environment, skip SSR
  build: {
    outDir: resolve(root, "dist/client"),
  },
});

console.log("✓ Client build complete");
