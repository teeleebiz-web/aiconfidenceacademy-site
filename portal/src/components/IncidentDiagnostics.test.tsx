import {render,screen} from '@testing-library/react'
import {IncidentDiagnostics,type IncidentStatus} from './IncidentDiagnostics'
const base:IncidentStatus={available:true,policy:{enabled:false,activated_at:null},coordinator:null,reports:[]}
it('keeps prepared, unavailable and collected states distinct',()=>{
 const {rerender}=render(<IncidentDiagnostics diagnostics={base}/>);expect(screen.getByText('Awaiting activation')).toBeTruthy();expect(screen.getByText('No automatic repair actions are enabled.')).toBeTruthy()
 rerender(<IncidentDiagnostics/>);expect(screen.getByText('Diagnosis status unavailable')).toBeTruthy()
 rerender(<IncidentDiagnostics diagnostics={{...base,policy:{enabled:true,activated_at:'2026-10-27T09:00:00Z'}}}/>);expect(screen.getByText('Awaiting first collection')).toBeTruthy()
})
it('does not describe an old or unsynchronized collection as current',()=>{
 const diagnostics:IncidentStatus={...base,policy:{enabled:true,activated_at:'2026-10-27T09:00:00Z'},coordinator:{checked_at:'2026-10-27T10:00:00Z',status:'sync_pending',workflow_run_id:'123'}}
 const {rerender}=render(<IncidentDiagnostics diagnostics={diagnostics} now={Date.parse('2026-10-27T10:15:00Z')}/>);expect(screen.getByText('Evidence synchronization pending')).toBeTruthy()
 rerender(<IncidentDiagnostics diagnostics={diagnostics} now={Date.parse('2026-10-27T11:01:00Z')}/>);expect(screen.getByText('Collector needs review')).toBeTruthy()
})
it('shows confirmed evidence and recovery without claiming a repair',()=>{
 const sample={code:200,ready:true,readiness:null,error:null}
 render(<IncidentDiagnostics diagnostics={{...base,reports:[{id:'a'.repeat(64),role:'website',source_at:'2026-10-27T09:55:00Z',observed_at:'2026-10-27T10:15:00Z',resolved_at:'2026-10-27T10:15:00Z',status:'recovered',diagnosis:'recovered',provider_status:'up',repair_performed:false,samples:{website:[sample,sample],backend:[{...sample,readiness:'ok'},{...sample,readiness:'ok'}]}}]}}/>)
 expect(screen.getByText('Public website · Recovery confirmed')).toBeTruthy();expect(screen.getByText(/StatusCake and two current checks confirm/)).toBeTruthy();expect(screen.queryByRole('button')).toBeNull()
})
