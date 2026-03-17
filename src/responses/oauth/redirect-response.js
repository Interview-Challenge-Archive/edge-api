export class RedirectResponse extends Response {
  constructor(headers) {
    super(null, { status: 302, headers })
  }
}
