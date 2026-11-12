import { Router } from 'express'
import { SESSION_COOKIE, sessionCookieOptions } from '../auth/session.js'

export function createAuthRouter({ oidc, config }) {
  const router = Router()

  router.get('/login', async (req, res, next) => {
    try {
      const pending = await oidc.begin()
      req.session.oidc = {
        state: pending.state,
        nonce: pending.nonce,
        codeVerifier: pending.codeVerifier,
      }
      req.session.save((error) => {
        if (error) return next(error)
        res.redirect(pending.url)
      })
    } catch {
      res.redirect('/?error=proveedor')
    }
  })

  router.get('/callback', async (req, res, next) => {
    const pending = req.session.oidc
    const returnedState = typeof req.query.state === 'string' ? req.query.state : ''

    if (!pending || returnedState !== pending.state) {
      return rejectAuth(req, res, 'state')
    }
    if (typeof req.query.error === 'string') {
      return rejectAuth(req, res, 'proveedor')
    }

    try {
      const currentUrl = new URL(req.originalUrl, config.appBaseUrl)
      const result = await oidc.complete({
        currentUrl,
        expectedState: pending.state,
        expectedNonce: pending.nonce,
        codeVerifier: pending.codeVerifier,
      })
      req.session.regenerate((error) => {
        if (error) return next(error)
        req.session.user = result.profile
        req.session.idToken = result.idToken
        req.session.save((saveError) => {
          if (saveError) return next(saveError)
          res.redirect('/')
        })
      })
    } catch {
      rejectAuth(req, res, 'canje')
    }
  })

  router.post('/logout', (req, res, next) => {
    const idToken = req.session?.idToken
    const target = oidc.logoutUrl({
      idToken,
      postLogoutRedirectUri: config.appBaseUrl,
    })

    const finish = () => {
      res.clearCookie(SESSION_COOKIE, sessionCookieOptions(config))
      res.redirect(target)
    }

    if (!req.session) return finish()
    req.session.destroy((error) => {
      if (error) return next(error)
      finish()
    })
  })

  return router
}

function rejectAuth(req, res, reason) {
  const finish = () => res.redirect(`/?error=${encodeURIComponent(reason)}`)
  if (!req.session) return finish()
  delete req.session.oidc
  delete req.session.user
  delete req.session.idToken
  req.session.save(() => finish())
}
