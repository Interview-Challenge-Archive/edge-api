export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    switch (url.pathname) {

      case "/login/github": {
        const redirectUri = `${url.origin}/callback/github`
        const u = new URL("https://github.com/login/oauth/authorize")
        u.searchParams.set("client_id", env.GITHUB_CLIENT_ID)
        u.searchParams.set("redirect_uri", redirectUri)
        u.searchParams.set("scope", "read:user user:email")
        return Response.redirect(u.toString(), 302)
      }

      case "/login/linkedin": {
        const redirectUri = `${url.origin}/callback/linkedin`
        const state = crypto.randomUUID()
        const u = new URL("https://www.linkedin.com/oauth/v2/authorization")
        u.searchParams.set("response_type", "code")
        u.searchParams.set("client_id", env.LINKEDIN_CLIENT_ID)
        u.searchParams.set("redirect_uri", redirectUri)
        u.searchParams.set("scope", "openid profile email")
        u.searchParams.set("state", state)
        const response = Response.redirect(u.toString(), 302)
        const headers = new Headers(response.headers)
        headers.set("Set-Cookie", `linkedin_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/`)
        return new Response(null, { status: 302, headers })
      }

      case "/callback/github": {
        const code = url.searchParams.get("code")
        if (!code) return new Response("Missing code", { status: 400 })

        const redirectUri = `${url.origin}/callback/github`

        const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: redirectUri
          })
        })

        if (!tokenRes.ok) return new Response("Token exchange failed", { status: 502 })

        const token = await tokenRes.json()
        if (token.error) return new Response(`OAuth error: ${token.error_description || token.error}`, { status: 400 })

        const userRes = await fetch("https://api.github.com/user", {
          headers: {
            "Authorization": `Bearer ${token.access_token}`,
            "User-Agent": "worker"
          }
        })

        if (!userRes.ok) return new Response("Failed to fetch user profile", { status: 502 })

        const user = await userRes.json()

        return new Response(JSON.stringify({
          provider: "github",
          user
        }), { headers: { "content-type": "application/json" } })
      }

      case "/callback/linkedin": {
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
            client_id: env.LINKEDIN_CLIENT_ID,
            client_secret: env.LINKEDIN_CLIENT_SECRET,
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

      default:
        return new Response("OK")
    }
  }
}
