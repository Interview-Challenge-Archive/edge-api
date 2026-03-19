const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"])

function getHostname(value) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  try {
    return new URL(trimmed).hostname.toLowerCase()
  } catch {
    const rawHost = trimmed.replace(/^https?:\/\//i, "").split("/")[0]

    if (!rawHost) {
      return null
    }

    return rawHost.split(":")[0].toLowerCase()
  }
}

function getAllowedHostnames(env) {
  const values = (env.ALLOWED_ORIGINS ?? "").split(",")
  const allowedHostnames = new Set(LOCAL_HOSTNAMES)

  for (const value of values) {
    const hostname = getHostname(value)

    if (hostname) {
      allowedHostnames.add(hostname)
    }
  }

  return allowedHostnames
}

function withCorsHeaders(response, origin) {
  const headers = new Headers(response.headers)
  const vary = headers.get("Vary")

  headers.set("Access-Control-Allow-Origin", origin)
  headers.set("Access-Control-Allow-Credentials", "true")
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS")
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

  if (!vary) {
    headers.set("Vary", "Origin")
  } else if (!vary.toLowerCase().split(",").map((value) => value.trim()).includes("origin")) {
    headers.set("Vary", `${vary}, Origin`)
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })
}

export async function corsMiddleware(context, next) {
  const origin = context.request.headers.get("Origin")
  let allowedOrigin

  if (origin) {
    const originHostname = getHostname(origin)
    const allowedHostnames = getAllowedHostnames(context.env)

    if (originHostname && allowedHostnames.has(originHostname)) {
      allowedOrigin = origin
    }
  }

  await next()

  if (allowedOrigin && context.response) {
    context.response = withCorsHeaders(context.response, allowedOrigin)
  }
}
