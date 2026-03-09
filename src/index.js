import { GitHubProvider } from "./providers/github.js"
import { LinkedInProvider } from "./providers/linkedin.js"

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const github = new GitHubProvider(env)
    const linkedin = new LinkedInProvider(env)

    switch (url.pathname) {
      case "/login/github":
        return github.login(request)

      case "/login/linkedin":
        return linkedin.login(request)

      case "/callback/github":
        return github.callback(request)

      case "/callback/linkedin":
        return linkedin.callback(request)

      default:
        return new Response("OK")
    }
  }
}
