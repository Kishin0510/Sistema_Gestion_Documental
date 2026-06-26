const router = require('express').Router()
const db     = require('../db')
const { verificarSesion, verificarRol } = require('../middlewares/auth.middleware')

// ── GET /logs ────────────────────────────────────
// Solo admin puede ver los logs
router.get('/',
  verificarSesion,
  verificarRol('admin'),
  async (req, res) => {
    try {
      const { tabla, accion, desde, hasta } = req.query

      let query = `
        SELECT
          l.*,
          u.nombre AS usuario,
          u.email  AS usuario_email
        FROM logs_cambio l
        LEFT JOIN usuarios u ON u.id = l.usuario_id
        WHERE 1=1
      `
      const params = []
      let   i      = 1

      if (tabla) {
        query += ` AND l.tabla = $${i++}`
        params.push(tabla)
      }

      if (accion) {
        query += ` AND l.accion = $${i++}`
        params.push(accion)
      }

      if (desde) {
        query += ` AND l.created_at >= $${i++}`
        params.push(desde)
      }

      if (hasta) {
        query += ` AND l.created_at <= $${i++} + INTERVAL '1 day'`
        params.push(hasta)
      }

      query += ' ORDER BY l.created_at DESC LIMIT 200'

      const { rows: logs } = await db.query(query, params)

      res.render('LogsCambio', {
        logs,
        filtros: { tabla, accion, desde, hasta }
      })

    } catch (err) {
      console.error(err)
      res.render('error', { mensaje: 'Error al cargar logs' })
    }
  }
)

module.exports = router