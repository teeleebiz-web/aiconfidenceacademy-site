import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { createAcademyServer } from '../academy/server.mjs'
import { lessonReleaseMessage } from '../academy/email/lesson-release-message.mjs'
import { formatAcademyEmailFrom } from '../academy/email/sender.mjs'

let server
export default function handler(request, response) {
  if (!server) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      response.writeHead(503, { 'Cache-Control': 'no-store' })
      response.end('Website configuration is incomplete.'); return
    }
    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const enrollmentAutomation = {
          stripe: process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null,
          webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
          phaseOnePriceId: process.env.ACA_PHASE_ONE_PRICE_ID,
          installment50PriceId: process.env.ACA_INSTALLMENT_50_PRICE_ID,
          installment49PriceId: process.env.ACA_INSTALLMENT_49_PRICE_ID,
          resend: process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null,
          resendWebhookSecret: process.env.RESEND_WEBHOOK_SECRET,
          emailFrom: formatAcademyEmailFrom(process.env.ACA_EMAIL_FROM),
          appUrl: process.env.ACA_APP_URL,
          cronSecret: process.env.CRON_SECRET,
          db,
          courseId: process.env.ACA_PHASE_ONE_COURSE_ID,
          lessonReleaseMessage,
        }
    server = createAcademyServer({ password: process.env.ACA_CONSTRUCTION_PASSWORD,
      root: resolve('private-dist'), db, courseId: process.env.ACA_PHASE_ONE_COURSE_ID, enrollmentAutomation })
  }
  const path = request.query?.__aca_path
    ?? new URL(request.url, 'http://localhost').searchParams.get('__aca_path')
  if (typeof path === 'string') request.url = '/' + path.replace(/^\/+/, '')
  return new Promise(resolve => {
    response.once('finish', resolve)
    response.once('close', resolve)
    server.emit('request', request, response)
  })
}
