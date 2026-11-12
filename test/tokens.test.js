import assert from 'node:assert/strict'
import test from 'node:test'
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { readVerifiedAccessToken, selectPortalRoles } from '../src/auth/oidc.js'

const issuer = 'http://localhost:8080/realms/sso-portal'
const clientId = 'portal-web'

async function fixture() {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const jwk = await exportJWK(publicKey)
  jwk.alg = 'RS256'
  jwk.kid = 'test-key'
  return {
    privateKey,
    jwks: createLocalJWKSet({ keys: [jwk] }),
  }
}

async function sign(privateKey, claims, expiresIn = '2m') {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(issuer)
    .setSubject('ana')
    .setExpirationTime(expiresIn)
    .sign(privateKey)
}

test('solo conserva los roles user y admin del access token', () => {
  assert.deepEqual(
    selectPortalRoles({
      realm_access: { roles: ['default-roles-sso-portal', 'user', 'offline_access', 'admin'] },
    }),
    ['user', 'admin'],
  )
  assert.deepEqual(selectPortalRoles({}), [])
})

test('acepta un access token firmado y rechaza el de otro cliente, el caducado y el alterado', async () => {
  const { privateKey, jwks } = await fixture()
  const options = { jwks, issuer, clientId }
  const token = await sign(privateKey, {
    azp: clientId,
    realm_access: { roles: ['user', 'uma_authorization'] },
  })

  const valid = await readVerifiedAccessToken(token, options)
  assert.deepEqual(valid.roles, ['user'])

  const otherClient = await sign(privateKey, {
    azp: 'otro-cliente',
    realm_access: { roles: ['admin'] },
  })
  await assert.rejects(() => readVerifiedAccessToken(otherClient, options))

  const expired = await sign(privateKey, {
    azp: clientId,
    realm_access: { roles: ['admin'] },
  }, '-1m')
  await assert.rejects(() => readVerifiedAccessToken(expired, options))

  await assert.rejects(() => readVerifiedAccessToken(`${token}alterada`, options))
})
