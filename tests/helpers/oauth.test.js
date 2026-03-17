import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createAuthorizationUrl,
  createPKCEPair,
  exchangeAuthorizationCode,
  getCodeVerifier,
  readCookie,
  validateCallback,
} from "../../src/helpers/oauth.js"

function makeRequest(path, { headers = {} } = {}) {
  return new Request(`https://example.com${path}`, { headers })
}

const server = {
  issuer: "https://example.com",
  authorization_endpoint: "https://example.com/oauth/authorize",
  token_endpoint: "https://example.com/oauth/token",
}

const client = {
  client_id: "client-id",
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe("oauth helper", () => {
  it("creates authorization redirect URLs with parameters", () => {
    const response = createAuthorizationUrl(makeRequest("/login"), "https://example.com/oauth/authorize", {
      client_id: "client-id",
      scope: "profile",
    })
    const location = new URL(response.headers.get("Location"))

    expect(response.status).toBe(302)
    expect(location.origin + location.pathname).toBe("https://example.com/oauth/authorize")
    expect(location.searchParams.get("client_id")).toBe("client-id")
    expect(location.searchParams.get("scope")).toBe("profile")
  })

  it("reads cookie values by name", () => {
    const request = makeRequest("/callback", {
      headers: { Cookie: "foo=bar; test_cookie=value; another=x" },
    })

    expect(readCookie(request, "test_cookie")).toBe("value")
  })

  it("returns undefined when a cookie is missing", () => {
    expect(readCookie(makeRequest("/callback"), "missing")).toBeUndefined()
  })

  it("creates PKCE pairs", async () => {
    const { codeVerifier, codeChallenge } = await createPKCEPair()

    expect(codeVerifier).toBeTruthy()
    expect(codeChallenge).toBeTruthy()
    expect(codeVerifier).not.toBe(codeChallenge)
  })

  it("returns the cookie code verifier when present", () => {
    const request = makeRequest("/callback", {
      headers: { Cookie: "pkce=test-verifier" },
    })

    expect(getCodeVerifier(request, "pkce")).toBe("test-verifier")
  })

  it("falls back to the default code verifier when cookie is absent", () => {
    expect(getCodeVerifier(makeRequest("/callback"), "pkce")).toBe(
      "edge-api-test-code-verifier-edge-api-test-code-verifier"
    )
  })

  it("validates callback parameters when state matches", () => {
    const params = validateCallback(
      makeRequest("/callback?code=abc&state=s1"),
      server,
      client,
      "s1"
    )

    expect(params.get("code")).toBe("abc")
  })

  it("returns null when callback validation fails", () => {
    const params = validateCallback(
      makeRequest("/callback?code=abc&state=wrong"),
      server,
      client,
      "s1"
    )

    expect(params).toBeNull()
  })

  it("returns invalid state when callback validation fails in exchangeAuthorizationCode", async () => {
    const { error } = await exchangeAuthorizationCode({
      request: makeRequest("/callback?code=abc&state=wrong"),
      clientId: "client-id",
      clientSecret: "secret",
      redirectPath: "/callback",
      issuer: "https://example.com",
      authorizationEndpoint: "https://example.com/oauth/authorize",
      tokenEndpoint: "https://example.com/oauth/token",
      tokenContentType: "application/json",
      expectedState: "s1",
      codeVerifier: "verifier",
    })

    expect(error.status).toBe(400)
    expect(await error.text()).toBe("Invalid state")
  })

  it("returns token exchange failed when the token endpoint is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 500 })))

    const { error } = await exchangeAuthorizationCode({
      request: makeRequest("/callback?code=abc"),
      clientId: "client-id",
      clientSecret: "secret",
      redirectPath: "/callback",
      issuer: "https://example.com",
      authorizationEndpoint: "https://example.com/oauth/authorize",
      tokenEndpoint: "https://example.com/oauth/token",
      tokenContentType: "application/json",
      codeVerifier: "verifier",
    })

    expect(error.status).toBe(502)
    expect(await error.text()).toBe("Token exchange failed")
  })

  it("returns oauth errors from token responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "invalid_grant", error_description: "Bad code" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    )

    const { error } = await exchangeAuthorizationCode({
      request: makeRequest("/callback?code=abc"),
      clientId: "client-id",
      clientSecret: "secret",
      redirectPath: "/callback",
      issuer: "https://example.com",
      authorizationEndpoint: "https://example.com/oauth/authorize",
      tokenEndpoint: "https://example.com/oauth/token",
      tokenContentType: "application/json",
      codeVerifier: "verifier",
    })

    expect(error.status).toBe(400)
    expect(await error.text()).toBe("OAuth error: Bad code")
  })

  it("returns parsed tokens on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    )

    const result = await exchangeAuthorizationCode({
      request: makeRequest("/callback?code=abc"),
      clientId: "client-id",
      clientSecret: "secret",
      redirectPath: "/callback",
      issuer: "https://example.com",
      authorizationEndpoint: "https://example.com/oauth/authorize",
      tokenEndpoint: "https://example.com/oauth/token",
      tokenContentType: "application/json",
      codeVerifier: "verifier",
    })

    expect(result.tokens).toEqual({ access_token: "token" })
  })
})
