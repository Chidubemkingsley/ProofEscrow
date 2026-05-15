import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    tsconfigPaths(),
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
    },
  },
  build: {
    outDir: "dist",
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
