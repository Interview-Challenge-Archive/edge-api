import { TeapotResponse } from "../responses/teapot-response.js"

export class TeapotController {
  brew() {
    return new TeapotResponse()
  }
}
