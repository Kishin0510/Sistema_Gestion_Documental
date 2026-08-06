const router = require('express').Router()
const bcrypt = require('bcryptjs')
const db     = require('../db')
const { verificarSesion, verificarRol } = require('../middlewares/auth.middleware')
const { parsePagination, buildPageInfo } = require('../utils/pagination')

// Todas las rutas de este módulo son solo para admin.
router.use(verificarSesion, verificarRol('admin'))

// ── Helper: traer roles disponibles (para los <select>) ──
async function getRoles() {
  const { rows } = await db.query('SELECT * FROM roles ORDER BY id')
  return rows
}

// ── Helper: ¿es este el último admin activo? ──
// Evita que la cuenta admin quede sin nadie que la administre.
async function esUltimoAdminActivo(usuarioId) {
  const { rows } = await db.query(`
    SELECT COUNT(*)::int AS count
    FROM usuarios u
    JOIN roles r ON r.id = u.rol_id
    WHERE r.nombre = 'admin' AND u.activo = TRUE AND u.id != $1
  `, [usuarioId])
  return rows[0].count === 0
}

// ── GET /usuarios ─────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query)

    const { rows: usuarios } = await db.query(`
      SELECT u.id, u.nombre, u.email, u.activo, u.created_at, r.nombre AS rol
      FROM usuarios u
      JOIN roles r ON r.id = u.rol_id
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `, [pageSize, offset])

    const { rows: [{ count }] } = await db.query('SELECT COUNT(*) FROM usuarios')

    res.render('ListUsuarios', {
      usuarios,
      pagination: buildPageInfo(page, pageSize, count),
      error: null
    })

  } catch (err) {
    console.error(err)
    res.render('error', { mensaje: 'Error al cargar usuarios' })
  }
})

// ── GET /usuarios/agregar ─────────────────────────
router.get('/agregar', async (req, res) => {
  const roles = await getRoles()
  res.render('AddUsuario', { usuario: null, roles, error: null })
})

// ── POST /usuarios/agregar ────────────────────────
router.post('/agregar', async (req, res) => {
  const { nombre, email, password, rol_id } = req.body

  const conError = async (mensaje, status = 400) => {
    const roles = await getRoles()
    return res.status(status).render('AddUsuario', {
      usuario: { nombre, email, rol_id },
      roles,
      error: mensaje
    })
  }

  if (!nombre || !email || !password || !rol_id) {
    return conError('Todos los campos son obligatorios')
  }
  if (password.length < 6) {
    return conError('La contraseña debe tener al menos 6 caracteres')
  }

  try {
    const hash = bcrypt.hashSync(password, 10)

    await db.transaction(async (client) => {
      const { rows } = await client.query(`
        INSERT INTO usuarios (nombre, email, password, rol_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [nombre, email, hash, rol_id])

      await client.query(`
        INSERT INTO logs_cambio (tabla, accion, descripcion, usuario_id)
        VALUES ('usuarios', 'INSERT', $1, $2)
      `, [`Usuario creado: ${email}`, req.session.user.id])

      return rows[0].id
    })

    res.redirect('/usuarios')

  } catch (err) {
    if (err.code === '23505') {
      return conError('Ya existe un usuario con ese email')
    }
    console.error(err)
    return conError('Error al crear el usuario', 500)
  }
})

// ── GET /usuarios/editar/:id ──────────────────────
router.get('/editar/:id', async (req, res) => {
  const { rows } = await db.query(
    'SELECT id, nombre, email, rol_id, activo FROM usuarios WHERE id = $1',
    [req.params.id]
  )
  if (!rows[0]) return res.render('error', { mensaje: 'Usuario no encontrado' })

  const roles = await getRoles()
  res.render('AddUsuario', { usuario: rows[0], roles, error: null })
})

// ── POST /usuarios/editar/:id ─────────────────────
// (nombre, email, rol; la contraseña solo se cambia si se escribe algo)
router.post('/editar/:id', async (req, res) => {
  const { nombre, email, password, rol_id } = req.body
  const targetId = req.params.id

  const conError = async (mensaje, status = 400) => {
    const roles = await getRoles()
    return res.status(status).render('AddUsuario', {
      usuario: { id: targetId, nombre, email, rol_id },
      roles,
      error: mensaje
    })
  }

  if (!nombre || !email || !rol_id) {
    return conError('Nombre, email y rol son obligatorios')
  }
  if (password && password.length < 6) {
    return conError('La contraseña debe tener al menos 6 caracteres')
  }

  try {
    // Si el usuario se está quitando el rol admin a sí mismo y es el
    // último admin activo, bloquear (dejaría el sistema sin administrador).
    const esUnoMismo = String(req.session.user.id) === String(targetId)
    if (esUnoMismo) {
      const roles = await getRoles()
      const nuevoRol = roles.find(r => String(r.id) === String(rol_id))
      if (nuevoRol && nuevoRol.nombre !== 'admin' && await esUltimoAdminActivo(targetId)) {
        return conError('No puedes quitarte el rol admin: eres el único administrador activo')
      }
    }

    await db.transaction(async (client) => {
      if (password) {
        const hash = bcrypt.hashSync(password, 10)
        await client.query(
          'UPDATE usuarios SET nombre=$1, email=$2, rol_id=$3, password=$4 WHERE id=$5',
          [nombre, email, rol_id, hash, targetId]
        )
      } else {
        await client.query(
          'UPDATE usuarios SET nombre=$1, email=$2, rol_id=$3 WHERE id=$4',
          [nombre, email, rol_id, targetId]
        )
      }

      await client.query(`
        INSERT INTO logs_cambio (tabla, accion, descripcion, usuario_id)
        VALUES ('usuarios', 'UPDATE', $1, $2)
      `, [`Usuario editado: ${email}`, req.session.user.id])
    })

    // Si edité mi propia cuenta, refresco los datos de la sesión
    // (nombre/rol pueden haber cambiado).
    if (esUnoMismo) {
      req.session.user.nombre = nombre
      req.session.user.email  = email
    }

    res.redirect('/usuarios')

  } catch (err) {
    if (err.code === '23505') {
      return conError('Ya existe un usuario con ese email')
    }
    console.error(err)
    return conError('Error al editar el usuario', 500)
  }
})

// ── POST /usuarios/desactivar/:id ─────────────────
router.post('/desactivar/:id', async (req, res) => {
  const targetId = req.params.id

  if (String(req.session.user.id) === String(targetId)) {
    return res.status(400).render('error', {
      mensaje: 'No puedes desactivar tu propia cuenta'
    })
  }

  try {
    if (await esUltimoAdminActivo(targetId)) {
      // targetId podría no ser admin; solo bloquea si de verdad es el último admin
      const { rows } = await db.query(`
        SELECT r.nombre AS rol FROM usuarios u
        JOIN roles r ON r.id = u.rol_id WHERE u.id = $1
      `, [targetId])
      if (rows[0]?.rol === 'admin') {
        return res.status(400).render('error', {
          mensaje: 'No puedes desactivar al único administrador activo del sistema'
        })
      }
    }

    await db.transaction(async (client) => {
      const { rows } = await client.query(
        'UPDATE usuarios SET activo = FALSE WHERE id = $1 RETURNING email', [targetId]
      )
      await client.query(`
        INSERT INTO logs_cambio (tabla, accion, descripcion, usuario_id)
        VALUES ('usuarios', 'UPDATE', $1, $2)
      `, [`Usuario desactivado: ${rows[0]?.email}`, req.session.user.id])
    })

    res.redirect('/usuarios')

  } catch (err) {
    console.error(err)
    res.render('error', { mensaje: 'Error al desactivar usuario' })
  }
})

// ── POST /usuarios/activar/:id ────────────────────
router.post('/activar/:id', async (req, res) => {
  try {
    await db.transaction(async (client) => {
      const { rows } = await client.query(
        'UPDATE usuarios SET activo = TRUE WHERE id = $1 RETURNING email', [req.params.id]
      )
      await client.query(`
        INSERT INTO logs_cambio (tabla, accion, descripcion, usuario_id)
        VALUES ('usuarios', 'UPDATE', $1, $2)
      `, [`Usuario reactivado: ${rows[0]?.email}`, req.session.user.id])
    })

    res.redirect('/usuarios')

  } catch (err) {
    console.error(err)
    res.render('error', { mensaje: 'Error al activar usuario' })
  }
})

module.exports = router