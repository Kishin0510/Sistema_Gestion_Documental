require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  max:                     Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis:       30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  // Errores en clientes ociosos del pool (ej. la BD cierra la conexión).
  // Sin este handler, un error aquí puede tumbar el proceso completo.
  console.error('Error inesperado en el pool de PostgreSQL:', err.message)
})

// Verificar conexión al iniciar
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error conectando a PostgreSQL:', err.message)
  } else {
    console.log('Conectado a PostgreSQL')
    release()
  }
})

// ── Ejecutar varias queries dentro de una transacción ──
// Uso:
//   await db.transaction(async (client) => {
//     await client.query('INSERT ...')
//     await client.query('INSERT ...')
//   })
// Si el callback lanza un error, se hace ROLLBACK y el error se re-lanza
// para que la ruta lo capture en su propio try/catch.
async function transaction(callback) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

module.exports = {
  query:       (text, params) => pool.query(text, params),
  transaction,
  pool,
}