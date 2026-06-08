import devServer from "@hono/vite-dev-server"
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

const projectRoot = path.resolve(import.meta.dirname, "..")

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    devServer({ entry: path.resolve(projectRoot, "api/boot.ts"), exclude: [/^\/(?!api\/).*$/] }),
    inspectAttr(), react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "src"),
      "@contracts": path.resolve(projectRoot, "contracts"),
      "@db": path.resolve(projectRoot, "db"),
      "db": path.resolve(projectRoot, "db"),
    },
  },
  envDir: projectRoot,
  css: {
    postcss: path.resolve(projectRoot, "config/postcss.config.js"),
  },
  build: {
    outDir: path.resolve(projectRoot, "dist/public"),
    emptyOutDir: true,
  },
});
