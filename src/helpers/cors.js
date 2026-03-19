import { cors } from "itty-router/cors"

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
  const allowedHostnames = new Set(LOCAL_HOSTNAMES)
  const envOrigins = (env.ALLOWED_ORIGINS ?? "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)

  for (const value of envOrigins) {
    const hostname = getHostname(value)

    if (hostname) {
      allowedHostnames.add(hostname)
    }
  }

  return allowedHostnames
}

export function createCorsify(env) {
  const allowedHostnames = getAllowedHostnames(env)

  return cors({
    allowHeaders: "*",
    allowMethods: "*",
    credentials: true,
    origin: (value) => {
      const hostname = getHostname(value)

      if (!hostname) {
        return undefined
      }

      if (!allowedHostnames.has(hostname)) {
        return undefined
      }

      return value
    },
  }).corsify
}
