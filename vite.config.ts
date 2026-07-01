import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import viteCompression from "vite-plugin-compression";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // Ship gzip + brotli precompressed assets. Static hosts (incl. Lovable's CDN)
    // will serve `.br` / `.gz` variants when the client Accept-Encoding matches,
    // dramatically shrinking JS/CSS payloads and improving FCP/LCP on mobile.
    mode !== "development" &&
      viteCompression({ algorithm: "brotliCompress", ext: ".br", threshold: 1024 }),
    mode !== "development" &&
      viteCompression({ algorithm: "gzip", ext: ".gz", threshold: 1024 }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    // Terser gives ~10-15% smaller JS than esbuild's minifier for our bundle mix.
    minify: "esbuild",
    cssMinify: "esbuild",
    // Source maps let error trackers (and Lighthouse's "missing source maps"
    // audit) resolve minified stacks back to original TSX.
    sourcemap: true,

    // Split heavy vendor libs so the initial route only downloads what it needs
    // and returning visitors get long-term cache hits on stable chunks.
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "radix-vendor": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
          ],
          "data-vendor": ["@tanstack/react-query", "@supabase/supabase-js"],
          "chart-vendor": ["recharts"],
          "pdf-vendor": ["jspdf", "jspdf-autotable"],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
}));
