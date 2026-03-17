import { describe, expect, it } from "vitest"

import { JsonResponse } from "../../../src/responses/base/json-response.js"

describe("JsonResponse", () => {
  it("returns a 200 JSON response by default", async () => {
    const response = new JsonResponse({ ok: true })

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/json")
    expect(await response.json()).toEqual({ ok: true })
  })

  it("uses custom status and headers", async () => {
    const response = new JsonResponse(
      { created: true },
      201,
      { "x-test": "1" }
    )

    expect(response.status).toBe(201)
    expect(response.headers.get("x-test")).toBe("1")
    expect(response.headers.get("content-type")).toBe("application/json")
    expect(await response.json()).toEqual({ created: true })
  })

  it("preserves an explicit content-type header", () => {
    const response = new JsonResponse(
      { ok: true },
      200,
      { "content-type": "application/problem+json" }
    )

    expect(response.headers.get("content-type")).toBe("application/problem+json")
  })
})
