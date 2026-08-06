// scripts/init-db.js
require('dotenv').config()
const db     = require('../db')
const bcrypt = require('bcryptjs')

async function init() {
  console.log('Inicializando base de datos...')

  // ── 1. Tabla roles ──────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id          SERIAL PRIMARY KEY,
      nombre      VARCHAR(50) UNIQUE NOT NULL,
      descripcion TEXT,
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `)
  console.log('Tabla roles creada')

  // ── 2. Insertar roles base ──────────────────────
  await db.query(`
    INSERT INTO roles (nombre, descripcion) VALUES
      ('admin',     'Acceso total al sistema'),
      ('editor',    'Puede agregar y editar registros'),
      ('viewer',    'Solo puede visualizar registros')
    ON CONFLICT (nombre) DO NOTHING
  `)
  console.log('Roles base insertados (admin, editor, viewer)')

  // ── 3. Tabla usuarios con FK a roles ───────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id         SERIAL PRIMARY KEY,
      nombre     VARCHAR(100) NOT NULL,
      email      VARCHAR(100) UNIQUE NOT NULL,
      password   VARCHAR(255) NOT NULL,
      rol_id     INT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
      activo     BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)
  console.log('Tabla usuarios creada ')

  // ── 4. Tabla vehiculos ──────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS vehiculos (
      id          SERIAL PRIMARY KEY,
      patente     VARCHAR(20) UNIQUE NOT NULL,
      marca       VARCHAR(50) NOT NULL,
      modelo      VARCHAR(50) NOT NULL,
      anio        INT,
      color       VARCHAR(30),
      kilometraje INT DEFAULT 0,
      activo      BOOLEAN DEFAULT TRUE,
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `)
  console.log('Tabla vehiculos creada')

  // ── 5. Tabla logs_cambio ────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS logs_cambio (
      id          SERIAL PRIMARY KEY,
      tabla       VARCHAR(50),
      accion      VARCHAR(20),
      descripcion TEXT,
      usuario_id  INT REFERENCES usuarios(id) ON DELETE SET NULL,
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `)
  console.log('Tabla logs_cambio creada')

  // ── Tabla tipo_documento ────────────────────────
await db.query(`
  CREATE TABLE IF NOT EXISTS tipo_documento (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(80) UNIQUE NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
  )
`)
console.log('Tabla tipo_documento creada')

// ── Tipos de documento base ─────────────────────
await db.query(`
  INSERT INTO tipo_documento (nombre) VALUES
    ('Seguro Obligatorio'),
    ('Revisión Técnica'),
    ('Permiso de Circulación'),
    ('Seguro Complementario'),
    ('Contrato'),
    ('Otro')
  ON CONFLICT (nombre) DO NOTHING
`)
console.log('Tipos de documento insertados')

// ── Tabla documentos ────────────────────────────
await db.query(`
  CREATE TABLE IF NOT EXISTS documentos (
    id                SERIAL PRIMARY KEY,
    nombre            VARCHAR(200) NOT NULL,
    archivo_nombre    VARCHAR(300),
    archivo_ruta      VARCHAR(500),
    tipo_id           INT REFERENCES tipo_documento(id) ON DELETE SET NULL,
    vehiculo_id       INT NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
    fecha_emision     DATE,
    fecha_vencimiento DATE,
    uploaded_by       INT REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at        TIMESTAMP DEFAULT NOW()
  )
`)
console.log('Tabla documentos creada')

  // ── Tabla session (usada por connect-pg-simple para persistir sesiones) ──
  await db.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid"    VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
      "sess"   JSON NOT NULL,
      "expire" TIMESTAMP(6) NOT NULL
    )
  `)
  await db.query(`
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")
  `)
  console.log('Tabla session creada')

  // ── 6. Crear usuario admin por defecto ──────────
  const hash = bcrypt.hashSync('admin123', 10)

  // Obtener id del rol admin
  const { rows: rolesRows } = await db.query(
    `SELECT id FROM roles WHERE nombre = 'admin'`
  )
  const rolAdminId = rolesRows[0].id

  await db.query(`
    INSERT INTO usuarios (nombre, email, password, rol_id)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (email) DO NOTHING
  `, ['Administrador', 'admin@sistema.cl', hash, rolAdminId])
  console.log('Usuario admin creado → admin@sistema.cl / admin123')

  console.log('Base de datos lista')
  process.exit(0)
}

init().catch(err => {
  console.error('Error al inicializar:', err)
  process.exit(1)
})