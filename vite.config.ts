import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  // Point a dev server at a machine: SERVER_URL=10.10.0.42 npm run dev
  // (the address can also be changed from the page at any time).
  const serverUrl = env.SERVER_URL || env.VITE_SERVER_URL || "";

  return {
    plugins: [react(), tailwindcss()],
    define: {
      "import.meta.env.VITE_SERVER_URL": JSON.stringify(serverUrl),
    },
    build: {
      outDir: "out",
      // ECharts is its own vendor chunk (~500 kB, 170 kB gzipped).
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            echarts: [
              "echarts/core",
              "echarts/charts",
              "echarts/components",
              "echarts/renderers",
            ],
          },
        },
      },
    },
  };
});
