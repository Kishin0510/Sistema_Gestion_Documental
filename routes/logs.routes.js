const router = require('express').Router()
const db     = require('../db')
const { verificarSesion, verificarRol } = require('../middlewares/auth.middleware')
const { parsePagination, buildPageInfo } = require('../utils/pagination')

// ── GET /logs ────────────────────────────────────
// Solo admin puede ver los logs
router.get('/',
  verificarSesion,
  verificarRol('admin'),
  async (req, res) => {
    try {
      const { tabla, accion, desde, hasta } = req.query
      const { page, pageSize, offset } = parsePagination(req.query, 50)

      // WHERE compartido entre el conteo total y la página de resultados
      let where  = ' WHERE 1=1'
      const params = []
      let   i      = 1

      if (tabla) {
        where += ` AND l.tabla = $${i++}`
        params.push(tabla)
      }
      if (accion) {
        where += ` AND l.accion = $${i++}`
        params.push(accion)
      }
      if (desde) {
        where += ` AND l.created_at >= $${i++}`
        params.push(desde)
      }
      if (hasta) {
        where += ` AND l.created_at <= $${i++} + INTERVAL '1 day'`
        params.push(hasta)
      }

      const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(*) FROM logs_cambio l${where}`, params
      )

      const dataParams = [...params, pageSize, offset]
      const { rows: logs } = await db.query(`
        SELECT
          l.*,
          u.nombre AS usuario,
          u.email  AS usuario_email
        FROM logs_cambio l
        LEFT JOIN usuarios u ON u.id = l.usuario_id
        ${where}
        ORDER BY l.created_at DESC
        LIMIT $${i++} OFFSET $${i++}
      `, dataParams)

      // Preserva los filtros activos al cambiar de página
      const extraQuery = ['tabla', 'accion', 'desde', 'hasta']
        .filter(k => req.query[k])
        .map(k => `&${k}=${encodeURIComponent(req.query[k])}`)
        .join('')

      res.render('LogsCambio', {
        logs,
        filtros: { tabla, accion, desde, hasta },
        pagination: buildPageInfo(page, pageSize, count),
        extraQuery
      })

    } catch (err) {
      console.error(err)
      res.render('error', { mensaje: 'Error al cargar logs' })
    }
  }
)

module.exports = router