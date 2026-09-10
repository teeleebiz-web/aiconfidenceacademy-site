export type WorkbookDocument = { key: string; version: number; title: string; navigationLabel?: string; subtitle?: string; pageCount?: number; contents?: { page: number; text: string }[]; pages: { number: number; kicker: string; title: string; blocks: unknown[] }[] }
export type RecordState = { workbook?: WorkbookDocument; answers: Record<string, string>; last_page: number; revision: number; updated_at: string | null; allowedPages: number[]; scope: string }
export type WorkbookState = RecordState & { status: 'loading' | 'saved' | 'unsaved' | 'saving' | 'error' | 'conflict'; message: string }
export type Transport = (method: 'GET' | 'PATCH', patch?: { answers: Record<string, string>; baseRevision: number; page: number; scope: string }) => Promise<RecordState>
export class WorkbookStore {
  state: WorkbookState = { answers: {}, last_page: 5, revision: 0, updated_at: null, allowedPages: [], scope: '', status: 'loading', message: '' }
  private listeners = new Set<() => void>()
  private dirty: Record<string, string> = {}
  private pageDirty = false
  private timer: ReturnType<typeof setTimeout> | undefined
  private flight: Promise<void> | undefined
  private active = true
  private loadGeneration = 0
  constructor(private transport: Transport) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  snapshot = () => this.state
  private update(next: Partial<WorkbookState>) { this.state = { ...this.state, ...next }; this.listeners.forEach(fn => fn()) }
  get pending() { return Object.keys(this.dirty).length > 0 || this.pageDirty }
  async load() {
    this.active = true
    const generation = ++this.loadGeneration
    try { const record = await this.transport('GET'); if (this.active && generation === this.loadGeneration) this.update({ ...record, status: 'saved', message: '' }) }
    catch (e) { if (this.active && generation === this.loadGeneration) this.update({ status: 'error', message: (e as Error).message }) }
  }
  change(id: string, value: string) {
    this.dirty[id] = value
    this.update({ answers: { ...this.state.answers, [id]: value }, status: 'unsaved', message: '' })
    this.schedule()
  }
  page(number: number) {
    if (!this.state.allowedPages.includes(number)) return
    this.pageDirty = true
    this.update({ last_page: number, status: 'unsaved', message: '' }); this.schedule()
  }
  private schedule() { clearTimeout(this.timer); this.timer = setTimeout(() => { void this.save() }, 800) }
  async save(): Promise<void> {
    clearTimeout(this.timer)
    if (this.flight) { await this.flight; if (this.active && this.pending && !['error', 'conflict'].includes(this.state.status)) await this.save(); return }
    if (!this.active || !this.pending || !this.state.scope) return
    const answers: Record<string, string> = {}
    // Keep each request within the browser's keepalive budget, including Unicode.
    for (const [key, value] of Object.entries(this.dirty)) {
      const candidate = { ...answers, [key]: value }
      if (new TextEncoder().encode(JSON.stringify(candidate)).length > 48000) break
      answers[key] = value
    }
    const page = this.state.last_page, revision = this.state.revision
    this.update({ status: 'saving', message: '' })
    this.flight = (async () => {
      try {
        const saved = await this.transport('PATCH', { answers, page, baseRevision: revision, scope: this.state.scope })
        if (!this.active) return
        for (const [key, value] of Object.entries(answers)) if (this.dirty[key] === value) delete this.dirty[key]
        if (this.state.last_page === page) this.pageDirty = false
        this.update({ revision: saved.revision, updated_at: saved.updated_at, answers: { ...saved.answers, ...this.dirty }, status: this.pending ? 'unsaved' : 'saved' })
      } catch (e) {
        if (!this.active) return
        const error = e as Error & { status?: number; current?: RecordState }
        if (error.status === 409) {
          try {
            const latest = error.current ?? await this.transport('GET')
            if (!this.active) return
            this.update({ revision: latest.revision, answers: { ...latest.answers, ...this.dirty }, status: 'conflict', message: 'Another window saved newer work. Your typing is still here. Select Save to keep these answers.' })
          } catch { this.update({ status: 'error', message: 'Your answers have not saved yet. Keep this page open and select Save to try again.' }) }
        } else this.update({ status: 'error', message: error.message })
      }
    })()
    await this.flight; this.flight = undefined
    if (this.active && this.pending && this.state.status === 'unsaved') await this.save()
  }
  dispose() { this.active = false; this.loadGeneration++; clearTimeout(this.timer); this.listeners.clear() }
}
