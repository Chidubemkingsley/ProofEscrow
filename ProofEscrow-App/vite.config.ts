// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import type { Plugin } from "vite";

/**
 * Wraps a plugin so it only runs in the "client" Vite environment.
 * The Cloudflare Worker SSR environment must NOT receive browser polyfills.
 */
function clientOnly(plugin: Plugin): Plugin {
  return {
    ...plugin,
    apply(config, env) {
      // Only apply during client build, not SSR/worker build
      if (typeof plugin.apply === "function") {
        return plugin.apply(config, env);
      }
      return true;
    },
    configureServer(server) {
      // Skip in SSR context
      if (typeof plugin.configureServer === "function") {
        return plugin.configureServer(server);
      }
    },
  };
}

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Disable Cloudflare Worker SSR build for Vercel static deployment
  cloudflare: process.env.VERCEL ? false : undefined,
  plugins: [
    // Polyfill Node.js globals (Buffer, process, etc.) for the CLIENT bundle only.
    // Wrapped to prevent injection into the Cloudflare Worker SSR environment.
    clientOnly(
      nodePolyfills({
        globals: { Buffer: true, global: true, process: true },
        protocolImports: true,
        include: ["buffer", "process", "util", "stream", "events", "crypto"],
      }) as Plugin
    ),
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
