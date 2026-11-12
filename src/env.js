import fs from 'node:fs'

export function loadEnvFile(file = '.env') {
  if (!fs.existsSync(file)) return

  const text = fs.readFileSync(file, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator === -1) continue
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim()
    if (process.env[key] === undefined) process.env[key] = value
  }
}
