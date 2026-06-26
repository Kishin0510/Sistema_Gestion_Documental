const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST,
  port:   process.env.EMAIL_PORT,
  secure: process.env.EMAIL_PORT === '465',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false // evita errores con certificados corporativos
  }
})

// ── Verificar conexión al iniciar ────────────────
transporter.verify((err) => {
  if (err) console.error('❌ Error configurando email:', err.message)
  else     console.log('✅ Servicio de email listo')
})

// ── Enviar alerta de vencimiento ─────────────────
exports.enviarAlertaVencimiento = async ({ nombre, fecha_vencimiento, patente, marca, modelo, diff }) => {
  const esVencido = diff < 0
  const asunto    = esVencido
    ? `🔴 Documento vencido: ${nombre} — ${patente}`
    : `⚠️ Documento por vencer: ${nombre} — ${patente}`

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      process.env.EMAIL_USER,
    subject: asunto,
    html: `
      <div style="font-family:sans-serif; max-width:600px; margin:auto;">
        <div style="background:#1e3a5f; padding:1.5rem; border-radius:8px 8px 0 0;">
          <h2 style="color:white; margin:0;">🚗 Sistema de Gestión Documental</h2>
        </div>
        <div style="background:white; padding:1.5rem; border:1px solid #eee;">
          <h3 style="color:${esVencido ? '#dc2626' : '#d97706'}">
            ${esVencido ? '🔴 Documento Vencido' : '⚠️ Documento Por Vencer'}
          </h3>
          <table style="width:100%; border-collapse:collapse;">
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:.6rem; color:#666;">Documento</td>
              <td style="padding:.6rem; font-weight:bold;">${nombre}</td>
            </tr>
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:.6rem; color:#666;">Vehículo</td>
              <td style="padding:.6rem;">${patente} — ${marca} ${modelo}</td>
            </tr>
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:.6rem; color:#666;">Vencimiento</td>
              <td style="padding:.6rem;">
                ${new Date(fecha_vencimiento).toLocaleDateString('es-CL')}
              </td>
            </tr>
            <tr>
              <td style="padding:.6rem; color:#666;">Estado</td>
              <td style="padding:.6rem; color:${esVencido ? '#dc2626' : '#d97706'};">
                ${esVencido
                  ? `Venció hace ${Math.abs(diff)} días`
                  : `Vence en ${diff} días`}
              </td>
            </tr>
          </table>
        </div>
        <div style="background:#f4f6f9; padding:1rem; border-radius:0 0 8px 8px; text-align:center;">
          <small style="color:#999;">Sistema de Gestión Documental — Notificación automática</small>
        </div>
      </div>
    `
  })
}

// ── Email de bienvenida / reset password ─────────
exports.enviarResetPassword = async ({ email, nombre, token }) => {
  const url = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password/${token}`

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      email,
    subject: '🔑 Recuperar contraseña — Sistema Gestión',
    html: `
      <div style="font-family:sans-serif; max-width:600px; margin:auto;">
        <div style="background:#1e3a5f; padding:1.5rem; border-radius:8px 8px 0 0;">
          <h2 style="color:white; margin:0;">🚗 Sistema de Gestión Documental</h2>
        </div>
        <div style="background:white; padding:1.5rem; border:1px solid #eee;">
          <h3>Hola ${nombre},</h3>
          <p>Recibimos una solicitud para restablecer tu contraseña.</p>
          <p>Haz clic en el botón para continuar:</p>
          <a href="${url}"
             style="display:inline-block; background:#3b82f6; color:white;
                    padding:.8rem 1.5rem; border-radius:6px; text-decoration:none;
                    margin:1rem 0;">
            Restablecer contraseña
          </a>
          <p style="color:#999; font-size:.85rem;">
            Este enlace expira en 1 hora. Si no solicitaste esto, ignora este correo.
          </p>
        </div>
      </div>
    `
  })
}