const multer = require('multer')
const path   = require('path')
const fs     = require('fs')

// Crear carpeta si no existe
const uploadDir = path.join(__dirname, '../public/uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    // Formato: timestamp_nombreoriginal
    const timestamp  = Date.now()
    const extension  = path.extname(file.originalname)
    const baseName   = path.basename(file.originalname, extension)
      .replace(/\s+/g, '_')       // espacios → guion bajo
      .replace(/[^a-zA-Z0-9_]/g, '') // caracteres especiales
    cb(null, `${timestamp}_${baseName}${extension}`)
  }
})

// Filtro: solo PDF e imágenes
const fileFilter = (req, file, cb) => {
  const tiposPermitidos = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg'
  ]
  if (tiposPermitidos.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Solo se permiten archivos PDF, JPG o PNG'), false)
  }
}

module.exports = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024  // 10 MB máximo
  }
})