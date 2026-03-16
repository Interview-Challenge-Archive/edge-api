import { defineConfig } from "vitest/config"

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
  plugins: [yamlText()],
  test: {
    environment: "node",
  },
})
