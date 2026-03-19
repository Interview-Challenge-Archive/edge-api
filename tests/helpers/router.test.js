import { describe, expect, it, vi } from "vitest"

import { createRouter } from "../../src/helpers/router.js"

class HelloController {
  async show() {
    return new Response("ok", { status: 200 })
  }
}

class ContextAwareController {
  async show(_request, context) {
    return new Response(context.route.path, { status: 200 })
  }
}

describe("router helper", () => {
  it("applies route corsify to action responses", async () => {
    const corsify = vi.fn((response) => {
      const headers = new Headers(response.headers)
      headers.set("x-corsified", "true")

      return new Response(response.body, {
        headers,
        status: response.status,
      })
    })
    const createCorsify = vi.fn(() => corsify)
    const router = createRouter(
      [
        {
          action: "show",
          controller: HelloController,
          corsify: createCorsify,
          method: "GET",
          path: "/hello",
        },
      ],
      {}
    )
    const env = { ALLOWED_ORIGINS: "https://app.example.com" }
    const request = new Request("https://example.com/hello")

    const response = await router.fetch(request, env)

    expect(createCorsify).toHaveBeenCalledWith(env)
    expect(corsify).toHaveBeenCalledTimes(1)
    expect(corsify.mock.calls[0][1]).toBe(request)
    expect(response.headers.get("x-corsified")).toBe("true")
    expect(await response.text()).toBe("ok")
  })

  it("returns controller responses unchanged when no corsify is configured", async () => {
    const router = createRouter(
      [
        {
          action: "show",
          controller: HelloController,
          method: "GET",
          path: "/hello",
        },
      ],
      {}
    )

    const response = await router.fetch(new Request("https://example.com/hello"), {})

    expect(response.headers.get("x-corsified")).toBeNull()
    expect(await response.text()).toBe("ok")
  })

  it("passes route context to controller actions", async () => {
    const router = createRouter(
      [
        {
          action: "show",
          controller: ContextAwareController,
          method: "GET",
          path: "/openapi.json",
        },
      ],
      {}
    )

    const response = await router.fetch(new Request("https://example.com/openapi.json"), {})

    expect(await response.text()).toBe("/openapi.json")
  })
})
