export async function handleCallbackLinkedIn(request, env) {
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
