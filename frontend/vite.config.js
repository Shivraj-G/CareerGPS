import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (mode === "production" && !/^https:\/\//i.test(String(env.VITE_API_BASE_URL || "").trim())) {
    throw new Error(
      "VITE_API_BASE_URL must be set to the real HTTPS backend origin for production builds."
    );
  }

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:5000",
          changeOrigin: true,
        },
      },
    },
    build: {
      sourcemap: false,
      minify: "esbuild",
      cssMinify: "esbuild",
      reportCompressedSize: true,
      chunkSizeWarningLimit: 350,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            icons: ["lucide-react"],
          },
        },
      },
    },
    esbuild: {
      legalComments: "none",
    },
  };
});
