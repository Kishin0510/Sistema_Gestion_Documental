// routes/vehiculos.routes.js
const router = require('express').Router()
const db     = require('../db')
const { verificarSesion, verificarRol } = require('../middlewares/auth.middleware')

// ── GET /vehiculos ───────────────────────────────
router.get('/', verificarSesion, async (req, res) => {
  try {
    const { rows: vehiculos } = await db.query(`
      SELECT * FROM vehiculos
      ORDER BY created_at DESC
    `)
    res.render('ListVehicles', { vehiculos })

  } catch (err) {
    console.error(err)
    res.render('error', { mensaje: 'Error al cargar vehículos' })
  }
})

// ── GET /vehiculos/agregar ───────────────────────
router.get('/agregar',
  verificarSesion,
  verificarRol('admin', 'editor'),
  (req, res) => res.render('AddVehicles', { vehiculo: null, error: null })
)

// ── POST /vehiculos/agregar ──────────────────────
router.post('/agregar',
  verificarSesion,
  verificarRol('admin', 'editor'),
  async (req, res) => {
    const { patente, marca, modelo, anio, color, kilometraje } = req.body

    if (!patente || !marca || !modelo) {
      return res.render('AddVehicles', {
        vehiculo: null,
        error: 'Patente, marca y modelo son obligatorios'
      })
    }

    try {
      await db.query(`
        INSERT INTO vehiculos (patente, marca, modelo, anio, color, kilometraje)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [patente.toUpperCase(), marca, modelo, anio, color,  kilometraje || 0])

      await db.query(`
        INSERT INTO logs_cambio (tabla, accion, descripcion, usuario_id)
        VALUES ('vehiculos', 'INSERT', $1, $2)
      `, [`Vehículo creado: ${patente.toUpperCase()}`, req.session.user.id])

      res.redirect('/vehiculos')

    } catch (err) {
      if (err.code === '23505') {
        return res.render('AddVehicles', {
          vehiculo: null,
          error: 'Ya existe un vehículo con esa patente'
        })
      }
      console.error(err)
      res.render('error', { mensaje: 'Error al crear vehículo' })
    }
  }
)

// ── GET /vehiculos/editar/:id ────────────────────
router.get('/editar/:id',
  verificarSesion,
  verificarRol('admin', 'editor'),
  async (req, res) => {
    const { rows } = await db.query(
      'SELECT * FROM vehiculos WHERE id = $1', [req.params.id]
    )
    if (!rows[0]) return res.render('error', { mensaje: 'Vehículo no encontrado' })
    res.render('AddVehicles', { vehiculo: rows[0], error: null })
  }
)

// ── POST /vehiculos/editar/:id ───────────────────
router.post('/editar/:id',
  verificarSesion,
  verificarRol('admin', 'editor'),
  async (req, res) => {
    const { patente, marca, modelo, anio, color, kilometraje } = req.body

    try {
      const { rows } = await db.query('SELECT kilometraje FROM vehiculos WHERE id = $1', [req.params.id])
      if (!rows[0]) return res.render('error', { mensaje: 'Vehículo no encontrado' })

      const kmActual = rows[0].kilometraje
      const kmNuevo = parseInt(kilometraje, 10)

      if (isNaN(kmNuevo) || kmNuevo < kmActual) {
        return res.render('AddVehicles', {
          vehiculo: { id: req.params.id, patente, marca, modelo, anio, color, kilometraje },
          error: `El kilometraje no puede ser menor al actual (${kmActual} km)`
        })
      }

      await db.query(`
        UPDATE vehiculos
        SET patente=$1, marca=$2, modelo=$3, anio=$4, color=$5, kilometraje=$6
        WHERE id=$8
      `, [patente.toUpperCase(), marca, modelo, anio, color, kmNuevo])
      
      await db.query(`
        INSERT INTO logs_cambio (tabla, accion, descripcion, usuario_id)
        VALUES ('vehiculos', 'UPDATE', $1, $2)
      `, [`Vehículo editado: ${patente.toUpperCase()}`, req.session.user.id])

      res.redirect('/vehiculos')

    } catch (err) {
      console.error(err)
      res.render('error', { mensaje: 'Error al editar vehículo' })
    }
  }
)

// ── POST /vehiculos/eliminar/:id ─────────────────
router.post('/eliminar/:id',
  verificarSesion,
  verificarRol('admin'),
  async (req, res) => {
    try {
      const { rows } = await db.query(
        'SELECT patente FROM vehiculos WHERE id = $1', [req.params.id]
      )

      await db.query('DELETE FROM vehiculos WHERE id = $1', [req.params.id])

      await db.query(`
        INSERT INTO logs_cambio (tabla, accion, descripcion, usuario_id)
        VALUES ('vehiculos', 'DELETE', $1, $2)
      `, [`Vehículo eliminado: ${rows[0]?.patente}`, req.session.user.id])

      res.redirect('/vehiculos')

    } catch (err) {
      console.error(err)
      res.render('error', { mensaje: 'Error al eliminar vehículo' })
    }
  }
)

module.exports = router