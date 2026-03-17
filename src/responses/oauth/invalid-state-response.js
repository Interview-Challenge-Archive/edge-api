export class InvalidStateResponse extends Response {
  constructor() {
    super("Invalid state", { status: 400 })
  }
}
