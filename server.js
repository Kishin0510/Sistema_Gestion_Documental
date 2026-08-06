require('dotenv').config()
const express      = require('express')
const session      = require('express-session')
const pgSession     = require('connect-pg-simple')(session)
const morgan  = require('morgan')
const path    = require('path')
const helmet  = require('helmet')

const db = require('./db')
const { csrfProtection }            = require('./middlewares/csrf.middleware')
const { loginLimiter, generalLimiter } = require('./middlewares/rateLimit.middleware')

const app = express()


// ── Motor de vistas ──────────────────────────────
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

// Necesario si corre detrás de un proxy/load balancer (Nginx, Render, etc.)
// para que 'secure' cookies y el rate limiter lean la IP real.
app.set('trust proxy', 1)

// ── Seguridad: cabeceras HTTP (helmet) ───────────
// NOTA: la vista actual usa atributos onclick/onsubmit y estilos inline
// en varios .ejs, por eso 'unsafe-inline' sigue habilitado en script-src
// y style-src. Para una CSP estricta habría que migrar esos handlers a
// addEventListener y los estilos inline a clases CSS — lo dejamos como
// mejora futura para no romper la UI actual.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'script-src':      ["'self'", "'unsafe-inline'"],
      // El default de helmet bloquea atributos onclick/onsubmit/onchange
      // (script-src-attr 'none'). La app los usa en varias vistas
      // (editarTipo, mostrarNombre, confirm() de eliminar, etc.), así que
      // se habilitan explícitamente.
      'script-src-attr': ["'unsafe-inline'"],
      'style-src':       ["'self'", "'unsafe-inline'"],
      'img-src':         ["'self'", 'data:'],
    },
  },
}))

// ── Middlewares globales ─────────────────────────
app.use(morgan('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d' }))
app.use(session({
  store: new pgSession({
    pool:            db.pool,
    tableName:       'session',
    createTableIfMissing: true, // red de seguridad si init-db no corrió aún
    pruneSessionInterval: 60 * 15, // limpia sesiones expiradas cada 15 min
  }),
  secret:            process.env.SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  cookie: {
    maxAge:   1000 * 60 * 60 * 8,  // 8 horas
    httpOnly: true,
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production' // requiere HTTPS en prod
  }
}))

// ── Rate limiting general (después de estáticos y sesión) ──
app.use(generalLimiter)

// ── CSRF (Synchronizer Token Pattern) ────────────
// Se salta automáticamente requests multipart/form-data (ver middleware);
// esas rutas validan el token manualmente después de multer.
app.use(csrfProtection)
app.use((req, res, next) => {
  // Disponible en todas las vistas como <%= csrfToken %>
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : null
  next()
})

// ── Rutas ────────────────────────────────────────
app.use('/', require('./routes/auth.routes'))
app.use('/vehiculos', require('./routes/vehicles.routes'))
app.use('/vehiculos/:vehiculoId/documentos', require('./routes/documents.routes'))
app.use('/documentos/tipos', require('./routes/tipos_documento.routes'))    
app.use('/usuarios', require('./routes/usuarios.routes'))    
app.use('/logs', require('./routes/logs.routes'))    
app.use('/documentos', require('./routes/alldocuments.routes'))

// ── Ruta 404 ─────────────────────────────────────
app.use((req, res) => {
  res.status(404).send('<h1>404 - Página no encontrada</h1>')
})

// ── Manejador de errores global ──────────────────
// Debe ir al final, después de rutas y del 404.
app.use((err, req, res, next) => {
  if (err && err.code === 'EBADCSRFTOKEN') {
    console.warn('CSRF inválido:', req.method, req.originalUrl)
    return res.status(403).render('error', {
      mensaje: 'Tu sesión o el formulario expiraron. Recarga la página e intenta de nuevo.'
    })
  }

  console.error(err)
  res.status(500).render('error', {
    mensaje: 'Ocurrió un error inesperado. Intenta de nuevo más tarde.'
  })
})

// —— Tarea Programada ————————————————————————————————————
require('./services/tasks/alertaVencimiento')
console.log('Tarea de alertas programada (08:00 AM diario)')

// ── Iniciar servidor ─────────────────────────────
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})