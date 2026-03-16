import { describe, expect, it } from "vitest"

import { NotFoundResponse } from "../../src/responses/not-found-response.js"

describe("NotFoundResponse", () => {
  it("returns a 404 response with the expected body", async () => {
    const response = new NotFoundResponse()

    expect(response.status).toBe(404)
    expect(await response.text()).toBe("Not Found")
  })
})
