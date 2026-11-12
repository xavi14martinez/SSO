export function requireApiAuth(req, res, next) {
  if (req.session?.user) return next()
  res.status(401).json({ error: 'Se necesita una sesión.' })
}

export function requirePageAuth(req, res, next) {
  if (req.session?.user) return next()
  res.redirect('/login')
}

export function requireApiRole(...roles) {
  return (req, res, next) => {
    if (hasRole(req, roles)) return next()
    res.status(403).json({ error: 'No tienes permiso para esta operación.' })
  }
}

export function requirePageRole(...roles) {
  return (req, res, next) => {
    if (hasRole(req, roles)) return next()
    res.status(403).type('html').send(forbiddenPage())
  }
}

function hasRole(req, roles) {
  const current = req.session?.user?.roles ?? []
  return roles.some((role) => current.includes(role))
}

function forbiddenPage() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Acceso no permitido</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <main class="panel">
    <h1>Acceso no permitido</h1>
    <p>Tu perfil no puede abrir esta zona.</p>
    <p><a href="/">Volver al portal</a></p>
  </main>
</body>
</html>`
}
