import {
  createAuthorizationUrl,
  createPKCEPair,
  exchangeAuthorizationCode,
  getCodeVerifier,
  readCookie,
} from "../helpers/oauth.js"
import { JsonResponse } from "../responses/base/json-response.js"
import { FailedToFetchUserProfileResponse } from "../responses/oauth/failed-to-fetch-user-profile-response.js"
import { InvalidStateResponse } from "../responses/oauth/invalid-state-response.js"
import { MissingCodeResponse } from "../responses/oauth/missing-code-response.js"
import { PopupResponse } from "../responses/oauth/popup-response.js"
import { RedirectResponse } from "../responses/oauth/redirect-response.js"

export class OAuthController {
  constructor(env, config) {
    this.env = env
    this.config = config
    this.clientId = env[config.env.clientId]
    this.clientSecret = env[config.env.clientSecret]
  }

  appendCookie(headers, name, value) {
    headers.append(
      "Set-Cookie",
      `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/`
    )
  }

  expireCookie(headers, name) {
    headers.append(
      "Set-Cookie",
      `${name}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
    )
  }

  getPopupContext(request) {
    const mode = readCookie(request, this.config.cookies.mode)
    const encodedOrigin = readCookie(request, this.config.cookies.origin)
    let targetOrigin = "*"

    if (encodedOrigin) {
      try {
        targetOrigin = new URL(decodeURIComponent(encodedOrigin)).origin
      } catch {
        targetOrigin = "*"
      }
    }

    return {
      enabled: mode === "popup",
      targetOrigin,
    }
  }

  createCleanupHeaders() {
    const headers = new Headers()

    this.expireCookie(headers, this.config.cookies.pkce)
    this.expireCookie(headers, this.config.cookies.mode)
    this.expireCookie(headers, this.config.cookies.origin)

    if (this.config.cookies.state) {
      this.expireCookie(headers, this.config.cookies.state)
    }

    return headers
  }

  createPopupErrorResponse(message, popupContext, status, headers = {}) {
    return new PopupResponse({
      type: "oauth-complete",
      ok: false,
      error: message,
      targetOrigin: popupContext.targetOrigin,
    }, {
      headers,
      status,
      title: "Authentication failed",
    })
  }

  async login(request) {
    const url = new URL(request.url)
    const usesPkce = this.config.usePkce !== false
    const pkcePair = usesPkce ? await createPKCEPair() : null

    let scope = url.searchParams.get("scope") ?? this.config.scope

    const response = createAuthorizationUrl(request, this.config.authorizationEndpoint, {
      client_id: this.clientId,
      redirect_uri: `${url.origin}${this.config.redirectPath}`,
      scope,
      ...(pkcePair ? {
        code_challenge: pkcePair.codeChallenge,
        code_challenge_method: "S256",
      } : {}),
      ...this.config.authorizationParams,
    })
    const headers = new Headers(response.headers)

    if (pkcePair) {
      this.appendCookie(headers, this.config.cookies.pkce, pkcePair.codeVerifier)
    }

    if (url.searchParams.get("mode") === "popup") {
      this.appendCookie(headers, this.config.cookies.mode, "popup")
    }

    const origin = url.searchParams.get("origin")

    if (origin) {
      this.appendCookie(headers, this.config.cookies.origin, encodeURIComponent(origin))
    }

    if (this.config.requiresState) {
      const state = crypto.randomUUID()
      const location = new URL(response.headers.get("Location"))

      location.searchParams.set("state", state)
      headers.set("Location", location.toString())
      this.appendCookie(headers, this.config.cookies.state, state)
    }

    return new RedirectResponse(headers)
  }

  async callback(request) {
    const url = new URL(request.url)
    const code = url.searchParams.get("code")
    const popupContext = this.getPopupContext(request)
    const cleanupHeaders = this.createCleanupHeaders()

    if (!code) {
      if (popupContext.enabled) {
        return this.createPopupErrorResponse("Missing code", popupContext, 400, cleanupHeaders)
      }

      return new MissingCodeResponse()
    }

    let expectedState

    if (this.config.requiresState) {
      expectedState = readCookie(request, this.config.cookies.state)

      if (!expectedState) {
        if (popupContext.enabled) {
          return this.createPopupErrorResponse("Invalid state", popupContext, 400, cleanupHeaders)
        }

        return new InvalidStateResponse()
      }
    }

    const { error, tokens } = await exchangeAuthorizationCode({
      request,
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      redirectPath: this.config.redirectPath,
      issuer: this.config.issuer,
      authorizationEndpoint: this.config.authorizationEndpoint,
      tokenEndpoint: this.config.tokenEndpoint,
      tokenContentType: this.config.tokenContentType,
      expectedState,
      codeVerifier: this.config.usePkce === false
        ? undefined
        : getCodeVerifier(request, this.config.cookies.pkce),
    })

    if (error) {
      if (popupContext.enabled) {
        return this.createPopupErrorResponse(await error.text(), popupContext, error.status, cleanupHeaders)
      }

      return error
    }

    const profileResponse = await fetch(this.config.profileEndpoint, {
      headers: {
        "Authorization": `Bearer ${tokens.access_token}`,
        ...this.config.profileHeaders,
      },
    })

    if (!profileResponse.ok) {
      if (popupContext.enabled) {
        return this.createPopupErrorResponse("Failed to fetch user profile", popupContext, 502, cleanupHeaders)
      }

      return new FailedToFetchUserProfileResponse()
    }

    const user = await profileResponse.json()
    const payload = {
      provider: this.config.provider,
      accessToken: tokens.access_token,
      tokenType: tokens.token_type || "Bearer",
      scope: tokens.scope || this.config.scope,
      expiresIn: Number.isFinite(tokens.expires_in) ? tokens.expires_in : null,
      authenticatedAt: new Date().toISOString(),
      user,
    }

    if (popupContext.enabled) {
      return new PopupResponse({
        type: "oauth-complete",
        ok: true,
        payload,
        targetOrigin: popupContext.targetOrigin,
      }, {
        headers: cleanupHeaders,
      })
    }

    return new JsonResponse({
      provider: payload.provider,
      user: payload.user,
    }, 200, cleanupHeaders)
  }
}
