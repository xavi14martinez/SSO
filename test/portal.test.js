import assert from 'node:assert/strict'
import test from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'

function createMockOidc() {
  return {
    completes: 0,
    async begin() {
      return {
        url: 'http://keycloak.test/auth?state=expected-state',
        state: 'expected-state',
        nonce: 'expected-nonce',
        codeVerifier: 'verifier',
      }
    },
    async complete({ currentUrl, expectedState, codeVerifier }) {
      this.completes += 1
      assert.equal(expectedState, 'expected-state')
      assert.equal(codeVerifier, 'verifier')
      const code = currentUrl.searchParams.get('code')
      if (code === 'fallo') throw new Error('canje')
      const admin = code === 'admin-code'
      return {
        idToken: admin ? 'id-admin' : 'id-usuario',
        profile: {
          sub: admin ? 'admin' : 'usuario',
          username: admin ? 'admin' : 'usuario',
          name: admin ? 'Bruno Admin' : 'Ana Usuaria',
          roles: admin ? ['admin'] : ['user'],
        },
      }
    },
    logoutUrl({ postLogoutRedirectUri }) {
      return `http://keycloak.test/logout?post=${encodeURIComponent(postLogoutRedirectUri)}`
    },
  }
}

function build(oidc = createMockOidc()) {
  const app = createApp({
    config: {
      sessionSecret: 'test-secret',
      appBaseUrl: 'http://localhost:3000',
      cookieSecure: false,
    },
    oidc,
  })
  return { app, oidc }
}

async function login(agent, code) {
  const start = await agent.get('/login')
  assert.equal(start.status, 302)
  return agent.get(`/callback?code=${code}&state=expected-state`)
}

test('una API protegida sin sesión responde 401', async () => {
  const { app } = build()
  const avisos = await request(app).get('/api/avisos')
  const admin = await request(app).get('/api/admin/usuarios')
  assert.equal(avisos.status, 401)
  assert.equal(admin.status, 401)
  assert.equal((await request(app).get('/api/public')).status, 200)
})

test('la zona de usuario redirige a login sin sesión', async () => {
  const { app } = build()
  const response = await request(app).get('/app')
  assert.equal(response.status, 302)
  assert.equal(response.headers.location, '/login')
})

test('el rol user consulta avisos y no el directorio', async () => {
  const { app } = build()
  const agent = request.agent(app)
  const callback = await login(agent, 'user-code')
  assert.equal(callback.status, 302)
  assert.equal(callback.headers.location, '/')

  const me = await agent.get('/api/me')
  assert.equal(me.status, 200)
  assert.deepEqual(me.body.roles, ['user'])
  assert.equal(me.body.idToken, undefined)

  const avisos = await agent.get('/api/avisos')
  assert.equal(avisos.status, 200)
  assert.ok(avisos.body.avisos.length > 0)

  const admin = await agent.get('/api/admin/usuarios')
  assert.equal(admin.status, 403)

  const pagina = await agent.get('/admin')
  assert.equal(pagina.status, 403)
  assert.match(pagina.text, /Acceso no permitido/)
})

test('el rol admin consulta el directorio', async () => {
  const { app } = build()
  const agent = request.agent(app)
  await login(agent, 'admin-code')

  const admin = await agent.get('/api/admin/usuarios')
  assert.equal(admin.status, 200)
  assert.equal(admin.body.usuarios.length, 4)

  const avisos = await agent.get('/api/avisos')
  assert.equal(avisos.status, 200)

  const pagina = await agent.get('/admin')
  assert.equal(pagina.status, 200)
  assert.match(pagina.text, /Portal interno/)
})

test('el cierre de sesión invalida la sesión', async () => {
  const { app } = build()
  const agent = request.agent(app)
  await login(agent, 'user-code')

  const logout = await agent.post('/logout')
  assert.equal(logout.status, 302)
  assert.match(logout.headers.location, /^http:\/\/keycloak\.test\/logout/)

  const me = await agent.get('/api/me')
  assert.equal(me.status, 401)
})

test('un callback con state distinto no crea sesión', async () => {
  const { app, oidc } = build()
  const agent = request.agent(app)
  await agent.get('/login')

  const callback = await agent.get('/callback?code=user-code&state=otro-state')
  assert.equal(callback.status, 302)
  assert.match(callback.headers.location, /error=state/)
  assert.equal(oidc.completes, 0)

  const me = await agent.get('/api/me')
  assert.equal(me.status, 401)
})

test('un canje fallido no crea sesión', async () => {
  const { app } = build()
  const agent = request.agent(app)
  await agent.get('/login')
  const callback = await agent.get('/callback?code=fallo&state=expected-state')
  assert.match(callback.headers.location, /error=canje/)
  assert.equal((await agent.get('/api/me')).status, 401)
})

test('si el proveedor no responde, login no crea sesión', async () => {
  const oidc = createMockOidc()
  oidc.begin = async () => {
    throw new Error('conexión rechazada')
  }
  const { app } = build(oidc)
  const response = await request(app).get('/login')
  assert.equal(response.status, 302)
  assert.match(response.headers.location, /error=proveedor/)
})

test('la cookie de sesión es httpOnly y no es Secure en HTTP', async () => {
  const { app } = build()
  const response = await request(app).get('/login')
  const cookie = response.headers['set-cookie']?.join(';') ?? ''
  assert.match(cookie, /portal\.sid=/)
  assert.match(cookie, /HttpOnly/i)
  assert.match(cookie, /SameSite=Lax/i)
  assert.doesNotMatch(cookie, /Secure/i)
})
