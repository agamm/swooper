import { defineConfig } from "vitest/config"
import { resolve } from "path"

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Several suites make real OpenRouter and registry calls, which comfortably
    // outlast the 5s default.
    testTimeout: 60000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
})
