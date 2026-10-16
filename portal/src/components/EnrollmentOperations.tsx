import { useEffect, useState } from 'react'

type Payment = { kind: string; status: string; total: number; paid: number; currency: string; completed?: number; nextDueAt?: string | null; nextAmount?: number | null; graceUntil?: string | null }
type Message = { subject: string; status: string; sentAt: string | null; deliveredAt: string | null; recordedAt: string; error: string | null }
export type EnrollmentRecord = {
  id: string; name: string; email: string | null; status: string; accountStatus: string; accessStatus: string;
  startsAt: string | null; expiresAt: string | null; onboardingCompletedAt: string | null;
  invitedAt: string | null; lastSignInAt: string | null;
  paymentMode: 'live' | 'sandbox' | 'unrecorded'; payment: Payment | null; messages: Message[];
}
type Result = { records: EnrollmentRecord[]; hasMore: boolean; updatedAt: string }
const date = (value?: string | null) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded'
const money = (value: number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value / 100)

export function EnrollmentOperations({ accessToken }: { accessToken: string }) {
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState('all')
  const backendOrigin = import.meta.env.VITE_ACA_BACKEND_ORIGIN
    ?? (window.location.hostname.endsWith('.vercel.app') ? window.location.origin : 'https://checkout.aiconfidenceacademy.org')
  const endpoint = `${backendOrigin}/api/operations/enrollments`
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setResult(null)
    fetch(endpoint, { headers: { 'X-ACA-Access-Token': accessToken }, cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 401 ? 'Your session has ended. Please sign in again.' : response.status === 403 ? 'Enrollment administration is available to the Academy owner.' : 'Enrollment records could not load. Please try again.')
        return await response.json() as Result
      })
      .then(data => { if (!controller.signal.aborted) setResult(data) })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Enrollment records could not load.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [accessToken, endpoint, revision])
  const records = result?.records || []
  const visible = records.filter(item => (mode === 'all' || item.paymentMode === mode)
    && `${item.name} ${item.email || ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  return <main className="operations-shell">
    <div className="operations-heading">
      <div><p className="eyebrow">Academy owner</p><h1>Enrollment administration</h1>
        <p>Review enrollment, payment progress, learner access, and recent email status.</p></div>
      <button type="button" className="quiet-button" disabled={loading} onClick={() => setRevision(value => value + 1)}>Refresh records</button>
    </div>
    <p className="operations-note">Sandbox payments are test transactions. Records without a payment entry may include founder access or temporary test accounts. This view does not change accounts or payments.</p>
    {loading ? <p role="status">Loading enrollment records…</p> : error ? <p role="alert" className="global-error">{error}</p> : result ? <>
      <dl className="operations-summary">
        <div><dt>Enrollments in this view</dt><dd>{records.length}</dd></div>
        <div><dt>Live payment records</dt><dd>{records.filter(item => item.paymentMode === 'live').length}</dd></div>
        <div><dt>Sandbox enrollments</dt><dd>{records.filter(item => item.paymentMode === 'sandbox').length}</dd></div>
        <div><dt>Paused enrollments</dt><dd>{records.filter(item => item.status === 'paused').length}</dd></div>
      </dl>
      <div className="operations-filters">
        <label>Find a learner<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name or email" /></label>
        <label>Payment records<select value={mode} onChange={event => setMode(event.target.value)}>
          <option value="all">All records</option><option value="live">Live payments</option><option value="sandbox">Sandbox payments</option><option value="unrecorded">No payment record</option>
        </select></label>
      </div>
      <p className="operations-updated">Updated {date(result.updatedAt)}. Times use your device’s timezone.{result.hasMore ? ' Showing the latest 100 enrollments.' : ''}</p>
      {!visible.length ? <p>No enrollments match this view.</p> : <div className="operations-table-wrap"><table className="operations-table">
        <caption>Enrollment records and recent activity</caption>
        <thead><tr><th scope="col">Learner</th><th scope="col">Enrollment and access</th><th scope="col">Payments</th><th scope="col">Recent email</th></tr></thead>
        <tbody>{visible.map(item => <tr key={item.id}>
          <th scope="row"><strong>{item.name}</strong><span>{item.email || 'Email unavailable'}</span>
            <span className="operations-badge">{item.paymentMode === 'sandbox' ? 'Sandbox' : item.paymentMode === 'live' ? 'Live payment' : 'No payment record'}</span></th>
          <td><strong className="operations-status">{item.status}</strong><span className="operations-status">Access: {item.accessStatus}</span><span>Account: {item.accountStatus}</span>
            <span>Started: {date(item.startsAt)}</span><span>Access ends: {date(item.expiresAt)}</span>
            <details><summary>Sign-in and orientation</summary><p>Invitation: {date(item.invitedAt)}<br />Last sign-in: {date(item.lastSignInAt)}<br />Orientation completed: {date(item.onboardingCompletedAt)}</p></details></td>
          <td>{item.payment ? <><strong>{item.payment.kind === 'installments' ? 'Installments' : 'One payment'}</strong>
            <span>{money(item.payment.paid, item.payment.currency)} paid of {money(item.payment.total, item.payment.currency)}</span>
            <span>Status: {item.payment.status}</span>{item.payment.completed !== undefined ? <span>{item.payment.completed} of 3 payments recorded</span> : null}
            {item.payment.nextDueAt && item.payment.nextAmount !== null && item.payment.nextAmount !== undefined ? <span>Next: {money(item.payment.nextAmount, item.payment.currency)} · {date(item.payment.nextDueAt)}</span> : null}
            {item.payment.graceUntil ? <span>Correction deadline: {date(item.payment.graceUntil)}</span> : null}</> : <span>No payment entry recorded.</span>}</td>
          <td>{!item.messages.length ? <span>No email records.</span> : <ul className="operations-messages">{item.messages.map((message, index) => <li key={`${message.recordedAt}-${index}`}>
            <strong>{message.subject}</strong><span className="operations-status">{message.status}</span>
            <span>{message.deliveredAt ? `Delivered: ${date(message.deliveredAt)}` : message.sentAt ? `Sent: ${date(message.sentAt)}` : `Recorded: ${date(message.recordedAt)}`}</span>
            {message.error ? <span>{message.error}</span> : null}
          </li>)}</ul>}</td>
        </tr>)}</tbody>
      </table></div>}
    </> : null}
  </main>
}
