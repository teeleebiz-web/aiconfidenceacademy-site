import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { handleBookstore } from '../bookstore/http.mjs'

let config
export default async function handler(req, res) {
  if (!config) {
    const stripeKey = process.env.STRIPE_SECRET_KEY
    config = {
      db: process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
        ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null,
      stripe: stripeKey ? new Stripe(stripeKey) : null,
      livemode: /^(sk|rk)_live_/.test(stripeKey || ''),
      salesEnabled: process.env.ACA_BOOKSTORE_SALES_ENABLED === 'true',
      webhookSecret: process.env.ACA_BOOKSTORE_WEBHOOK_SECRET,
      websiteUrl: 'https://aiconfidenceacademy.org',
    }
  }
  const route = req.query?.route ?? new URL(req.url, 'https://checkout.aiconfidenceacademy.org').searchParams.get('route')
  return handleBookstore(req, res, config, route)
}
