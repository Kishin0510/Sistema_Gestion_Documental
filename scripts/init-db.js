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

  // ── 4. Tabla logs_cambio ────────────────────────
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

  // ── 5. Crear usuario admin por defecto ──────────
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