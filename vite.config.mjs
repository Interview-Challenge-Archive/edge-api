import { cloudflare } from "@cloudflare/vite-plugin"
import { defineConfig } from "vite"

function yamlText() {
  return {
    name: "yaml-text",
    transform(code, id) {
      if (!id.endsWith(".yml")) {
        return null
      }

      return `export default ${JSON.stringify(code)};`
    },
  }
}

export default defineConfig({
  plugins: [
    yamlText(),
    cloudflare(),
  ],
  test: {
    environment: "node",
  },
})
