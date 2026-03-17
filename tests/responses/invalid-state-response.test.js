import { describe, expect, it } from "vitest"

import { InvalidStateResponse } from "../../src/responses/invalid-state-response.js"

describe("InvalidStateResponse", () => {
  it("returns a 400 response with the expected body", async () => {
    const response = new InvalidStateResponse()

    expect(response.status).toBe(400)
    expect(await response.text()).toBe("Invalid state")
  })
})
