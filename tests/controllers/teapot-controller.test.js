import { describe, expect, it } from "vitest"

import { TeapotController } from "../../src/controllers/teapot-controller.js"

describe("TeapotController", () => {
  it("returns a teapot response", async () => {
    const controller = new TeapotController()
    const response = controller.brew()

    expect(response.status).toBe(418)
    expect(response.headers.get("content-type")).toContain("application/json")
    expect(await response.json()).toEqual({
      error: "teapot",
      message: "I'm a teapot",
      beverage: "tea",
      status: 418,
    })
  })
})
