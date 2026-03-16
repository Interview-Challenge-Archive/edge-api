import { cloudflare } from "@cloudflare/vite-plugin"
import yaml from "@rollup/plugin-yaml"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [
    yaml(),
    cloudflare(),
  ],
  test: {
    environment: "node",
  },
})
