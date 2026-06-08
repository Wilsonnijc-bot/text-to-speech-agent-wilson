import { defineConfig } from "vitest/config";
import path from "path";

const projectRoot = path.resolve(import.meta.dirname, "..");

export default defineConfig({
  root: projectRoot,
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "src"),
      "@contracts": path.resolve(projectRoot, "contracts"),
      "@assets": path.resolve(projectRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["api/**/*.test.ts", "api/**/*.spec.ts"],
  },
});
