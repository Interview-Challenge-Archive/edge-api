import { describe, expect, it } from "vitest"

import worker from "../src/index.js"

const env = {
  GITHUB_CLIENT_ID: "gh-client-id",
  GITHUB_CLIENT_SECRET: "gh-client-secret",
  LINKEDIN_CLIENT_ID: "li-client-id",
  LINKEDIN_CLIENT_SECRET: "li-client-secret",
}

function makeRequest(path, { method = "GET", headers = {} } = {}) {
  return new Request(`https://example.com${path}`, { method, headers })
}

describe("index worker routing", () => {
  it("returns a teapot response for the root path", async () => {
    const res = await worker.fetch(makeRequest("/"), env)
    const body = await res.json()

    expect(res.status).toBe(418)
    expect(res.headers.get("content-type")).toContain("application/json")
    expect(body).toEqual({
      error: "teapot",
      message: "I'm a teapot",
      beverage: "tea",
      status: 418,
    })
  })

  it("returns 404 Not Found for any unknown path", async () => {
    const res = await worker.fetch(makeRequest("/unknown/path"), env)

    expect(res.status).toBe(404)
    expect(await res.text()).toBe("Not Found")
  })

  it("returns the version route through configured dispatch", async () => {
    const res = await worker.fetch(makeRequest("/version"), env)

    expect(res.status).toBe(200)
    expect(await res.text()).toBe("1.0.0")
  })
})
