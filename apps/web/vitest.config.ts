import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@owit/db": resolve(__dirname, "../../packages/db/src/index.ts"),
      "@owit/shared": resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
});
