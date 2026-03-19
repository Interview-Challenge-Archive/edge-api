import { beforeEach, describe, expect, it, vi } from "vitest"

import providerConfigs from "../../src/config/providers.js"
import { OAuthController } from "../../src/controllers/oauth-controller.js"

const env = {
  GITHUB_CLIENT_ID: "gh-client-id",
  GITHUB_CLIENT_SECRET: "gh-client-secret",
  LINKEDIN_CLIENT_ID: "li-client-id",
  LINKEDIN_CLIENT_SECRET: "li-client-secret",
  ALLOWED_ORIGINS: "https://app.example.com, https://another-app.com",
}

function makeRequest(path, { method = "GET", headers = {} } = {}) {
  return new Request("https://example.com" + path, { method, headers })
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe("OAuthController github", () => {
  it("redirects to GitHub OAuth authorization URL", async () => {
    const controller = new OAuthController(env, providerConfigs.github)
    const res = await controller.login(makeRequest("/login/github"))

    expect(res.status).toBe(302)
    const location = new URL(res.headers.get("Location"))
    expect(location.origin + location.pathname).toBe("https://github.com/login/oauth/authorize")
    expect(location.searchParams.get("client_id")).toBe("gh-client-id")
    expect(location.searchParams.get("redirect_uri")).toBe("https://example.com/callback/github")
    expect(location.searchParams.get("scope")).toBe("read:user user:email")
    expect(location.searchParams.get("code_challenge")).toBeTruthy()
    expect(location.searchParams.get("code_challenge_method")).toBe("S256")
  })

  it("uses custom scope from query parameter for GitHub", async () => {
    const controller = new OAuthController(env, providerConfigs.github)
    const res = await controller.login(makeRequest("/login/github?scope=repo user"))

    expect(res.status).toBe(302)
    const location = new URL(res.headers.get("Location"))
    expect(location.searchParams.get("scope")).toBe("repo user")
  })

  it("stores popup mode and app origin cookies when popup login is requested", async () => {
    const controller = new OAuthController(env, providerConfigs.github)
    const res = await controller.login(
      makeRequest("/login/github?mode=popup&origin=https%3A%2F%2Fapp.example")
    )

    expect(res.status).toBe(302)
    expect(res.headers.get("Set-Cookie")).toContain("github_pkce=")
    expect(res.headers.get("Set-Cookie")).toContain("github_auth_mode=popup")
    expect(res.headers.get("Set-Cookie")).toContain("github_auth_origin=https%3A%2F%2Fapp.example")
  })

  it("returns 400 when code is missing", async () => {
    const controller = new OAuthController(env, providerConfigs.github)
    const res = await controller.callback(makeRequest("/callback/github"))

    expect(res.status).toBe(400)
    expect(await res.text()).toBe("Missing code")
  })

  it("returns popup HTML when code is missing in popup mode", async () => {
    const controller = new OAuthController(env, providerConfigs.github)
    const res = await controller.callback(
      makeRequest("/callback/github", {
        headers: {
          Cookie: "github_auth_mode=popup; github_auth_origin=https%3A%2F%2Fapp.example"
        }
      })
    )

    expect(res.status).toBe(400)
    expect(res.headers.get("content-type")).toContain("text/html")
    expect(await res.text()).toContain("oauth-complete")
  })

  it("returns 502 when token exchange request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 500 })))
    const controller = new OAuthController(env, providerConfigs.github)
    const res = await controller.callback(makeRequest("/callback/github?code=abc"))

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
    const controller = new OAuthController(env, providerConfigs.github)
    const res = await controller.callback(makeRequest("/callback/github?code=abc"))

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
    const controller = new OAuthController(env, providerConfigs.github)
    const res = await controller.callback(makeRequest("/callback/github?code=abc"))

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
    const controller = new OAuthController(env, providerConfigs.github)
    const res = await controller.callback(makeRequest("/callback/github?code=abc"))

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
    const controller = new OAuthController(env, providerConfigs.github)
    const res = await controller.callback(makeRequest("/callback/github?code=abc"))

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/json")
    const body = await res.json()
    expect(body.provider).toBe("github")
    expect(body.user).toEqual(fakeUser)
  })

  it("returns popup HTML with the OAuth payload on success in popup mode", async () => {
    const fakeUser = { id: 1, login: "octocat" }
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: "tok", token_type: "Bearer", scope: "read:user" }), {
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
    const controller = new OAuthController(env, providerConfigs.github)
    const res = await controller.callback(makeRequest("/callback/github?code=abc", {
      headers: {
        Cookie: "github_auth_mode=popup; github_auth_origin=https%3A%2F%2Fapp.example"
      }
    }))
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/html")
    expect(body).toContain("oauth-complete")
    expect(body).toContain("github")
    expect(body).toContain("tok")
    expect(body).toContain("octocat")
    expect(body).toContain("https://app.example")
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
    const controller = new OAuthController(env, providerConfigs.github)

    await controller.callback(makeRequest("/callback/github?code=mycode"))

    const [tokenUrl, tokenOpts] = mockFetch.mock.calls[0]
    expect(tokenUrl).toBe("https://github.com/login/oauth/access_token")
    expect(tokenOpts.method).toBe("POST")
    const sentBody = new URLSearchParams(tokenOpts.body)
    expect(sentBody.get("client_id")).toBe("gh-client-id")
    expect(sentBody.get("client_secret")).toBe("gh-client-secret")
    expect(sentBody.get("code")).toBe("mycode")
    expect(sentBody.get("redirect_uri")).toBe("https://example.com/callback/github")
    expect(tokenOpts.headers["Content-Type"]).toBe("application/x-www-form-urlencoded")
    expect(tokenOpts.headers["Accept"]).toBe("application/json")
    const [userUrl, userOpts] = mockFetch.mock.calls[1]
    expect(userUrl).toBe("https://api.github.com/user")
    expect(userOpts.headers["Authorization"]).toBe("Bearer tok")
  })
})

describe("OAuthController linkedin", () => {
  it("redirects to LinkedIn OAuth authorization URL with state cookie", async () => {
    const controller = new OAuthController(env, providerConfigs.linkedin)
    const res = await controller.login(makeRequest("/login/linkedin"))

    expect(res.status).toBe(302)
    const location = new URL(res.headers.get("Location"))
    expect(location.origin + location.pathname).toBe("https://www.linkedin.com/oauth/v2/authorization")
    expect(location.searchParams.get("response_type")).toBe("code")
    expect(location.searchParams.get("client_id")).toBe("li-client-id")
    expect(location.searchParams.get("redirect_uri")).toBe("https://example.com/callback/linkedin")
    expect(location.searchParams.get("scope")).toBe("openid profile email")
    expect(location.searchParams.get("code_challenge")).toBeNull()
    expect(location.searchParams.get("code_challenge_method")).toBeNull()

    const state = location.searchParams.get("state")
    expect(state).toBeTruthy()

    const setCookie = res.headers.get("Set-Cookie")
    expect(setCookie).not.toContain("linkedin_pkce=")
    expect(setCookie).toContain(`linkedin_state=${state}`)
    expect(setCookie).toContain("HttpOnly")
    expect(setCookie).toContain("Secure")
    expect(setCookie).toContain("SameSite=Lax")
  })

  it("uses custom scope from query parameter for LinkedIn", async () => {
    const controller = new OAuthController(env, providerConfigs.linkedin)
    const res = await controller.login(makeRequest("/login/linkedin?scope=openid profile"))

    expect(res.status).toBe(302)
    const location = new URL(res.headers.get("Location"))
    expect(location.searchParams.get("scope")).toBe("openid profile")
  })

  it("generates a unique state on each request", async () => {
    const controller = new OAuthController(env, providerConfigs.linkedin)
    const res1 = await controller.login(makeRequest("/login/linkedin"))
    const res2 = await controller.login(makeRequest("/login/linkedin"))
    const state1 = new URL(res1.headers.get("Location")).searchParams.get("state")
    const state2 = new URL(res2.headers.get("Location")).searchParams.get("state")

    expect(state1).not.toBe(state2)
  })

  it("returns 400 when code is missing", async () => {
    const controller = new OAuthController(env, providerConfigs.linkedin)
    const res = await controller.callback(makeRequest("/callback/linkedin"))

    expect(res.status).toBe(400)
    expect(await res.text()).toBe("Missing code")
  })

  it("returns 400 when state parameter is missing", async () => {
    const controller = new OAuthController(env, providerConfigs.linkedin)
    const res = await controller.callback(
      makeRequest("/callback/linkedin?code=abc", { headers: { Cookie: "linkedin_state=mystate" } })
    )

    expect(res.status).toBe(400)
    expect(await res.text()).toBe("Invalid state")
  })

  it("returns 400 when state cookie is missing", async () => {
    const controller = new OAuthController(env, providerConfigs.linkedin)
    const res = await controller.callback(makeRequest("/callback/linkedin?code=abc&state=mystate"))

    expect(res.status).toBe(400)
    expect(await res.text()).toBe("Invalid state")
  })

  it("returns 400 when state parameter does not match cookie", async () => {
    const controller = new OAuthController(env, providerConfigs.linkedin)
    const res = await controller.callback(
      makeRequest("/callback/linkedin?code=abc&state=wrong", { headers: { Cookie: "linkedin_state=correct" } })
    )

    expect(res.status).toBe(400)
    expect(await res.text()).toBe("Invalid state")
  })

  it("returns 502 when token exchange request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 500 })))
    const controller = new OAuthController(env, providerConfigs.linkedin)
    const res = await controller.callback(
      makeRequest("/callback/linkedin?code=abc&state=s1", { headers: { Cookie: "linkedin_state=s1" } })
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
    const controller = new OAuthController(env, providerConfigs.linkedin)
    const res = await controller.callback(
      makeRequest("/callback/linkedin?code=abc&state=s1", { headers: { Cookie: "linkedin_state=s1" } })
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
    const controller = new OAuthController(env, providerConfigs.linkedin)
    const res = await controller.callback(
      makeRequest("/callback/linkedin?code=abc&state=s1", { headers: { Cookie: "linkedin_state=s1" } })
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
    const controller = new OAuthController(env, providerConfigs.linkedin)
    const res = await controller.callback(
      makeRequest("/callback/linkedin?code=abc&state=s1", { headers: { Cookie: "linkedin_state=s1" } })
    )

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/json")
    const body = await res.json()
    expect(body.provider).toBe("linkedin")
    expect(body.user).toEqual(fakeUser)
  })

  it("returns popup HTML with the OAuth payload on success in popup mode", async () => {
    const fakeUser = { sub: "123", name: "Alice" }
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: "litoken", token_type: "Bearer" }), {
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
    const controller = new OAuthController(env, providerConfigs.linkedin)
    const res = await controller.callback(
      makeRequest("/callback/linkedin?code=abc&state=s1", {
        headers: {
          Cookie: "linkedin_state=s1; linkedin_auth_mode=popup; linkedin_auth_origin=https%3A%2F%2Fapp.example"
        }
      })
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/html")
    expect(body).toContain("oauth-complete")
    expect(body).toContain("linkedin")
    expect(body).toContain("litoken")
    expect(body).toContain("Alice")
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
    const controller = new OAuthController(env, providerConfigs.linkedin)

    await controller.callback(
      makeRequest("/callback/linkedin?code=mycode&state=s1", { headers: { Cookie: "linkedin_state=s1" } })
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
    expect(sentBody.get("code_verifier")).toBeNull()

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
    const controller = new OAuthController(env, providerConfigs.linkedin)
    const res = await controller.callback(
      makeRequest("/callback/linkedin?code=abc&state=s2", {
        headers: { Cookie: "other=val; linkedin_state=s2; another=x" },
      })
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.provider).toBe("linkedin")
  })
})



