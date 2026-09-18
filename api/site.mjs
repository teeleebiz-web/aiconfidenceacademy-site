import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { createAcademyServer } from '../academy/server.mjs'

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
    const enrollmentAutomation = process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.ACA_PHASE_ONE_PRICE_ID && process.env.RESEND_API_KEY && process.env.ACA_EMAIL_FROM && process.env.ACA_APP_URL
      ? { stripe: new Stripe(process.env.STRIPE_SECRET_KEY), webhookSecret: process.env.STRIPE_WEBHOOK_SECRET, phaseOnePriceId: process.env.ACA_PHASE_ONE_PRICE_ID, resend: new Resend(process.env.RESEND_API_KEY), emailFrom: process.env.ACA_EMAIL_FROM, appUrl: process.env.ACA_APP_URL, db, courseId: process.env.ACA_PHASE_ONE_COURSE_ID }
      : null
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
