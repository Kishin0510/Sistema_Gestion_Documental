const router = require('express').Router()
const db     = require('../db')
const { verificarSesion } = require('../middlewares/auth.middleware')
const { parsePagination, buildPageInfo } = require('../utils/pagination')

// ── GET /documentos ────────────────────────────
router.get('/', verificarSesion, async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query)
    const { tipo_id, vehiculo_id } = req.query

    const condiciones = []
    const valores = []
    let i = 1

    if (tipo_id) {
      condiciones.push(`d.tipo_id = $${i++}`)
      valores.push(tipo_id)
    }
    if (vehiculo_id) {
      condiciones.push(`d.vehiculo_id = $${i++}`)
      valores.push(vehiculo_id)
    }

    const whereClause = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''

    const { rows: documentos } = await db.query(`
      SELECT d.*, v.patente AS vehiculo_patente, t.nombre AS tipo, u.nombre AS subido_por
      FROM documentos d
      JOIN vehiculos      v ON v.id = d.vehiculo_id
      JOIN tipo_documento t ON t.id = d.tipo_id
      LEFT JOIN usuarios  u ON u.id = d.uploaded_by
      ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT $${i++} OFFSET $${i}
    `, [...valores, pageSize, offset])

    const { rows: [{ count }] } = await db.query(
      `SELECT COUNT(*) FROM documentos d ${whereClause}`, valores
    )

    res.render('ListAllDocuments', {
      documentos,
      filtros: { tipo_id, vehiculo_id },
      pagination: buildPageInfo(page, pageSize, count)
    })

  } catch (err) {
    console.error(err)
    res.render('error', { mensaje: 'Error al cargar documentos' })
  }
})

module.exports = router