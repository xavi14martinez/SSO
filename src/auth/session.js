import session from 'express-session'

export const SESSION_COOKIE = 'portal.sid'

export function sessionMiddleware(config) {
  return session({
    name: SESSION_COOKIE,
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: Boolean(config.cookieSecure),
      maxAge: 8 * 60 * 60 * 1000,
    },
  })
}

export function sessionCookieOptions(config) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: Boolean(config.cookieSecure),
  }
}
