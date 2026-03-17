const DEFAULT_TARGET_ORIGIN = "*"

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function serializeForInlineScript(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029")
}

export class PopupResponse extends Response {
  constructor(message, { headers = {}, status = 200, title = "Authentication complete" } = {}) {
    const responseHeaders = new Headers(headers)
    const targetOrigin = message.targetOrigin || DEFAULT_TARGET_ORIGIN
    const payload = {
      source: "interview-challenge-archive-auth",
      ...message,
    }

    delete payload.targetOrigin

    responseHeaders.set("content-type", "text/html; charset=utf-8")
    responseHeaders.set("cache-control", "no-store")

    super(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <p>${escapeHtml(title)}</p>
    <p>You can close this window.</p>
    <script>
      const targetOrigin = ${serializeForInlineScript(targetOrigin)}
      const message = ${serializeForInlineScript(payload)}

      if (window.opener) {
        window.opener.postMessage(message, targetOrigin)
        window.close()
      }
    </script>
  </body>
</html>`, {
      status,
      headers: responseHeaders,
    })
  }
}
