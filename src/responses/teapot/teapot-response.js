import { JsonResponse } from "../base/json-response.js"

export class TeapotResponse extends JsonResponse {
  constructor() {
    super(
      {
        error: "teapot",
        message: "I'm a teapot",
        beverage: "tea",
        status: 418,
      },
      418
    )
  }
}
