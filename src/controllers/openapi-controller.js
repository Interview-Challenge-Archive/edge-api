import { OpenApiBuilder } from "openapi3-ts/oas31"

import packageJson from "../../package.json"
import { JsonResponse } from "../responses/base/json-response.js"

export class OpenApiController {
  #pathParamPattern = /:([A-Za-z0-9_]+)/g

  show(request, context) {
    return new JsonResponse(this.#buildOpenApiSpec(request, context))
  }

  #buildOpenApiSpec(request, context) {
    const providerNames = Object.keys(context.providerConfigs)
    const requestUrl = new URL(request.url)
    const builder = OpenApiBuilder.create()

    builder
      .addOpenApiVersion("3.1.0")
      .addInfo({
        title: "Edge API",
        version: packageJson.version,
      })
      .addServer({
        url: requestUrl.origin,
      })

    for (const route of context.routeConfigs) {
      const method = route.method.toLowerCase()
      const path = this.#toOpenApiPath(route.path)

      builder.addPath(path, {
        [method]: this.#buildOperation(route, providerNames),
      })
    }

    return builder.getSpec()
  }

  #toOpenApiPath(path) {
    return path.replace(this.#pathParamPattern, "{$1}")
  }

  #buildPathParameters(path, providerNames) {
    const matches = [...path.matchAll(this.#pathParamPattern)]

    return matches.map((match) => {
      const name = match[1]
      const schema = {
        type: "string",
      }

      if (name === "provider" && providerNames.length > 0) {
        schema.enum = providerNames
      }

      return {
        in: "path",
        name,
        required: true,
        schema,
      }
    })
  }

  #buildOperation(route, providerNames) {
    const parameters = this.#buildPathParameters(route.path, providerNames)
    const operationId = `${route.method.toLowerCase()}_${this.#toOpenApiPath(route.path)
      .replace(/[{}]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")}`
    const summary = route.summary ?? `${route.method} ${route.path}`

    return {
      operationId,
      summary,
      ...(parameters.length > 0 ? { parameters } : {}),
      responses: {
        200: {
          description: "Successful response",
        },
      },
    }
  }
}
