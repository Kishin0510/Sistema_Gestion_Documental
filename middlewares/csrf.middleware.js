const { csrfSync } = require('csrf-sync')

// ── Protección CSRF (Synchronizer Token Pattern) ──
// El token se guarda en req.session.csrfToken (default de csrf-sync)
// y se espera de vuelta en el campo oculto <input name="_csrf"> de cada form.
//
// CASO ESPECIAL — subida de documentos (multipart/form-data):
// Cuando el Content-Type es multipart/form-data, el body todavía NO está
// parseado en el momento en que corre este middleware global (multer lo
// parsea más adelante, dentro de la ruta específica). Por eso esta instancia
// se salta la verificación para requests multipart, y esa ruta valida el
// token manualmente con `csrfProtectionAfterMulter`, DESPUÉS de multer.
//
// Ambas instancias leen/escriben el token en la misma sesión, así que un
// token generado por una es válido para la otra.

const {
  csrfSynchronisedProtection: csrfProtection,
} = csrfSync({
  getTokenFromRequest: (req) => req.body && req.body._csrf,
  skipCsrfProtection: (req) => {
    console.log('Content-Type:', req.headers['content-type']);
    console.log('req.is:', req.is('multipart/form-data'));
    return req.headers['content-type']?.startsWith('multipart/form-data') === true;
  },
})

const {
  csrfSynchronisedProtection: csrfProtectionAfterMulter,
} = csrfSync({
  getTokenFromRequest: (req) => req.body && req.body._csrf,
})

module.exports = { csrfProtection, csrfProtectionAfterMulter }