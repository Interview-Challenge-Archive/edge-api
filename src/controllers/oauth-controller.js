import {
  createAuthorizationUrl,
  createPKCEPair,
  exchangeAuthorizationCode,
  getCodeVerifier,
  readCookie,
} from "../helpers/oauth.js"
import { FailedToFetchUserProfileResponse } from "../responses/failed-to-fetch-user-profile-response.js"
import { InvalidStateResponse } from "../responses/invalid-state-response.js"
import { JsonResponse } from "../responses/json-response.js"
import { MissingCodeResponse } from "../responses/missing-code-response.js"
import { RedirectResponse } from "../responses/redirect-response.js"

export class OAuthController {
  constructor(env, config) {
    this.config = config
    this.clientId = env[config.env.clientId]
    this.clientSecret = env[config.env.clientSecret]
  }

  async login(request) {
    const url = new URL(request.url)
    const { codeVerifier, codeChallenge } = await createPKCEPair()
    const response = createAuthorizationUrl(request, this.config.authorizationEndpoint, {
      client_id: this.clientId,
      redirect_uri: `${url.origin}${this.config.redirectPath}`,
      scope: this.config.scope,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      ...this.config.authorizationParams,
    })
    const headers = new Headers(response.headers)

    headers.set(
      "Set-Cookie",
      `${this.config.cookies.pkce}=${codeVerifier}; HttpOnly; Secure; SameSite=Lax; Path=/`
    )

    if (this.config.requiresState) {
      const state = crypto.randomUUID()
      const location = new URL(response.headers.get("Location"))

      location.searchParams.set("state", state)
      headers.set("Location", location.toString())
      headers.append(
        "Set-Cookie",
        `${this.config.cookies.state}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/`
      )
    }

    return new RedirectResponse(headers)
  }

  async callback(request) {
    const url = new URL(request.url)
    const code = url.searchParams.get("code")

    if (!code) {
      return new MissingCodeResponse()
    }

    let expectedState

    if (this.config.requiresState) {
      expectedState = readCookie(request, this.config.cookies.state)

      if (!expectedState) {
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
      codeVerifier: getCodeVerifier(request, this.config.cookies.pkce),
    })

    if (error) {
      return error
    }

    const profileResponse = await fetch(this.config.profileEndpoint, {
      headers: {
        "Authorization": `Bearer ${tokens.access_token}`,
        ...this.config.profileHeaders,
      },
    })

    if (!profileResponse.ok) {
      return new FailedToFetchUserProfileResponse()
    }

    return new JsonResponse({
      provider: this.config.provider,
      user: await profileResponse.json(),
    })
  }
}
