import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import ElementPlus from "unplugin-element-plus/vite";
import { loadEnv } from "vite";
import { defineConfig } from "vite-plus";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.VITE_PORT || 5173);

  return {
    build: {
      outDir: "dist",
      rolldownOptions: {
        checks: {
          invalidAnnotation: false,
          pluginTimings: false,
        },
      },
      sourcemap: false,
    },
    fmt: {
      ignorePatterns: ["dist/**", "node_modules/**"],
    },
    lint: {
      ignorePatterns: ["dist/**", "node_modules/**"],
    },
    plugins: [
      vue(),
      ElementPlus({
        format: "esm",
      }),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      host: "0.0.0.0",
      port,
      // 端口被占时直接报错而不是静默漂移，避免 Origin 变化触发后端 ORIGIN_NOT_ALLOWED
      strictPort: true,
      proxy: {
        "/admin": {
          changeOrigin: true,
          target: env.VITE_API_PROXY_TARGET || "http://localhost:8787",
          ws: true,
        },
      },
    },
    test: {
      environment: "happy-dom",
      exclude: ["**/dist/**", "**/node_modules/**"],
      include: ["src/**/*.spec.ts", "src/**/*.test.ts"],
      passWithNoTests: true,
    },
  };
});
