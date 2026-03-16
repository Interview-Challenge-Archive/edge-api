const controllerModules = import.meta.glob("../controllers/*.js", { eager: true })
const controllers = Object.values(controllerModules).reduce((acc, module) => {
  for (const [name, exportedValue] of Object.entries(module)) {
    if (typeof exportedValue === "function") {
      acc[name] = exportedValue
    }
  }

  return acc
}, {})

export function matchRoute(routes, pathname, method) {
  const pathnameSegments = pathname.split("/")

  for (const route of routes) {
    if (route.method !== method) {
      continue
    }

    const routeSegments = route.path.split("/")

    if (routeSegments.length !== pathnameSegments.length) {
      continue
    }

    const params = {}
    let matched = true

    for (const [index, routeSegment] of routeSegments.entries()) {
      const pathnameSegment = pathnameSegments[index]

      if (routeSegment.startsWith(":")) {
        params[routeSegment.slice(1)] = pathnameSegment
        continue
      }

      if (routeSegment !== pathnameSegment) {
        matched = false
        break
      }
    }

    if (matched) {
      return { route, params }
    }
  }

  return null
}

export function getController(name) {
  return controllers[name] || null
}
