import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
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
    server = createAcademyServer({ password: process.env.ACA_CONSTRUCTION_PASSWORD,
      root: resolve('private-dist'), db, courseId: process.env.ACA_PHASE_ONE_COURSE_ID })
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
