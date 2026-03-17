import { describe, expect, it } from "vitest"

import { MissingCodeResponse } from "../../../src/responses/oauth/missing-code-response.js"

describe("MissingCodeResponse", () => {
  it("returns a 400 response with the expected body", async () => {
    const response = new MissingCodeResponse()

    expect(response.status).toBe(400)
    expect(await response.text()).toBe("Missing code")
  })
})
