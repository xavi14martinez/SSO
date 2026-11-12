import { createApp } from './app.js'
import { createOidcClient } from './auth/oidc.js'
import { assertRuntimeConfig, loadConfig } from './config.js'
import { loadEnvFile } from './env.js'

loadEnvFile()
const config = loadConfig()
assertRuntimeConfig(config)

const oidc = await createOidcClient(config)
const app = createApp({ config, oidc })

app.listen(config.port, () => {
  console.log(`Portal en ${config.appBaseUrl}`)
})
