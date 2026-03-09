export function handleLoginGitHub(request, env) {
  const url = new URL(request.url)
  const redirectUri = `${url.origin}/callback/github`
  const u = new URL("https://github.com/login/oauth/authorize")
  u.searchParams.set("client_id", env.GITHUB_CLIENT_ID)
  u.searchParams.set("redirect_uri", redirectUri)
  u.searchParams.set("scope", "read:user user:email")
  return Response.redirect(u.toString(), 302)
}
