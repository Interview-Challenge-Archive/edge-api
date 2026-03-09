import { handleLoginGitHub } from "./routes/login/github.js"
import { handleLoginLinkedIn } from "./routes/login/linkedin.js"
import { handleCallbackGitHub } from "./routes/callback/github.js"
import { handleCallbackLinkedIn } from "./routes/callback/linkedin.js"

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    switch (url.pathname) {
      case "/login/github":
        return handleLoginGitHub(request, env)

      case "/login/linkedin":
        return handleLoginLinkedIn(request, env)

      case "/callback/github":
        return handleCallbackGitHub(request, env)

      case "/callback/linkedin":
        return handleCallbackLinkedIn(request, env)

      default:
        return new Response("OK")
    }
  }
}
