export function handleLoginLinkedIn(request, env) {
  const url = new URL(request.url)
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
