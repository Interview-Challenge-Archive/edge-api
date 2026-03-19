import { OpenApiController } from "../controllers/openapi-controller.js"
import { OAuthController } from "../controllers/oauth-controller.js"
import { TeapotController } from "../controllers/teapot-controller.js"
import { VersionController } from "../controllers/version-controller.js"
import { createCorsify } from "../helpers/cors.js"

export default [
  {
    method: "GET",
    path: "/login/:provider",
    controller: OAuthController,
    action: "login",
    corsify: createCorsify,
  },
  {
    method: "GET",
    path: "/callback/:provider",
    controller: OAuthController,
    action: "callback",
  },
  {
    method: "GET",
    path: "/version",
    controller: VersionController,
    action: "show",
  },
  {
    method: "GET",
    path: "/openapi.json",
    controller: OpenApiController,
    action: "show",
    summary: "OpenAPI specification",
  },
  {
    method: "GET",
    path: "/",
    controller: TeapotController,
    action: "brew",
  },
]
