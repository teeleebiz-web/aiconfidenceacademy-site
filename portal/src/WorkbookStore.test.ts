import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkbookStore, type RecordState, type Transport } from '../../academy/workbook/store'
const empty = (): RecordState => ({ answers: {}, last_page: 5, revision: 0, updated_at: null, allowedPages: Array.from({length:32}, (_,i)=>i+1), scope: 'owner-review' })
const deferred = <T>() => { let resolve!: (value:T)=>void; let reject!: (error:unknown)=>void; const promise=new Promise<T>((r,j)=>{resolve=r; reject=j}); return {promise,resolve,reject} }
function memory() {
  let record=empty()
  const send=vi.fn<Transport>(async (method,patch)=> {
    if(method==='PATCH') record={...record,answers:{...record.answers,...patch!.answers},last_page:patch!.page,revision:record.revision+1,updated_at:'2026-09-10T00:00:00Z'}
    return structuredClone(record)
  })
  return {send,store:new WorkbookStore(send)}
}
afterEach(()=>vi.useRealTimers())
describe('workbook saving',()=>{
  it('autosaves answers and position, then restores them in a fresh session',async()=>{
    vi.useFakeTimers(); const {send,store}=memory(); await store.load()
    store.change('first','My own answer'); store.page(6)
    expect(store.state.status).toBe('unsaved'); await vi.advanceTimersByTimeAsync(799); expect(send).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1); expect(store.state.status).toBe('saved')
    const reopened=new WorkbookStore(send); await reopened.load()
    expect(reopened.state.answers.first).toBe('My own answer'); expect(reopened.state.last_page).toBe(6)
    store.dispose(); reopened.dispose()
  })
  it('keeps newer typing while a previous request is in flight',async()=>{
    vi.useFakeTimers(); const flight=deferred<RecordState>(); let writes=0
    const send=vi.fn<Transport>(async(method,patch)=>method==='GET'?empty():++writes===1?flight.promise:({...empty(),answers:patch!.answers,revision:2,last_page:patch!.page,updated_at:'saved'}))
    const store=new WorkbookStore(send); await store.load(); store.change('first','earlier'); const saving=store.save()
    store.change('first','later'); store.page(7)
    flight.resolve({...empty(),answers:{first:'earlier'},revision:1,updated_at:'saved'}); await saving
    expect(store.state.answers.first).toBe('later'); expect(store.state.last_page).toBe(7); expect(store.pending).toBe(false); expect(writes).toBe(2); store.dispose()
  })
  it('retains unsaved answers on a connection failure and retries on Save',async()=>{
    const {send,store}=memory(); await store.load(); send.mockRejectedValueOnce(new Error('Connection lost'))
    store.change('first','keep this'); await store.save()
    expect(store.state.status).toBe('error'); expect(store.state.answers.first).toBe('keep this'); expect(store.pending).toBe(true)
    await store.save(); expect(store.state.status).toBe('saved'); expect(store.pending).toBe(false); store.dispose()
  })
  it('preserves other-window answers and requests deliberate conflict resolution',async()=>{
    const {send,store}=memory(); await store.load(); const current={...empty(),answers:{first:'other window',second:'preserved'},revision:4}
    send.mockRejectedValueOnce(Object.assign(new Error('Conflict'),{status:409,current}))
    store.change('first','my typing'); await store.save()
    expect(store.state.status).toBe('conflict'); expect(store.state.answers).toEqual({first:'my typing',second:'preserved'})
    send.mockResolvedValueOnce({...current,answers:{...current.answers,first:'my typing'},revision:5}); await store.save()
    expect(send.mock.lastCall?.[1]?.baseRevision).toBe(4); expect(store.state.status).toBe('saved'); store.dispose()
  })
  it('ignores a stale initial load after StrictMode cleanup and reopening',async()=>{
    const first=deferred<RecordState>(),second=deferred<RecordState>()
    const send=vi.fn<Transport>().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const store=new WorkbookStore(send); const oldLoad=store.load(); store.dispose(); const newLoad=store.load()
    second.resolve({...empty(),answers:{first:'latest'},revision:2}); await newLoad
    store.change('first','new typing'); first.resolve({...empty(),answers:{first:'stale'},revision:1}); await oldLoad
    expect(store.state.answers.first).toBe('new typing'); expect(store.state.revision).toBe(2); store.dispose()
  })
  it('splits large Unicode drafts into bounded requests without losing answers',async()=>{
    const {send,store}=memory(); await store.load()
    for(let i=0;i<12;i++) store.change(`field${i}`,'漢'.repeat(4000))
    await store.save()
    const patches=send.mock.calls.filter(([method])=>method==='PATCH').map(([,patch])=>patch!)
    expect(patches.length).toBeGreaterThan(1)
    for(const patch of patches) expect(new TextEncoder().encode(JSON.stringify(patch)).length).toBeLessThan(60000)
    expect(Object.keys(store.state.answers)).toHaveLength(12); expect(store.pending).toBe(false); store.dispose()
  })
})
