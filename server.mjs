import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { createAcademyServer } from './academy/server.mjs'

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Server-side database configuration is required.')
}
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
createAcademyServer({
  password: process.env.ACA_CONSTRUCTION_PASSWORD,
  root: resolve('private-dist'),
  db,
  courseId: process.env.ACA_PHASE_ONE_COURSE_ID,
}).listen(Number(process.env.PORT || 3000))
