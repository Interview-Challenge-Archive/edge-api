import { cors } from "itty-router/cors"

const LOCAL_ORIGINS = [
  "http://localhost",
  "https://localhost",
  "http://127.0.0.1",
  "https://127.0.0.1",
  "http://localhost:9000",
  "http://127.0.0.1:9000",
  "https://localhost:9000",
  "https://127.0.0.1:9000",
]

function getEnvOrigins(env) {
  return (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
}

export function createCorsify(env) {
  return cors({
    allowHeaders: "*",
    allowMethods: "*",
    credentials: true,
    origin: [...LOCAL_ORIGINS, ...getEnvOrigins(env)],
  }).corsify
}
