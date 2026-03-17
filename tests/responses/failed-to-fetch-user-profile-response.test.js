import { describe, expect, it } from "vitest"

import { FailedToFetchUserProfileResponse } from "../../src/responses/failed-to-fetch-user-profile-response.js"

describe("FailedToFetchUserProfileResponse", () => {
  it("returns a 502 response with the expected body", async () => {
    const response = new FailedToFetchUserProfileResponse()

    expect(response.status).toBe(502)
    expect(await response.text()).toBe("Failed to fetch user profile")
  })
})
