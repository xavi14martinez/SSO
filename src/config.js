const REQUIRED = [
  'sessionSecret',
  'appBaseUrl',
  'issuerUrl',
  'clientId',
  'clientSecret',
  'redirectUri',
]

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT || 3000),
    appBaseUrl: env.APP_BASE_URL || 'http://localhost:3000',
    sessionSecret: env.SESSION_SECRET,
    issuerUrl: env.OIDC_ISSUER_URL,
    clientId: env.OIDC_CLIENT_ID,
    clientSecret: env.OIDC_CLIENT_SECRET,
    redirectUri: env.OIDC_REDIRECT_URI,
    cookieSecure: env.COOKIE_SECURE === 'true',
  }
}

export function assertRuntimeConfig(config) {
  const missing = REQUIRED.filter((key) => !config[key])
  if (missing.length > 0) {
    throw new Error(`Falta configuración: ${missing.join(', ')}`)
  }
}
