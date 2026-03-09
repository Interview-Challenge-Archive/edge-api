export class LinkedInProvider {
  constructor(env) {
    this.clientId = env.LINKEDIN_CLIENT_ID
    this.clientSecret = env.LINKEDIN_CLIENT_SECRET
  }

  login(request) {
    const url = new URL(request.url)
    const redirectUri = `${url.origin}/callback/linkedin`
    const state = crypto.randomUUID()
    const u = new URL("https://www.linkedin.com/oauth/v2/authorization")
    u.searchParams.set("response_type", "code")
    u.searchParams.set("client_id", this.clientId)
    u.searchParams.set("redirect_uri", redirectUri)
    u.searchParams.set("scope", "openid profile email")
    u.searchParams.set("state", state)
    const response = Response.redirect(u.toString(), 302)
    const headers = new Headers(response.headers)
    headers.set("Set-Cookie", `linkedin_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/`)
    return new Response(null, { status: 302, headers })
  }

  async callback(request) {
    const url = new URL(request.url)
    const code = url.searchParams.get("code")
    if (!code) return new Response("Missing code", { status: 400 })

    const stateParam = url.searchParams.get("state")
    const cookieHeader = request.headers.get("Cookie") || ""
    const storedState = cookieHeader.split(";").map(c => c.trim()).find(c => c.startsWith("linkedin_state="))?.split("=")[1]
    if (!stateParam || !storedState || stateParam !== storedState) {
      return new Response("Invalid state", { status: 400 })
    }

    const redirectUri = `${url.origin}/callback/linkedin`

    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri
      })
    })

    if (!tokenRes.ok) return new Response("Token exchange failed", { status: 502 })

    const token = await tokenRes.json()
    if (token.error) return new Response(`OAuth error: ${token.error_description || token.error}`, { status: 400 })

    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: {
        "Authorization": `Bearer ${token.access_token}`
      }
    })

    if (!profileRes.ok) return new Response("Failed to fetch user profile", { status: 502 })

    const user = await profileRes.json()

    return new Response(JSON.stringify({
      provider: "linkedin",
      user
    }), { headers: { "content-type": "application/json" } })
  }
}
