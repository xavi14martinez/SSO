import { Router } from 'express'
import { requireApiAuth, requireApiRole } from '../auth/middleware.js'
import { avisos, publicNotices, usuarios } from '../data/portal.js'

export function createPortalRouter() {
  const router = Router()

  router.get('/public', (req, res) => {
    res.json({ avisos: publicNotices })
  })

  router.get('/me', requireApiAuth, (req, res) => {
    const { sub, username, name, roles } = req.session.user
    res.json({ sub, username, name, roles })
  })

  router.get('/avisos', requireApiAuth, requireApiRole('user', 'admin'), (req, res) => {
    res.json({ avisos })
  })

  router.get('/admin/usuarios', requireApiAuth, requireApiRole('admin'), (req, res) => {
    res.json({ usuarios })
  })

  return router
}
