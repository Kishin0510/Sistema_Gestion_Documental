require('dotenv').config()
const express = require('express')
const session = require('express-session')
const morgan  = require('morgan')
const path    = require('path')

const app = express()

// ── Motor de vistas ──────────────────────────────
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

// ── Middlewares globales ─────────────────────────
app.use(morgan('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'public')))
app.use(session({
  secret:            process.env.SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 8  // 8 horas
  }
}))

// ── Rutas ────────────────────────────────────────
app.use('/', require('./routes/auth.routes'))

// ── Ruta 404 ─────────────────────────────────────
app.use((req, res) => {
  res.status(404).send('<h1>404 - Página no encontrada</h1>')
})

// ── Iniciar servidor ─────────────────────────────
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})