import { bookUser, createBookCheckout, fulfillBookSession, bookDownload, BookstoreError } from './service.mjs'

async function body(req) {
  const chunks = []; let size = 0
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk)
    if (size > 262144) throw new BookstoreError(413, 'Request too large.')
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}
const json = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  res.end(JSON.stringify(data))
}
export async function handleBookstore(req, res, config, route) {
  try {
    if (!config.db) throw new BookstoreError(503, 'Bookstore configuration is incomplete.')
    if (route === 'status' && req.method === 'GET') {
      json(res, 200, { store: 'ACA Bookstore', salesEnabled: Boolean(config.salesEnabled && config.stripe && config.webhookSecret), status: 'preparing_editions' }); return
    }
    if (route === 'webhook' && req.method === 'POST') {
      if (!config.stripe || !config.webhookSecret) throw new BookstoreError(503, 'Book payment processing is not enabled.')
      let event
      try { event = config.stripe.webhooks.constructEvent(await body(req), req.headers['stripe-signature'], config.webhookSecret) }
      catch { throw new BookstoreError(400, 'Invalid payment event.') }
      if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
        await fulfillBookSession(config, event.data.object.id)
      }
      json(res, 200, { received: true }); return
    }
    if (!['checkout', 'download', 'purchases'].includes(route)) throw new BookstoreError(404, 'Bookstore endpoint not found.')
    if ((route === 'purchases' && req.method !== 'GET') || (route !== 'purchases' && req.method !== 'POST')) throw new BookstoreError(405, 'Method not allowed.')
    const user = await bookUser(config.db, req.headers.authorization)
    if (route === 'purchases') {
      const records = await config.db.from('aca_book_orders').select('id,edition_id,status,amount,currency,created_at').eq('user_id', user.id).eq('livemode', config.livemode).order('created_at', { ascending: false }).limit(100)
      if (records.error) throw new BookstoreError(503, 'Purchase history is temporarily unavailable.')
      json(res, 200, { purchases: records.data }); return
    }
    let input
    try { input = JSON.parse((await body(req)).toString('utf8')) } catch(e) { if(e instanceof BookstoreError) throw e; throw new BookstoreError(400, 'Invalid request.') }
    const data = route === 'checkout' ? await createBookCheckout(config,user,input?.editionId) : await bookDownload(config,user,input?.fileId)
    json(res, 200, data)
  } catch(error) {
    json(res, error instanceof BookstoreError ? error.status : 503, { error: error instanceof BookstoreError ? error.message : 'The bookstore is temporarily unavailable.' })
  }
}
