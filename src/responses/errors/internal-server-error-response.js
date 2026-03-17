export class InternalServerErrorResponse extends Response {
  constructor() {
    super("Internal Server Error", { status: 500 })
  }
}
