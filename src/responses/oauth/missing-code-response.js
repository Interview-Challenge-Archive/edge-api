export class MissingCodeResponse extends Response {
  constructor() {
    super("Missing code", { status: 400 })
  }
}
