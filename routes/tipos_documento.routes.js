const router = require('express').Router()
const db     = require('../db')
const { verificarSesion, verificarRol } = require('../middlewares/auth.middleware')

// ── GET /documentos/tipos ─────────────────────────
// Listado de tipos de documento (solo admin)
router.get('/',
  verificarSesion,
  verificarRol('admin'),
  async (req, res) => {
    try {
      // Traemos los tipos junto con la cantidad de documentos que los usan,
      // para poder advertir antes de eliminar uno que está en uso.
      const { rows: tipos } = await db.query(`
        SELECT
          t.*,
          COUNT(d.id)::int AS documentos_count
        FROM tipo_documento t
        LEFT JOIN documentos d ON d.tipo_id = t.id
        GROUP BY t.id
        ORDER BY t.nombre
      `)

      res.render('ListTiposDocumento', {
        tipos,
        error: null
      })

    } catch (err) {
      console.error(err)
      res.render('error', { mensaje: 'Error al cargar tipos de documento' })
    }
  }
)

// ── POST /documentos/tipos/agregar ────────────────
// Crear un nuevo tipo de documento
router.post('/agregar',
  verificarSesion,
  verificarRol('admin'),
  async (req, res) => {
    const { nombre } = req.body

    const cargarConError = async (mensajeError) => {
      const { rows: tipos } = await db.query(`
        SELECT
          t.*,
          COUNT(d.id)::int AS documentos_count
        FROM tipo_documento t
        LEFT JOIN documentos d ON d.tipo_id = t.id
        GROUP BY t.id
        ORDER BY t.nombre
      `)
      return res.render('ListTiposDocumento', {
        tipos,
        error: mensajeError
      })
    }

    if (!nombre || !nombre.trim()) {
      return cargarConError('El nombre del tipo de documento es obligatorio')
    }

    try {
      await db.query(
        `INSERT INTO tipo_documento (nombre) VALUES ($1)
         ON CONFLICT (nombre) DO NOTHING`,
        [nombre.trim()]
      )

      await db.query(`
        INSERT INTO logs_cambio (tabla, accion, descripcion, usuario_id)
        VALUES ('tipo_documento', 'INSERT', $1, $2)
      `, [`Tipo de documento creado: ${nombre.trim()}`, req.session.user.id])

      res.redirect('/documentos/tipos')

    } catch (err) {
      console.error(err)
      if (err.code === '23505') {
        return cargarConError('Ya existe un tipo de documento con ese nombre')
      }
      res.render('error', { mensaje: 'Error al crear el tipo de documento' })
    }
  }
)

// ── POST /documentos/tipos/editar/:id ─────────────
// Editar el nombre de un tipo de documento existente
router.post('/editar/:id',
  verificarSesion,
  verificarRol('admin'),
  async (req, res) => {
    const { id } = req.params
    const { nombre } = req.body

    if (!nombre || !nombre.trim()) {
      return res.redirect('/documentos/tipos')
    }

    try {
      await db.query(
        'UPDATE tipo_documento SET nombre = $1 WHERE id = $2',
        [nombre.trim(), id]
      )

      await db.query(`
        INSERT INTO logs_cambio (tabla, accion, descripcion, usuario_id)
        VALUES ('tipo_documento', 'UPDATE', $1, $2)
      `, [`Tipo de documento editado (id ${id}): ${nombre.trim()}`, req.session.user.id])

      res.redirect('/documentos/tipos')

    } catch (err) {
      console.error(err)
      if (err.code === '23505') {
        const { rows: tipos } = await db.query(`
          SELECT
            t.*,
            COUNT(d.id)::int AS documentos_count
          FROM tipo_documento t
          LEFT JOIN documentos d ON d.tipo_id = t.id
          GROUP BY t.id
          ORDER BY t.nombre
        `)
        return res.render('ListTiposDocumento', {
          tipos,
          error: 'Ya existe un tipo de documento con ese nombre'
        })
      }
      res.render('error', { mensaje: 'Error al editar el tipo de documento' })
    }
  }
)

// ── POST /documentos/tipos/eliminar/:id ───────────
// Eliminar un tipo de documento
// (los documentos que lo usaban quedan con tipo_id = NULL, ver FK ON DELETE SET NULL)
router.post('/eliminar/:id',
  verificarSesion,
  verificarRol('admin'),
  async (req, res) => {
    const { id } = req.params

    try {
      const { rows } = await db.query(
        'SELECT * FROM tipo_documento WHERE id = $1', [id]
      )
      const tipo = rows[0]

      if (!tipo) {
        return res.render('error', { mensaje: 'Tipo de documento no encontrado' })
      }

      await db.query('DELETE FROM tipo_documento WHERE id = $1', [id])

      await db.query(`
        INSERT INTO logs_cambio (tabla, accion, descripcion, usuario_id)
        VALUES ('tipo_documento', 'DELETE', $1, $2)
      `, [`Tipo de documento eliminado: ${tipo.nombre}`, req.session.user.id])

      res.redirect('/documentos/tipos')

    } catch (err) {
      console.error(err)
      res.render('error', { mensaje: 'Error al eliminar el tipo de documento' })
    }
  }
)

module.exports = router