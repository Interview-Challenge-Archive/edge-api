import { describe, expect, it } from "vitest"

import { matchRoute } from "../../src/helpers/routing.js"

describe("routing helper", () => {
  it("matches static routes", () => {
    const match = matchRoute([{ method: "GET", path: "/version", action: "show" }], "/version", "GET")

    expect(match).toEqual({
      route: { method: "GET", path: "/version", action: "show" },
      params: {},
    })
  })

  it("matches template routes and extracts params", () => {
    const match = matchRoute(
      [{ method: "GET", path: "/login/:provider", action: "login" }],
      "/login/github",
      "GET"
    )

    expect(match.route.action).toBe("login")
    expect(match.params).toEqual({ provider: "github" })
  })

  it("returns null when method does not match", () => {
    const match = matchRoute([{ method: "POST", path: "/version", action: "show" }], "/version", "GET")

    expect(match).toBeNull()
  })

  it("returns null when path does not match", () => {
    const match = matchRoute([{ method: "GET", path: "/version", action: "show" }], "/unknown", "GET")

    expect(match).toBeNull()
  })
})
