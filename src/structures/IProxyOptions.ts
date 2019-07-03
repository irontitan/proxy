import { Request, Response } from 'express'
import { IncomingMessage, ClientRequest } from 'http'

interface GuardFunction<T> {
  (proxyObject: T, req: Request, res: Response): void | Promise<void>
}

export interface BeforeFunction extends GuardFunction<ClientRequest> {}

export interface AfterFunction extends GuardFunction<IncomingMessage> {}

export interface IProxyOptions {
  to: string
  at?: string | Function
  timeout?: number
  before?: BeforeFunction | BeforeFunction[]
  after?: AfterFunction | AfterFunction[]
}
