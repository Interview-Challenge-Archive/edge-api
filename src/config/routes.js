import { OAuthController } from "../controllers/oauth-controller.js"
import { TeapotController } from "../controllers/teapot-controller.js"
import { VersionController } from "../controllers/version-controller.js"
import { corsMiddleware } from "../middlewares/cors.js"

export default [
  {
    method: "GET",
    path: "/login/:provider",
    controller: OAuthController,
    action: "login",
    middlewares: [corsMiddleware],
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
    path: "/",
    controller: TeapotController,
    action: "brew",
  },
]
