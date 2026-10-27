import {render,screen,within} from '@testing-library/react'
import {BackupStatus,type BackupStatusData} from './BackupStatus'

const data=():BackupStatusData=>({
 policy:{enabled:true,keep_daily:7,prune_enabled:true,credential_expires_at:'2027-10-25T17:00:00Z'},
 latest_run:{id:'run',job:'storage-backups',status:'completed',started_at:'2026-10-26T22:43:07Z',finished_at:'2026-10-26T22:49:43Z',result:{fileCount:68,totalBytes:1650971985,workflowRunId:'40414470671'}},
 last_verified:{id:'run',job:'storage-backups',status:'completed',started_at:'2026-10-26T22:43:07Z',finished_at:'2026-10-26T22:49:43Z',result:{fileCount:68,totalBytes:1650971985,workflowRunId:'40414470671'}},
 open_count:0,incidents:[{id:'incident',reason:'run_missing',occurred_at:'2026-10-26T18:17:00Z',resolved_at:'2026-10-26T22:49:43Z',recovery_run_id:'run',warning_delivery:'delivered',recovery_delivery:'queued'}],
})
it('separates resolved backup problems from notification delivery and preserves warning history',()=>{
 render(<BackupStatus backup={data()}/> )
 expect(screen.getByText('Last recovery verified')).toBeTruthy()
 expect(screen.getByText('68 files')).toBeTruthy();expect(screen.getByText('1.65 GB of original files')).toBeTruthy()
 const table=screen.getByRole('table',{name:'Backup incidents and recovery notifications'})
 expect(within(table).getByText('Resolved')).toBeTruthy();expect(within(table).getByText('Delivered')).toBeTruthy();expect(within(table).getByText('Queued')).toBeTruthy()
 expect(screen.getByRole('link',{name:/View the verified backup run/}).getAttribute('href')).toBe('https://github.com/teeleebiz-web/aiconfidenceacademy-site/actions/runs/40414470671')
 expect(screen.getByText(/The scheduler can start late/)).toBeTruthy()
})
it('keeps open incidents visible even when a previous backup was verified',()=>{
 const backup=data();backup.open_count=1;backup.incidents[0].resolved_at=null;backup.incidents[0].recovery_delivery=null
 render(<BackupStatus backup={backup}/> )
 expect(screen.getByText('Needs review')).toBeTruthy();expect(screen.getByText('Open')).toBeTruthy();expect(screen.queryByText('Resolved')).toBeNull()
 expect(screen.getByText('Not queued')).toBeTruthy()
})
it('does not turn missing evidence or disabled automation into a healthy status',()=>{
 const backup=data();backup.policy.enabled=false;backup.latest_run=null;backup.last_verified=null;backup.incidents=[]
 const view=render(<BackupStatus backup={backup}/> )
 expect(screen.getByText('Automation disabled')).toBeTruthy();expect(screen.queryByText('68 files')).toBeNull()
 view.rerender(<BackupStatus/>);expect(screen.getByText(/Backup status is unavailable/)).toBeTruthy();expect(screen.queryByText(/No unresolved/)).toBeNull()
})
