import { describe, it, expect, vi, beforeEach } from "vitest"
import worker from "./index.js"

const env = {
  GITHUB_CLIENT_ID: "gh-client-id",
  GITHUB_CLIENT_SECRET: "gh-client-secret",
  LINKEDIN_CLIENT_ID: "li-client-id",
  LINKEDIN_CLIENT_SECRET: "li-client-secret",
}

function makeRequest(path, { method = "GET", headers = {} } = {}) {
  return new Request(`https://example.com${path}`, { method, headers })
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe("default route", () => {
  it("returns 200 OK for unmatched paths", async () => {
    const res = await worker.fetch(makeRequest("/"), env)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe("OK")
  })

  it("returns 200 OK for any unknown path", async () => {
    const res = await worker.fetch(makeRequest("/unknown/path"), env)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe("OK")
  })
})

describe("GET /login/github", () => {
  it("redirects to GitHub OAuth authorization URL", async () => {
    const res = await worker.fetch(makeRequest("/login/github"), env)
    expect(res.status).toBe(302)
    const location = new URL(res.headers.get("Location"))
    expect(location.origin + location.pathname).toBe("https://github.com/login/oauth/authorize")
    expect(location.searchParams.get("client_id")).toBe("gh-client-id")
    expect(location.searchParams.get("redirect_uri")).toBe("https://example.com/callback/github")
    expect(location.searchParams.get("scope")).toBe("read:user user:email")
  })
})

describe("GET /login/linkedin", () => {
  it("redirects to LinkedIn OAuth authorization URL with state cookie", async () => {
    const res = await worker.fetch(makeRequest("/login/linkedin"), env)
    expect(res.status).toBe(302)

    const location = new URL(res.headers.get("Location"))
    expect(location.origin + location.pathname).toBe("https://www.linkedin.com/oauth/v2/authorization")
    expect(location.searchParams.get("response_type")).toBe("code")
    expect(location.searchParams.get("client_id")).toBe("li-client-id")
    expect(location.searchParams.get("redirect_uri")).toBe("https://example.com/callback/linkedin")
    expect(location.searchParams.get("scope")).toBe("openid profile email")

    const state = location.searchParams.get("state")
    expect(state).toBeTruthy()

    const setCookie = res.headers.get("Set-Cookie")
    expect(setCookie).toContain(`linkedin_state=${state}`)
    expect(setCookie).toContain("HttpOnly")
    expect(setCookie).toContain("Secure")
    expect(setCookie).toContain("SameSite=Lax")
  })

  it("generates a unique state on each request", async () => {
    const res1 = await worker.fetch(makeRequest("/login/linkedin"), env)
    const res2 = await worker.fetch(makeRequest("/login/linkedin"), env)
    const state1 = new URL(res1.headers.get("Location")).searchParams.get("state")
    const state2 = new URL(res2.headers.get("Location")).searchParams.get("state")
    expect(state1).not.toBe(state2)
  })
})

describe("GET /callback/github", () => {
  it("returns 400 when code is missing", async () => {
    const res = await worker.fetch(makeRequest("/callback/github"), env)
    expect(res.status).toBe(400)
    expect(await res.text()).toBe("Missing code")
  })

  it("returns 502 when token exchange request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 500 })))
    const res = await worker.fetch(makeRequest("/callback/github?code=abc"), env)
    expect(res.status).toBe(502)
    expect(await res.text()).toBe("Token exchange failed")
  })

  it("returns 400 when token response contains an OAuth error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "bad_verification_code", error_description: "The code passed is incorrect" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    )
    const res = await worker.fetch(makeRequest("/callback/github?code=abc"), env)
    expect(res.status).toBe(400)
    expect(await res.text()).toContain("The code passed is incorrect")
  })

  it("returns 400 with error field when error_description is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "bad_verification_code" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    )
    const res = await worker.fetch(makeRequest("/callback/github?code=abc"), env)
    expect(res.status).toBe(400)
    expect(await res.text()).toContain("bad_verification_code")
  })

  it("returns 502 when user profile fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: "tok" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        )
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
    )
    const res = await worker.fetch(makeRequest("/callback/github?code=abc"), env)
    expect(res.status).toBe(502)
    expect(await res.text()).toBe("Failed to fetch user profile")
  })

  it("returns 200 JSON with provider and user data on success", async () => {
    const fakeUser = { id: 1, login: "octocat" }
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: "tok" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(fakeUser), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        )
    )
    const res = await worker.fetch(makeRequest("/callback/github?code=abc"), env)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/json")
    const body = await res.json()
    expect(body.provider).toBe("github")
    expect(body.user).toEqual(fakeUser)
  })

  it("sends the correct token exchange request to GitHub", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "tok" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 1 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    vi.stubGlobal("fetch", mockFetch)

    await worker.fetch(makeRequest("/callback/github?code=mycode"), env)

    const [tokenUrl, tokenOpts] = mockFetch.mock.calls[0]
    expect(tokenUrl).toBe("https://github.com/login/oauth/access_token")
    expect(tokenOpts.method).toBe("POST")
    const sentBody = JSON.parse(tokenOpts.body)
    expect(sentBody.client_id).toBe("gh-client-id")
    expect(sentBody.client_secret).toBe("gh-client-secret")
    expect(sentBody.code).toBe("mycode")
    expect(sentBody.redirect_uri).toBe("https://example.com/callback/github")

    const [userUrl, userOpts] = mockFetch.mock.calls[1]
    expect(userUrl).toBe("https://api.github.com/user")
    expect(userOpts.headers["Authorization"]).toBe("Bearer tok")
  })
})

describe("GET /callback/linkedin", () => {
  it("returns 400 when code is missing", async () => {
    const res = await worker.fetch(makeRequest("/callback/linkedin"), env)
    expect(res.status).toBe(400)
    expect(await res.text()).toBe("Missing code")
  })

  it("returns 400 when state parameter is missing", async () => {
    const res = await worker.fetch(
      makeRequest("/callback/linkedin?code=abc", { headers: { Cookie: "linkedin_state=mystate" } }),
      env
    )
    expect(res.status).toBe(400)
    expect(await res.text()).toBe("Invalid state")
  })

  it("returns 400 when state cookie is missing", async () => {
    const res = await worker.fetch(makeRequest("/callback/linkedin?code=abc&state=mystate"), env)
    expect(res.status).toBe(400)
    expect(await res.text()).toBe("Invalid state")
  })

  it("returns 400 when state parameter does not match cookie", async () => {
    const res = await worker.fetch(
      makeRequest("/callback/linkedin?code=abc&state=wrong", { headers: { Cookie: "linkedin_state=correct" } }),
      env
    )
    expect(res.status).toBe(400)
    expect(await res.text()).toBe("Invalid state")
  })

  it("returns 502 when token exchange request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 500 })))
    const res = await worker.fetch(
      makeRequest("/callback/linkedin?code=abc&state=s1", { headers: { Cookie: "linkedin_state=s1" } }),
      env
    )
    expect(res.status).toBe(502)
    expect(await res.text()).toBe("Token exchange failed")
  })

  it("returns 400 when token response contains an OAuth error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "invalid_grant", error_description: "Code expired" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    )
    const res = await worker.fetch(
      makeRequest("/callback/linkedin?code=abc&state=s1", { headers: { Cookie: "linkedin_state=s1" } }),
      env
    )
    expect(res.status).toBe(400)
    expect(await res.text()).toContain("Code expired")
  })

  it("returns 502 when user profile fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: "litoken" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        )
        .mockResolvedValueOnce(new Response(null, { status: 403 }))
    )
    const res = await worker.fetch(
      makeRequest("/callback/linkedin?code=abc&state=s1", { headers: { Cookie: "linkedin_state=s1" } }),
      env
    )
    expect(res.status).toBe(502)
    expect(await res.text()).toBe("Failed to fetch user profile")
  })

  it("returns 200 JSON with provider and user data on success", async () => {
    const fakeUser = { sub: "123", name: "Alice" }
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: "litoken" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(fakeUser), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        )
    )
    const res = await worker.fetch(
      makeRequest("/callback/linkedin?code=abc&state=s1", { headers: { Cookie: "linkedin_state=s1" } }),
      env
    )
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/json")
    const body = await res.json()
    expect(body.provider).toBe("linkedin")
    expect(body.user).toEqual(fakeUser)
  })

  it("sends the correct token exchange request to LinkedIn", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "litoken" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sub: "123" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    vi.stubGlobal("fetch", mockFetch)

    await worker.fetch(
      makeRequest("/callback/linkedin?code=mycode&state=s1", { headers: { Cookie: "linkedin_state=s1" } }),
      env
    )

    const [tokenUrl, tokenOpts] = mockFetch.mock.calls[0]
    expect(tokenUrl).toBe("https://www.linkedin.com/oauth/v2/accessToken")
    expect(tokenOpts.method).toBe("POST")
    const sentBody = new URLSearchParams(tokenOpts.body)
    expect(sentBody.get("grant_type")).toBe("authorization_code")
    expect(sentBody.get("code")).toBe("mycode")
    expect(sentBody.get("client_id")).toBe("li-client-id")
    expect(sentBody.get("client_secret")).toBe("li-client-secret")
    expect(sentBody.get("redirect_uri")).toBe("https://example.com/callback/linkedin")

    const [profileUrl, profileOpts] = mockFetch.mock.calls[1]
    expect(profileUrl).toBe("https://api.linkedin.com/v2/userinfo")
    expect(profileOpts.headers["Authorization"]).toBe("Bearer litoken")
  })

  it("parses state correctly when Cookie header has multiple cookies", async () => {
    const fakeUser = { sub: "456" }
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: "tok" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(fakeUser), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        )
    )
    const res = await worker.fetch(
      makeRequest("/callback/linkedin?code=abc&state=s2", {
        headers: { Cookie: "other=val; linkedin_state=s2; another=x" },
      }),
      env
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.provider).toBe("linkedin")
  })
})
