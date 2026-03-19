import providerConfigs from "./config/providers.js"
import routeConfigs from "./config/routes.js"
import { createRouter } from "./helpers/router.js"
import { NotFoundResponse } from "./responses/errors/not-found-response.js"

const router = createRouter(routeConfigs, providerConfigs)

export default {
  async fetch(request, env) {
    const response = await router.fetch(request, env)

    if (!response) {
      return new NotFoundResponse()
    }

    return response
  }
}
