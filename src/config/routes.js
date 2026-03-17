import { OAuthController } from "../controllers/oauth-controller.js"
import { VersionController } from "../controllers/version-controller.js"

export default [
  {
    method: "GET",
    path: "/login/:provider",
    controller: OAuthController,
    action: "login",
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
]
