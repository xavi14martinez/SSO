import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { sessionMiddleware } from './auth/session.js'
import { requirePageAuth, requirePageRole } from './auth/middleware.js'
import { createAuthRouter } from './routes/auth.js'
import { createPortalRouter } from './routes/portal.js'

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../public')

export function createApp({ config, oidc }) {
  const app = express()
  app.disable('x-powered-by')
  app.use(sessionMiddleware(config))
  app.use(createAuthRouter({ oidc, config }))
  app.use('/api', createPortalRouter())

  const sendIndex = (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'))
  }
  app.get('/app', requirePageAuth, sendIndex)
  app.get('/admin', requirePageAuth, requirePageRole('admin'), sendIndex)

  app.use(express.static(publicDir))

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    res.redirect('/?error=proveedor')
  })

  return app
}
