import { describe, expect, it } from "vitest"

import { RedirectResponse } from "../../../src/responses/oauth/redirect-response.js"

describe("RedirectResponse", () => {
  it("returns a 302 response with the provided headers", () => {
    const headers = new Headers({
      Location: "https://example.com/next",
      "Set-Cookie": "session=abc",
    })
    const response = new RedirectResponse(headers)

    expect(response.status).toBe(302)
    expect(response.headers.get("Location")).toBe("https://example.com/next")
    expect(response.headers.get("Set-Cookie")).toBe("session=abc")
  })
})
