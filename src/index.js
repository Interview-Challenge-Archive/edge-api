import compose from "koa-compose"

import providerConfigs from "./config/providers.js"
import routeConfigs from "./config/routes.js"
import { matchRoute } from "./helpers/routing.js"
import { InternalServerErrorResponse } from "./responses/errors/internal-server-error-response.js"
import { NotFoundResponse } from "./responses/errors/not-found-response.js"

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const match = matchRoute(routeConfigs, url.pathname, request.method)

    if (!match) {
      return new NotFoundResponse()
    }

    if (match.params.provider && !providerConfigs[match.params.provider]) {
      return new NotFoundResponse()
    }

    const Controller = match.route.controller

    if (!Controller) {
      return new InternalServerErrorResponse()
    }

    const config = match.params.provider ? providerConfigs[match.params.provider] : null
    const controller = new Controller(env, config)

    const context = {
      env,
      params: match.params,
      request,
      response: null,
      route: match.route,
      state: {},
      url,
    }
    const middlewares = [
      ...(match.route.middlewares ?? []),
      async (middlewareContext) => {
        middlewareContext.response = await controller[match.route.action](middlewareContext.request)
      },
    ]

    await compose(middlewares)(context)

    if (!context.response) {
      return new InternalServerErrorResponse()
    }

    return context.response
  }
}
