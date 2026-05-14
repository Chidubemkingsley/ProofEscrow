/**
 * Vite config for static SPA build — used for Vercel deployment.
 * Bypasses the Cloudflare Worker SSR pipeline entirely.
 * All blockchain logic is client-side so SSR is not needed.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    // TanStack Router file-based routing
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
    // Polyfill Node.js globals for @stellar/stellar-sdk
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
      include: ["buffer", "process", "util", "stream", "events", "crypto"],
    }),
  ],
  define: {
    global: "globalThis",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      // Shim CJS-only freighter-api for ESM named imports
      "@stellar/freighter-api": resolve(__dirname, "src/lib/freighter-shim.ts"),
    },
  },
  build: {
    outDir: "dist/spa",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "index.html"),
    },
  },
  optimizeDeps: {
    include: [
      "randombytes",
      "@near-js/crypto",
      "@stellar/stellar-sdk",
      "@stellar/stellar-base",
      "buffer",
    ],
  },
});
