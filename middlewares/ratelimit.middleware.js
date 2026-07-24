const rateLimit = require('express-rate-limit')

// ── Límite estricto para login ────────────────────
// Previene fuerza bruta de contraseñas. Solo cuenta intentos FALLIDOS
// (skipSuccessfulRequests) para no penalizar a alguien que se equivocó
// una vez y luego entró bien.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 6,                  // 6 intentos fallidos por IP en la ventana
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.'
  },
  handler: (req, res) => {
    res.status(429).render('Login', {
      error: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.'
    })
  }
})

// ── Límite general para el resto de la app ────────
// Protección básica anti scraping/DoS a nivel de aplicación.
// No se aplica a archivos estáticos (esos se sirven antes en server.js).
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300,                 // 300 requests por IP en la ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta de nuevo más tarde.' }
})

module.exports = { loginLimiter, generalLimiter }