import { describe, expect, it } from "vitest"

import { TeapotResponse } from "../../../src/responses/teapot/teapot-response.js"

describe("TeapotResponse", () => {
  it("returns a 418 JSON teapot payload", async () => {
    const response = new TeapotResponse()

    expect(response.status).toBe(418)
    expect(response.headers.get("content-type")).toBe("application/json")
    expect(await response.json()).toEqual({
      error: "teapot",
      message: "I'm a teapot",
      beverage: "tea",
      status: 418,
    })
  })
})
