import { Request } from 'express'
import { Path } from 'path-parser'
import queryString from 'query-string'

function parseRoute (at: string, params: { [ key: string ]: unknown }) {
  const route = new Path(at)

  return route.build(params)
}

export function rewrite (at: string | Function) {
  return {
    using: (req: Request) => {
      if (typeof at === 'function') {
        return at(req)
      }

      const query = queryString.stringify(req.query, { arrayFormat: 'bracket' })

      const path = parseRoute(at, req.params)

      if (!query) return path

      return path.includes('?')
        ? `${path}&{query}`
        :`${path}?${query}`
    }
  }
}
