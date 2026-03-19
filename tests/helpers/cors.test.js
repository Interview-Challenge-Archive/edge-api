import { describe, expect, it } from "vitest"

import { createCorsify } from "../../src/helpers/cors.js"

function makeRequest(origin) {
  const headers = origin ? { Origin: origin } : {}
  return new Request("https://example.com/login/github", { headers })
}

describe("cors helper", () => {
  it("applies CORS headers for configured env origins", () => {
    const corsify = createCorsify({
      ALLOWED_ORIGINS: "https://app.example.com, https://auth.example.org",
    })

    const response = corsify(new Response("ok"), makeRequest("https://auth.example.org"))

    expect(response.headers.get("access-control-allow-origin")).toBe("https://auth.example.org")
    expect(response.headers.get("access-control-allow-credentials")).toBe("true")
  })

  it("applies CORS headers for localhost origins", () => {
    const corsify = createCorsify({ ALLOWED_ORIGINS: "" })
    const response = corsify(new Response("ok"), makeRequest("http://localhost:5173"))

    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173")
    expect(response.headers.get("access-control-allow-credentials")).toBe("true")
  })

  it("does not apply CORS headers for disallowed origins", () => {
    const corsify = createCorsify({
      ALLOWED_ORIGINS: "https://app.example.com, https://auth.example.org",
    })
    const response = corsify(new Response("ok"), makeRequest("https://malicious.example.net"))

    expect(response.headers.get("access-control-allow-origin")).toBeNull()
    expect(response.headers.get("access-control-allow-credentials")).toBe("true")
  })
})
