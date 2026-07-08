import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
})

const FROM = process.env.SMTP_FROM ?? 'noreply@bitacoradelsueño.app'
const BASE = process.env.FRONTEND_URL ?? 'http://localhost:5173'

export async function sendVerificationEmail(to: string, token: string) {
  const link = `${BASE}/verify-email?token=${token}`
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Verifica tu cuenta en Bitácora del Sueño',
    html: `
      <p>Hola,</p>
      <p>Confirma tu dirección de correo haciendo clic en el enlace:</p>
      <p><a href="${link}">${link}</a></p>
      <p>El enlace caduca en 24 h.</p>
    `,
  })
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${BASE}/reset-password?token=${token}`
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Restablecer contraseña — Bitácora del Sueño',
    html: `
      <p>Solicita este enlace para restablecer tu contraseña:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Si no lo pediste, ignora este correo.</p>
    `,
  })
}
