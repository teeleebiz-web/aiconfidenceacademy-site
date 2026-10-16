import { randomUUID, randomBytes } from 'node:crypto'

export class BookstoreError extends Error {
  constructor(status, message) { super(message); this.status = status }
}
const result = value => {
  if (value.error) throw new BookstoreError(503, 'The bookstore is temporarily unavailable.')
  return value.data
}

export async function bookUser(db, authorization) {
  const token = /^Bearer (\S+)$/i.exec(authorization || '')?.[1]
  if (!token) throw new BookstoreError(401, 'Sign in to access your purchases.')
  const { data, error } = await db.auth.getUser(token)
  if (error || !data?.user?.email_confirmed_at || data.user.is_anonymous) {
    throw new BookstoreError(401, 'Sign in with your verified email address.')
  }
  return data.user
}

export async function createBookCheckout(config, user, editionId) {
  if (!config.salesEnabled || !config.stripe || !config.webhookSecret) {
    throw new BookstoreError(503, 'Book purchases are not available yet.')
  }
  if (!/^[0-9a-f-]{36}$/i.test(editionId || '')) throw new BookstoreError(400, 'Select a book edition.')
  const edition = result(await config.db.from('aca_book_editions').select('*').eq('id', editionId).eq('status', 'published').maybeSingle())
  const priceId = config.livemode ? edition?.stripe_live_price_id : edition?.stripe_test_price_id
  if (!edition || !priceId || !edition.amount) throw new BookstoreError(409, 'This edition is not available for purchase.')
  const files = result(await config.db.from('aca_book_files').select('id').eq('edition_id', edition.id).limit(1))
  if (!files.length) throw new BookstoreError(409, 'This edition is not ready for delivery.')
  const price = await config.stripe.prices.retrieve(priceId)
  if (!price.active || price.type !== 'one_time' || price.unit_amount !== edition.amount || price.currency !== edition.currency || price.livemode !== config.livemode) {
    throw new BookstoreError(409, 'This edition is not available for purchase.')
  }
  const order = { id: randomUUID(), user_id: user.id, buyer_email: user.email,
    edition_id: edition.id, amount: edition.amount, currency: edition.currency,
    price_id: priceId, livemode: config.livemode }
  result(await config.db.from('aca_book_orders').insert(order))
  const session = await config.stripe.checkout.sessions.create({
    mode: 'payment', customer_email: user.email, client_reference_id: order.id,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { aca_book_order: order.id },
    integration_identifier: 'aca_bookstore_' + randomBytes(8).toString('hex').replace(/[0-9]/g, 'a').slice(0,8),
    success_url: config.websiteUrl + '/library/?purchase=received',
    cancel_url: config.websiteUrl + '/library/',
  }, { idempotencyKey: 'aca-book-' + order.id })
  result(await config.db.from('aca_book_orders').update({ stripe_session_id: session.id }).eq('id', order.id))
  return { url: session.url }
}

export async function fulfillBookSession(config, sessionId) {
  const session = await config.stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items'] })
  if (session.mode !== 'payment' || session.payment_status !== 'paid' || session.livemode !== config.livemode) return { fulfilled: false }
  const orderId = session.metadata?.aca_book_order
  if (!orderId) return { fulfilled: false }
  const order = result(await config.db.from('aca_book_orders').select('*').eq('id', orderId).maybeSingle())
  const items = session.line_items?.data || []
  if (!order || session.client_reference_id !== order.id || session.line_items?.has_more || items.length !== 1 || items[0].quantity !== 1 || items[0].price?.id !== order.price_id) {
    throw new BookstoreError(400, 'Payment does not match a book order.')
  }
  const intent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  const fulfilled = result(await config.db.rpc('aca_fulfill_book_order', {
    p_order_id: order.id, p_session_id: session.id, p_payment_intent_id: intent,
    p_amount: session.amount_total, p_currency: session.currency, p_livemode: session.livemode,
  }))
  return { fulfilled }
}

export async function bookDownload(config, user, fileId) {
  if (!/^[0-9a-f-]{36}$/i.test(fileId || '')) throw new BookstoreError(404, 'Download unavailable.')
  const file = result(await config.db.from('aca_book_files').select('*').eq('id', fileId).maybeSingle())
  if (!file) throw new BookstoreError(404, 'Download unavailable.')
  const access = result(await config.db.from('aca_book_access').select('order_id').eq('user_id', user.id)
    .eq('edition_id', file.edition_id).eq('livemode', config.livemode).eq('status', 'active').maybeSingle())
  if (!access) throw new BookstoreError(403, 'Purchase this edition to access its files.')
  const order = result(await config.db.from('aca_book_orders').select('status').eq('id', access.order_id).eq('user_id', user.id).maybeSingle())
  if (order?.status !== 'paid') throw new BookstoreError(403, 'Download unavailable.')
  const signed = result(await config.db.storage.from('aca-bookstore-files').createSignedUrl(file.object_path, 300, { download: true }))
  return { url: signed.signedUrl, expiresIn: 300 }
}
