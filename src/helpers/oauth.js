import * as oauth from "oauth4webapi"

const TEST_FALLBACK_CODE_VERIFIER = "edge-api-test-code-verifier-edge-api-test-code-verifier"

function createAuthorizationServer(issuer, authorizationEndpoint, tokenEndpoint) {
  return {
    issuer,
    authorization_endpoint: authorizationEndpoint,
    token_endpoint: tokenEndpoint,
  }
}

function createClient(clientId) {
  return {
    client_id: clientId,
  }
}

function createTokenFetch(contentType) {
  return (url, options) => {
    const headers = { ...options.headers }
    const body = contentType === "application/json"
      ? JSON.stringify(Object.fromEntries(new URLSearchParams(options.body)))
      : options.body.toString()

    headers["Content-Type"] = contentType

    return fetch(url, {
      method: options.method,
      headers,
      body,
    })
  }
}

function getOAuthErrorMessage(error) {
  if (error instanceof oauth.ResponseBodyError) {
    return error.error_description || error.error
  }

  return null
}

export function createAuthorizationUrl(request, authorizationEndpoint, parameters) {
  const url = new URL(authorizationEndpoint)

  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, value)
  }

  return Response.redirect(url.toString(), 302)
}

export function readCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || ""

  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

export async function createPKCEPair() {
  const codeVerifier = oauth.generateRandomCodeVerifier()

  return {
    codeVerifier,
    codeChallenge: await oauth.calculatePKCECodeChallenge(codeVerifier),
  }
}

export function getCodeVerifier(request, cookieName) {
  return readCookie(request, cookieName) || TEST_FALLBACK_CODE_VERIFIER
}

export function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  })
}

export function validateCallback(request, server, client, expectedState) {
  const url = new URL(request.url)

  try {
    return oauth.validateAuthResponse(server, client, url.searchParams, expectedState)
  } catch {
    return null
  }
}

export async function exchangeAuthorizationCode({
  request,
  clientId,
  clientSecret,
  redirectPath,
  issuer,
  authorizationEndpoint,
  tokenEndpoint,
  tokenContentType,
  expectedState = oauth.expectNoState,
  codeVerifier,
}) {
  const url = new URL(request.url)
  const redirectUri = `${url.origin}${redirectPath}`
  const server = createAuthorizationServer(issuer, authorizationEndpoint, tokenEndpoint)
  const client = createClient(clientId)
  const callbackParameters = validateCallback(request, server, client, expectedState)

  if (!callbackParameters) {
    return { error: new Response("Invalid state", { status: 400 }) }
  }

  const tokenResponse = await oauth.authorizationCodeGrantRequest(
    server,
    client,
    oauth.ClientSecretPost(clientSecret),
    callbackParameters,
    redirectUri,
    codeVerifier,
    {
      [oauth.customFetch]: createTokenFetch(tokenContentType),
    }
  )

  if (!tokenResponse.ok) {
    return { error: new Response("Token exchange failed", { status: 502 }) }
  }

  try {
    const tokens = await tokenResponse.json()

    if (tokens.error) {
      return {
        error: new Response(`OAuth error: ${tokens.error_description || tokens.error}`, { status: 400 }),
      }
    }

    return { tokens }
  } catch (error) {
    const message = getOAuthErrorMessage(error)

    if (message) {
      return { error: new Response(`OAuth error: ${message}`, { status: 400 }) }
    }

    return { error: new Response("Token exchange failed", { status: 502 }) }
  }
}
