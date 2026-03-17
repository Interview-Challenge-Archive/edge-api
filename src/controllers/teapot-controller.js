import { TeapotResponse } from "../responses/teapot/teapot-response.js"

export class TeapotController {
  brew() {
    return new TeapotResponse()
  }
}
