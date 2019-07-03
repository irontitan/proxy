import rescue from 'express-rescue'
import queryString from 'query-string'
import debug, { Debugger } from 'debug'
import { rewrite } from './rewrite-path'
import { Request, Response, NextFunction } from 'express'
import http, { IncomingMessage, RequestOptions } from 'http'
import { IProxyOptions, AfterFunction } from './structures/IProxyOptions'

function ensureArray<T> (value: T | T[]): Array<T> {
  return Array.isArray(value) ? value : [ value ]
}

function makePathWithQuery (path: string, query: any) {
  if (Object.keys(query).length) {
    const stringQuery = queryString.stringify(query, { arrayFormat: 'bracket' })
    return `${path}?${stringQuery}`
  }

  return path
}

function initialize (req: Request, to: string, timeout: number = 3000, at?: string | Function) {
  const { host: _host, ...headers } = req.headers
  const path = at ? rewrite(at).using(req) : makePathWithQuery(req.path, req.query)
  const [ host, port ] = to.replace(/(?:https?:\/\/)|\//ig, '').split(':')
  const log = debug(`proxy:${host}`)
  const options: RequestOptions = {
    method: req.method,
    headers,
    protocol: 'http:',
    host,
    path,
    timeout,
    port: port || 80
  }

  return { path, log, options }
}

function makeProxyResponseHandler (req: Request, res: Response, to: string, path: string, postReq: AfterFunction[], log: Debugger) {
  return async (proxyRes: IncomingMessage) => {
    log('Received %i response', proxyRes.statusCode)
    for (const [ header, value ] of Object.entries(proxyRes.headers)) {
      res.setHeader(header, value as string)
    }

    if (!proxyRes.statusCode) {
      return res.status(503).json({
        status: 503,
        error: {
          message: `Service at ${to}/${path} did not respond`,
          code: 'service_unavailable'
        }
      })
    }

    res.status(proxyRes.statusCode)
    postReq.forEach(fn => fn(proxyRes, req, res))
    proxyRes.pipe(res)

    proxyRes.on('end', () => {
      res.end()
    })

    return
  }
}

export function factory ({ to, at, timeout = 3000, before = [], after = [] }: IProxyOptions) {
  const preReq = ensureArray(before)
  const postReq = ensureArray(after)

  return rescue(async (req: Request, res: Response, next: NextFunction) => {
    const { path, log, options } = initialize(req, to, timeout, at)

    log('Request options: %O', options)

    const proxyReq = http.request(options)

    for (const fn of preReq) {
      await fn(proxyReq, req, res)
    }

    proxyReq.on('error', (err) => {
      return next(err)
    })

    proxyReq.on('response', makeProxyResponseHandler(req, res, to, path, postReq, log))

    req.on('data', (chunk) => proxyReq.write(chunk))

    req.on('end', () => {
      proxyReq.end()
    })
  })
}

export default factory
module.exports = factory
