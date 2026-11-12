import * as client from 'openid-client'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const PORTAL_ROLES = new Set(['user', 'admin'])

export async function createOidcClient(config) {
  const issuer = new URL(config.issuerUrl)
  const oidcConfig = await client.discovery(
    issuer,
    config.clientId,
    config.clientSecret,
    undefined,
    issuer.protocol === 'http:' ? { execute: [client.allowInsecureRequests] } : undefined,
  )
  const metadata = oidcConfig.serverMetadata()
  if (!metadata.jwks_uri || !metadata.issuer) {
    throw new Error('El proveedor de identidad no publica los datos necesarios.')
  }

  return {
    async begin() {
      const codeVerifier = client.randomPKCECodeVerifier()
      const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier)
      const state = client.randomState()
      const nonce = client.randomNonce()
      const url = client.buildAuthorizationUrl(oidcConfig, {
        redirect_uri: config.redirectUri,
        scope: 'openid profile',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
        nonce,
      })

      return { url: url.href, state, nonce, codeVerifier }
    },

    async complete({ currentUrl, expectedState, expectedNonce, codeVerifier }) {
      const tokens = await client.authorizationCodeGrant(oidcConfig, currentUrl, {
        pkceCodeVerifier: codeVerifier,
        expectedState,
        expectedNonce,
      })
      const idClaims = tokens.claims()
      if (!idClaims?.sub || !tokens.id_token || !tokens.access_token) {
        throw new Error('La respuesta de tokens está incompleta.')
      }

      const access = await readVerifiedAccessToken(tokens.access_token, {
        jwksUri: metadata.jwks_uri,
        issuer: metadata.issuer,
        clientId: config.clientId,
      })

      return {
        idToken: tokens.id_token,
        profile: {
          sub: idClaims.sub,
          username: stringClaim(idClaims.preferred_username) || idClaims.sub,
          name: stringClaim(idClaims.name) || stringClaim(idClaims.preferred_username) || idClaims.sub,
          roles: access.roles,
        },
      }
    },

    logoutUrl({ idToken, postLogoutRedirectUri }) {
      try {
        const parameters = {
          client_id: config.clientId,
          post_logout_redirect_uri: postLogoutRedirectUri,
        }
        if (idToken) parameters.id_token_hint = idToken
        return client.buildEndSessionUrl(oidcConfig, parameters).href
      } catch {
        return postLogoutRedirectUri
      }
    },
  }
}

export async function readVerifiedAccessToken(accessToken, { jwks, jwksUri, issuer, clientId }) {
  const keySet = jwks ?? (await remoteJwks(jwksUri))
  let payload
  try {
    ;({ payload } = await jwtVerify(accessToken, keySet, { issuer }))
  } catch {
    throw new Error('Access token inválido.')
  }

  if (typeof payload.azp === 'string' && payload.azp !== clientId) {
    throw new Error('Access token inválido.')
  }

  return { roles: selectPortalRoles(payload) }
}

export function selectPortalRoles(payload) {
  const realmAccess = payload?.realm_access
  if (!realmAccess || typeof realmAccess !== 'object') return []
  const roles = realmAccess.roles
  if (!Array.isArray(roles)) return []
  return roles.filter((role) => typeof role === 'string' && PORTAL_ROLES.has(role))
}

const jwksCache = new Map()

function remoteJwks(jwksUri) {
  if (!jwksCache.has(jwksUri)) {
    jwksCache.set(jwksUri, createRemoteJWKSet(new URL(jwksUri)))
  }
  return jwksCache.get(jwksUri)
}

function stringClaim(value) {
  return typeof value === 'string' && value ? value : ''
}
