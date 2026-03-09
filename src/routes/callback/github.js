export async function handleCallbackGitHub(request, env) {
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
