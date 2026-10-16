import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EnrollmentOperations } from './EnrollmentOperations'

const record = { id: 'test-enrollment', name: 'Test Learner', email: 'learner@example.com', status: 'active', accountStatus: 'active', accessStatus: 'active',
  startsAt: null, expiresAt: null, onboardingCompletedAt: null, invitedAt: null, lastSignInAt: null, paymentMode: 'sandbox',
  payment: { kind: 'installments', status: 'active', total: 14900, paid: 10000, completed: 2, nextAmount: 4900, nextDueAt: '2026-10-18T02:13:47Z', currency: 'usd' },
  messages: [{ subject: 'Enrollment invitation', status: 'delivered', sentAt: '2026-10-04T00:00:00Z', deliveredAt: null, recordedAt: '2026-10-04T00:00:00Z', error: null }] }

afterEach(() => vi.unstubAllGlobals())
it('shows test records separately from live payments, filters, and refreshes without mutation', async () => {
  const user = userEvent.setup()
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ records: [record], hasMore: false, updatedAt: '2026-10-16T00:00:00Z' }) })
  vi.stubGlobal('fetch', fetcher)
  render(<EnrollmentOperations accessToken="owner-session" />)
  expect(await screen.findByText('Test Learner')).toBeTruthy()
  expect(screen.getByText('$100.00 paid of $149.00')).toBeTruthy()
  expect(screen.getByText('2 of 3 payments recorded')).toBeTruthy()
  expect(screen.getByText('delivered')).toBeTruthy()
  expect(fetcher.mock.calls[0][1].headers).toEqual({ 'X-ACA-Access-Token': 'owner-session' })
  await user.selectOptions(screen.getByLabelText('Payment records'), 'live')
  expect(screen.queryByText('Test Learner')).toBeNull()
  expect(screen.getByText('No enrollments match this view.')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Refresh records' }))
  expect(await screen.findByRole('button', { name: 'Refresh records' })).toBeTruthy()
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(fetcher.mock.calls.every(([, options]) => !options.method || options.method === 'GET')).toBe(true)
})
it('denies a forbidden response without rendering stale private data', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))
  render(<EnrollmentOperations accessToken="learner-session" />)
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Enrollment administration is available to the Academy owner.')
  expect(screen.queryByRole('table')).toBeNull()
})
