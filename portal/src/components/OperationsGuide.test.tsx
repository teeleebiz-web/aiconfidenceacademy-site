import {render,screen} from '@testing-library/react'
import {operationalAdvice,OperationsGuide} from './OperationsGuide'
import type {Snapshot} from './controlTypes'
const now=Date.parse('2026-11-07T05:00:00Z')
const snapshot={updated_at:new Date(now).toISOString(),emails:[],automations:[],diagnostics:{available:true,policy:{enabled:true},coordinator:{status:'completed',checked_at:new Date(now).toISOString()},reports:[]},backup:{policy:{enabled:true},open_count:0,last_verified:{finished_at:new Date(now).toISOString()}}} as unknown as Snapshot
it('blocks recommendations from stale or invalid snapshots',()=>{
 for(const updated_at of ['invalid','2026-01-01']){const result=operationalAdvice({...snapshot,updated_at},now);expect(result.map(x=>x.id)).toEqual(['stale']);expect(result[0].next).toContain('Refresh')}
})
it('uses the latest job record and does not claim whole-system health',()=>{
 const data={...snapshot,automations:[{id:'old',job:'newsletter',status:'failed',started_at:'2026-11-06T04:00:00Z'},{id:'new',job:'newsletter',status:'completed',started_at:'2026-11-07T04:00:00Z'}]} as Snapshot
 expect(operationalAdvice(data,now).map(x=>x.id)).toEqual(['none']);expect(operationalAdvice(data,now)[0].evidence).toContain('did not trigger')
})
it('shows investigation and verification without offering repair controls',()=>{
 const data={...snapshot,updated_at:new Date().toISOString(),backup:{...snapshot.backup,open_count:1}} as Snapshot
 render(<OperationsGuide data={data}/>);expect(screen.getByText('Review backup protection')).toBeTruthy();expect(screen.getByText(/matches original file hashes/)).toBeTruthy();expect(screen.queryByRole('button')).toBeNull()
})
