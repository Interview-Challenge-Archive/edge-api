import { cors } from "itty-router/cors"

const LOCAL_ORIGINS = [
  "http://localhost",
  "https://localhost",
  "http://127.0.0.1",
  "https://127.0.0.1",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
]

function getAllowedOrigins(env) {
  const envOrigins = (env.ALLOWED_ORIGINS ?? "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)

  return [...LOCAL_ORIGINS, ...envOrigins]
}

export function createCorsify(env) {
  return cors({
    allowHeaders: "*",
    allowMethods: "*",
    credentials: true,
    origin: getAllowedOrigins(env),
  }).corsify
}
