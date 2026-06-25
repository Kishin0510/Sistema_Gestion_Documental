// ── Verifica que haya sesión activa ──────────────
const verificarSesion = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login')
  }
  res.locals.user = req.session.user
  next()
}

// ── Verifica que el usuario tenga el rol requerido
const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    const rolUsuario = req.session?.user?.rol

    if (!rolUsuario || !rolesPermitidos.includes(rolUsuario)) {
      return res.status(403).render('error', {
        mensaje: 'No tienes permiso para acceder a esta sección'
      })
    }
    next()
  }
}

module.exports = { verificarSesion, verificarRol }