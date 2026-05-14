/**
 * Builds only the client bundle for Vercel static deployment.
 * Uses tanstackStart plugin directly with cloudflare disabled.
 */
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");

const tailwindcss = (await import("@tailwindcss/vite")).default;
const tsconfigPaths = (await import("vite-tsconfig-paths")).default;
const { nodePolyfills } = await import("vite-plugin-node-polyfills");
const { tanstackStart } = await import("@tanstack/react-start/plugin/vite");

await build({
  root,
  configFile: false,
  logLevel: "info",
  plugins: [
    // tanstackStart provides the virtual entry — no index.html needed
    tanstackStart({ server: { entry: "server" } }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
      include: ["buffer", "process", "util", "stream", "events", "crypto"],
    }),
  ],
  define: { global: "globalThis" },
  resolve: {
    alias: { "@": resolve(root, "src") },
  },
  build: {
    outDir: resolve(root, "public"),
    emptyOutDir: true,
  },
  optimizeDeps: {
    include: [
      "@stellar/stellar-sdk",
      "@stellar/stellar-base",
      "@stellar/freighter-api",
      "@creit.tech/stellar-wallets-kit",
      "randombytes",
      "buffer",
      "events",
    ],
  },
});

console.log("✓ Client build complete");
