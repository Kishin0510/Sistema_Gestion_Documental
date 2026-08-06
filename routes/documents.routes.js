const router = require('express').Router({ mergeParams: true })
// mergeParams permite acceder a :vehiculoId desde la ruta padre
const path   = require('path')
const fs     = require('fs')
const db     = require('../db')
const upload = require('../storage')
const { verificarSesion, verificarRol } = require('../middlewares/auth.middleware')
const { csrfProtectionAfterMulter }     = require('../middlewares/csrf.middleware')
const { parsePagination, buildPageInfo } = require('../utils/pagination')

// ── GET /vehiculos/:vehiculoId/documentos ────────
router.get('/', verificarSesion, async (req, res) => {
  try {
    const { vehiculoId } = req.params
    const { page, pageSize, offset } = parsePagination(req.query)

    // Traer vehículo
    const { rows: vehiculoArr } = await db.query(
      'SELECT * FROM vehiculos WHERE id = $1', [vehiculoId]
    )
    if (!vehiculoArr[0]) {
      return res.render('error', { mensaje: 'Vehículo no encontrado' })
    }

    // Traer documentos del vehículo (paginado)
    const { rows: documentos } = await db.query(`
      SELECT
        d.*,
        t.nombre AS tipo,
        u.nombre AS subido_por
      FROM documentos d
      JOIN tipo_documento t ON t.id = d.tipo_id
      LEFT JOIN usuarios  u ON u.id = d.uploaded_by
      WHERE d.vehiculo_id = $1
      ORDER BY d.created_at DESC
      LIMIT $2 OFFSET $3
    `, [vehiculoId, pageSize, offset])

    const { rows: [{ count }] } = await db.query(
      'SELECT COUNT(*) FROM documentos WHERE vehiculo_id = $1', [vehiculoId]
    )

    // Traer tipos para el filtro
    const { rows: tipos } = await db.query(
      'SELECT * FROM tipo_documento ORDER BY nombre'
    )

    res.render('ListDocuments', {
      documentos,
      vehiculo: vehiculoArr[0],
      tipos,
      pagination: buildPageInfo(page, pageSize, count)
    })

  } catch (err) {
    console.error(err)
    res.render('error', { mensaje: 'Error al cargar documentos' })
  }
})

// ── GET /vehiculos/:vehiculoId/documentos/agregar
router.get('/agregar',
  verificarSesion,
  verificarRol('admin', 'editor'),
  async (req, res) => {
    const { vehiculoId } = req.params

    const { rows: vehiculoArr } = await db.query(
      'SELECT * FROM vehiculos WHERE id = $1', [vehiculoId]
    )
    if (!vehiculoArr[0]) {
      return res.render('error', { mensaje: 'Vehículo no encontrado' })
    }

    const { rows: tipos } = await db.query(
      'SELECT * FROM tipo_documento ORDER BY nombre'
    )

    res.render('AddDocuments', {
      vehiculo: vehiculoArr[0],
      tipos,
      error: null
    })
  }
)

// ── POST /vehiculos/:vehiculoId/documentos/agregar
router.post('/agregar',
  verificarSesion,
  verificarRol('admin', 'editor'),
  upload.single('archivo'),
  csrfProtectionAfterMulter, // el body multipart recién existe después de multer
  async (req, res) => {
    const { vehiculoId } = req.params
    const { nombre, tipo_id, fecha_emision, fecha_vencimiento } = req.body

    // Recargar datos para el form en caso de error
    const cargarFormData = async () => {
      const { rows: vehiculoArr } = await db.query(
        'SELECT * FROM vehiculos WHERE id = $1', [vehiculoId]
      )
      const { rows: tipos } = await db.query(
        'SELECT * FROM tipo_documento ORDER BY nombre'
      )
      return { vehiculo: vehiculoArr[0], tipos }
    }

    if (!nombre || !tipo_id) {
      const { vehiculo, tipos } = await cargarFormData()
      return res.render('AddDocuments', {
        vehiculo, tipos,
        error: 'Nombre y tipo son obligatorios'
      })
    }

    if (!req.file) {
      const { vehiculo, tipos } = await cargarFormData()
      return res.render('AddDocuments', {
        vehiculo, tipos,
        error: 'Debes adjuntar un archivo PDF o imagen'
      })
    }

    try {
      await db.transaction(async (client) => {
        await client.query(`
          INSERT INTO documentos
            (nombre, archivo_nombre, archivo_ruta, tipo_id, vehiculo_id,
             fecha_emision, fecha_vencimiento, uploaded_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          nombre,
          req.file.filename,
          req.file.path,
          tipo_id,
          vehiculoId,
          fecha_emision     || null,
          fecha_vencimiento || null,
          req.session.user.id
        ])

        await client.query(`
          INSERT INTO logs_cambio (tabla, accion, descripcion, usuario_id)
          VALUES ('documentos', 'INSERT', $1, $2)
        `, [`Documento subido: ${nombre}`, req.session.user.id])
      })

      res.redirect(`/vehiculos/${vehiculoId}/documentos`)

    } catch (err) {
      console.error(err)

      // multer ya escribió el archivo en disco antes de que corriera esta
      // ruta; si la transacción falla (ej. tipo_id inválido), no debe
      // quedar un archivo huérfano sin registro en la base de datos.
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error('No se pudo limpiar archivo huérfano:', unlinkErr)
        })
      }

      const { vehiculo, tipos } = await cargarFormData()
      res.status(500).render('AddDocuments', {
        vehiculo, tipos,
        error: 'Error al guardar el documento. Intenta de nuevo.'
      })
    }
  }
)

// ── GET /vehiculos/:vehiculoId/documentos/descargar/:id
router.get('/descargar/:id', verificarSesion, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM documentos WHERE id = $1 AND vehiculo_id = $2',
      [req.params.id, req.params.vehiculoId]
    )
    const doc = rows[0]

    if (!doc) {
      return res.render('error', { mensaje: 'Documento no encontrado' })
    }

    const filePath = path.resolve(doc.archivo_ruta)

    if (!fs.existsSync(filePath)) {
      return res.render('error', { mensaje: 'Archivo no encontrado en el servidor' })
    }

    res.download(filePath, doc.archivo_nombre)

  } catch (err) {
    console.error(err)
    res.render('error', { mensaje: 'Error al descargar documento' })
  }
})

// ── POST /vehiculos/:vehiculoId/documentos/eliminar/:id
router.post('/eliminar/:id',
  verificarSesion,
  verificarRol('admin'),
  async (req, res) => {
    const { vehiculoId } = req.params

    try {
      const { rows } = await db.query(
        'SELECT * FROM documentos WHERE id = $1 AND vehiculo_id = $2',
        [req.params.id, vehiculoId]
      )
      const doc = rows[0]

      if (!doc) {
        return res.render('error', { mensaje: 'Documento no encontrado' })
      }

      // Eliminar archivo físico
      const filePath = path.resolve(doc.archivo_ruta)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }

      await db.query('DELETE FROM documentos WHERE id = $1', [req.params.id])

      await db.query(`
        INSERT INTO logs_cambio (tabla, accion, descripcion, usuario_id)
        VALUES ('documentos', 'DELETE', $1, $2)
      `, [`Documento eliminado: ${doc.nombre}`, req.session.user.id])

      res.redirect(`/vehiculos/${vehiculoId}/documentos`)

    } catch (err) {
      console.error(err)
      res.render('error', { mensaje: 'Error al eliminar documento' })
    }
  }
)


module.exports = router