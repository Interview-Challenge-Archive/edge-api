export class GitHubProvider {
  constructor(env) {
    this.clientId = env.GITHUB_CLIENT_ID
    this.clientSecret = env.GITHUB_CLIENT_SECRET
  }

  login(request) {
    const url = new URL(request.url)
    const redirectUri = `${url.origin}/callback/github`
    const u = new URL("https://github.com/login/oauth/authorize")
    u.searchParams.set("client_id", this.clientId)
    u.searchParams.set("redirect_uri", redirectUri)
    u.searchParams.set("scope", "read:user user:email")
    return Response.redirect(u.toString(), 302)
  }

  async callback(request) {
    const url = new URL(request.url)
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
        client_id: this.clientId,
        client_secret: this.clientSecret,
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
}
