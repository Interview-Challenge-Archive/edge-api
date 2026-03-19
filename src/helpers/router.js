import compose from "koa-compose"
import { Router } from "itty-router"

import { InternalServerErrorResponse } from "../responses/errors/internal-server-error-response.js"
import { NotFoundResponse } from "../responses/errors/not-found-response.js"

async function runMiddlewares(route, context, action, controller) {
  const middlewares = [
    ...(route.middlewares ?? []),
    async (middlewareContext) => {
      middlewareContext.response = await action.call(controller, middlewareContext.request)
    },
  ]

  await compose(middlewares)(context)
}

function createRouteHandler(route, providerConfigs) {
  return async (request, env) => {
    if (request.params.provider && !providerConfigs[request.params.provider]) {
      return new NotFoundResponse()
    }

    const Controller = route.controller

    if (!Controller) {
      return new InternalServerErrorResponse()
    }

    const config = request.params.provider ? providerConfigs[request.params.provider] : null
    const controller = new Controller(env, config)
    const action = controller[route.action]

    if (typeof action !== "function") {
      return new InternalServerErrorResponse()
    }

    const context = {
      env,
      params: request.params,
      request,
      response: null,
      route,
      state: {},
      url: new URL(request.url),
    }
    await runMiddlewares(route, context, action, controller)

    if (!context.response) {
      return new InternalServerErrorResponse()
    }

    if (typeof route.corsify === "function") {
      const corsify = route.corsify(env)
      context.response = corsify(context.response, request)
    }

    return context.response
  }
}

export function createRouter(routeConfigs, providerConfigs) {
  const router = Router()

  for (const route of routeConfigs) {
    router[route.method.toLowerCase()](route.path, createRouteHandler(route, providerConfigs))
  }

  return router
}
