// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Disable Cloudflare plugin — we deploy to Vercel as a static SPA
  cloudflare: false,
  plugins: [
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
      include: ["buffer", "process", "util", "stream", "events", "crypto"],
    }),
  ],
  vite: {
    define: {
      global: "globalThis",
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
  },
});
