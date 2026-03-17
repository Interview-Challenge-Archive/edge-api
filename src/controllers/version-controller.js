import packageJson from "../../package.json"

export class VersionController {
  show() {
    return new Response(packageJson.version)
  }
}
