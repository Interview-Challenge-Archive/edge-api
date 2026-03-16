import yaml from "@rollup/plugin-yaml"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [yaml()],
  test: {
    environment: "node",
  },
})
