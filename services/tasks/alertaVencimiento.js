// services/tasks/alertaVencimiento.js
const cron         = require('node-cron')
const db           = require('../../db')
const emailService = require('../emailService')

const ejecutarAlertas = async () => {
  console.log('🔔 Verificando documentos por vencer...')

  try {
    // Documentos que vencen en los próximos 30 días O ya vencidos
    const { rows: documentos } = await db.query(`
      SELECT
        d.id,
        d.nombre,
        d.fecha_vencimiento,
        v.patente,
        v.marca,
        v.modelo,
        CEIL(EXTRACT(EPOCH FROM (d.fecha_vencimiento - NOW())) / 86400) AS diff
      FROM documentos d
      JOIN vehiculos v ON v.id = d.vehiculo_id
      WHERE d.fecha_vencimiento IS NOT NULL
        AND d.fecha_vencimiento <= NOW() + INTERVAL '30 days'
      ORDER BY d.fecha_vencimiento ASC
    `)

    if (documentos.length === 0) {
      console.log('✅ No hay documentos por vencer')
      return
    }

    console.log(`📋 ${documentos.length} documento(s) requieren atención`)

    for (const doc of documentos) {
      try {
        await emailService.enviarAlertaVencimiento(doc)
        console.log(`📧 Alerta enviada: ${doc.nombre} — ${doc.patente}`)
      } catch (emailErr) {
        console.error(`❌ Error enviando alerta para ${doc.nombre}:`, emailErr.message)
      }
    }

  } catch (err) {
    console.error('❌ Error en tarea de alertas:', err)
  }
}

// Corre todos los días a las 8:00 AM
cron.schedule('0 8 * * *', ejecutarAlertas, {
  timezone: 'America/Santiago'
})

// Exportar para poder llamarla manualmente si se necesita
module.exports = { ejecutarAlertas }