import { describe, expect, it } from "vitest"

import providerConfigs from "../../src/config/providers.js"
import routeConfigs from "../../src/config/routes.js"
import { OpenApiController } from "../../src/controllers/openapi-controller.js"

describe("OpenApiController", () => {
  it("returns OpenAPI spec from route and provider configs", async () => {
    const controller = new OpenApiController()
    const request = new Request("https://example.com/openapi.json")
    const response = controller.show(request, {
      providerConfigs,
      routeConfigs,
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.openapi).toBe("3.1.0")
    expect(body.paths["/openapi.json"]).toBeDefined()
    expect(body.paths["/login/{provider}"].get.parameters[0].schema.enum).toEqual([
      "github",
      "linkedin",
    ])
  })

  it("includes server origin and configured route summary", async () => {
    const controller = new OpenApiController()
    const request = new Request("https://api.example.org/openapi.json")
    const response = controller.show(request, {
      providerConfigs,
      routeConfigs,
    })
    const body = await response.json()

    expect(body.servers).toEqual([
      {
        url: "https://api.example.org",
      },
    ])
    expect(body.paths["/openapi.json"].get.summary).toBe("OpenAPI specification")
  })
})
