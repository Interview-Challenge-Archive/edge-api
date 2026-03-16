import { describe, expect, it } from "vitest"

import packageJson from "../../package.json"
import { VersionController } from "../../src/controllers/version-controller.js"

describe("VersionController", () => {
  it("returns the version from package.json", async () => {
    const controller = new VersionController()
    const res = controller.show()

    expect(res.status).toBe(200)
    expect(await res.text()).toBe(packageJson.version)
  })
})
