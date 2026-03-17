import { describe, expect, it } from "vitest"

import { InternalServerErrorResponse } from "../../../src/responses/errors/internal-server-error-response.js"

describe("InternalServerErrorResponse", () => {
  it("returns a 500 response with the expected body", async () => {
    const response = new InternalServerErrorResponse()

    expect(response.status).toBe(500)
    expect(await response.text()).toBe("Internal Server Error")
  })
})
