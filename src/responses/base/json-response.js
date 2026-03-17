export class JsonResponse extends Response {
  constructor(body, status = 200, headers = {}) {
    const responseHeaders = new Headers(headers)

    if (!responseHeaders.has("content-type")) {
      responseHeaders.set("content-type", "application/json")
    }

    super(JSON.stringify(body), {
      status,
      headers: responseHeaders,
    })
  }
}
