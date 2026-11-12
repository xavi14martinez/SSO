const errorNode = document.querySelector('#error')
const sesionNode = document.querySelector('#sesion')
const zonaUsuario = document.querySelector('#zona-usuario')
const zonaAdmin = document.querySelector('#zona-admin')

const mensajes = {
  state: 'No se ha podido confirmar la respuesta de autenticación. Vuelve a intentarlo.',
  proveedor: 'El proveedor de identidad no está disponible o ha rechazado la solicitud.',
  canje: 'No se ha podido completar el inicio de sesión.',
}

mostrarError()
cargarPortal()

function mostrarError() {
  const codigo = new URLSearchParams(window.location.search).get('error')
  if (!codigo || !mensajes[codigo]) return
  errorNode.hidden = false
  errorNode.textContent = mensajes[codigo]
  window.history.replaceState({}, '', window.location.pathname)
}

async function cargarPortal() {
  const publico = await fetch('/api/public').then((response) => response.json())
  pintarLista(document.querySelector('#avisos-publicos'), publico.avisos)

  const me = await fetch('/api/me')
  if (me.status === 401) {
    pintarInvitado()
    return
  }
  if (!me.ok) {
    pintarInvitado()
    return
  }

  const perfil = await me.json()
  pintarSesion(perfil)

  const avisos = await fetch('/api/avisos')
  if (avisos.ok) {
    const datos = await avisos.json()
    zonaUsuario.hidden = false
    pintarLista(document.querySelector('#avisos'), datos.avisos)
  }

  const admin = await fetch('/api/admin/usuarios')
  if (admin.ok) {
    const datos = await admin.json()
    zonaAdmin.hidden = false
    pintarLista(document.querySelector('#usuarios'), datos.usuarios.map(fichaUsuario))
  }
}

function pintarInvitado() {
  sesionNode.replaceChildren()
  const enlace = document.createElement('a')
  enlace.className = 'boton'
  enlace.href = '/login'
  enlace.textContent = 'Identificarse'
  sesionNode.append(enlace)
}

function pintarSesion(perfil) {
  sesionNode.replaceChildren()
  const nombre = document.createElement('p')
  nombre.className = 'nombre'
  const perfilTexto = perfil.roles.includes('admin') ? 'administración' : 'usuario'
  nombre.textContent = `${perfil.name} · ${perfilTexto}`

  const form = document.createElement('form')
  form.method = 'post'
  form.action = '/logout'
  const boton = document.createElement('button')
  boton.type = 'submit'
  boton.textContent = 'Cerrar sesión'
  form.append(boton)
  sesionNode.append(nombre, form)
}

function pintarLista(lista, elementos) {
  lista.replaceChildren()
  for (const elemento of elementos) {
    const item = document.createElement('li')
    const titulo = document.createElement('strong')
    titulo.textContent = elemento.titulo
    item.append(titulo)
    if (elemento.texto) {
      const texto = document.createElement('span')
      texto.textContent = elemento.texto
      item.append(texto)
    }
    lista.append(item)
  }
}

function fichaUsuario(usuario) {
  const perfil = usuario.roles.includes('admin') ? 'administración' : 'usuario'
  return {
    titulo: usuario.nombre,
    texto: `${usuario.username} · ${perfil}`,
  }
}
