const router = require('express').Router()
const bcrypt = require('bcryptjs')
const db     = require('../db')
const auth   = require('../middlewares/auth.middleware')

// ── GET /login ───────────────────────────────────
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/')
  res.render('Login')
})

// ── POST /login ──────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.render('Login', { error: 'Completa todos los campos' })
  }

  try {
    // ── JOIN con roles para traer nombre del rol ──
    const { rows } = await db.query(`
      SELECT
        u.id,
        u.nombre,
        u.email,
        u.password,
        u.activo,
        r.id   AS rol_id,
        r.nombre AS rol
      FROM usuarios u
      JOIN roles r ON r.id = u.rol_id
      WHERE u.email = $1
    `, [email])

    const user = rows[0]

    if (!user) {
      return res.render('Login', { error: 'Email o contraseña incorrectos' })
    }

    // Verificar si la cuenta está activa
    if (!user.activo) {
      return res.render('Login', { error: 'Cuenta desactivada, contacta al administrador' })
    }

    const passwordOk = bcrypt.compareSync(password, user.password)
    if (!passwordOk) {
      return res.render('Login', { error: 'Email o contraseña incorrectos' })
    }

    // Sesión con rol incluido
    req.session.user = {
      id:     user.id,
      nombre: user.nombre,
      email:  user.email,
      rol:    user.rol        // ← 'admin' | 'editor' | 'viewer'
    }

    await db.query(`
      INSERT INTO logs_cambio (tabla, accion, descripcion, usuario_id)
      VALUES ('usuarios', 'LOGIN', $1, $2)
    `, [`Login de ${user.email}`, user.id])

    res.redirect('/')

  } catch (err) {
    console.error('Error en login:', err)
    res.render('Login', { error: 'Error del servidor, intenta de nuevo' })
  }
})

// ── GET /logout ──────────────────────────────────
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'))
})

// ── GET / ────────────────────────────────────────
router.get('/', auth, (req, res) => res.render('Home'))

module.exports = router