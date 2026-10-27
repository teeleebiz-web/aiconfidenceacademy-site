import type {AutomationRecord} from './controlTypes'
import './backup-status.css'

export type BackupStatusData = {
 policy: {enabled:boolean;keep_daily:number;prune_enabled:boolean;credential_expires_at:string|null}
 latest_run: AutomationRecord|null
 last_verified: AutomationRecord|null
 open_count:number
 incidents:Array<{id:string;reason:string;occurred_at:string;resolved_at:string|null;recovery_run_id:string|null;warning_delivery:string;recovery_delivery:string|null}>
}
const date=(value?:string|null)=>value?new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'Not recorded'
const reasons:Record<string,string>={run_missing:'Scheduled backup delayed or missing',run_stalled:'Backup exceeded its completion window',job_failed:'Backup failed',job_warning:'Backup needs review',history_failed:'Backup history could not be saved',credential_expiring:'Backup credential expires soon'}
const delivery=(value:string|null)=>value?({sent:'Submitted',delivered:'Delivered',queued:'Queued',sending:'Submission in progress',review:'Delivery needs review',cancelled:'Resolved before notification'} as Record<string,string>)[value]||value:'Not queued'

export function BackupStatus({backup}:{backup?:BackupStatusData|null}) {
 if(!backup)return <section className="cc-panel cc-backup" aria-labelledby="backup-heading"><div className="cc-panel-heading"><h2 id="backup-heading">Private file backups</h2></div><p className="cc-pad cc-muted">Backup status is unavailable. Refresh to check again.</p></section>
 const verified=backup.last_verified,latest=backup.latest_run,result=verified?.result
 const count=typeof result?.fileCount==='number'?result.fileCount:null,bytes=typeof result?.totalBytes==='number'?result.totalBytes:null
 const runId=String(result?.workflowRunId||'')
 const state=!backup.policy.enabled?'Automation disabled':backup.open_count?'Needs review':latest?.status==='running'?'Backup in progress':latest?.status==='failed'||latest?.status==='warning'?'Needs review':verified?'Last recovery verified':'Awaiting verified backup'
 return <section className="cc-panel cc-backup" aria-labelledby="backup-heading">
  <div className="cc-panel-heading"><h2 id="backup-heading">Private file backups</h2><span className={`cc-badge ${state==='Needs review'?'cc-warning':'cc-completed'}`}>{state}</span></div>
  <div className="cc-backup-summary">
   <div><span className="cc-eyebrow">Last verified recovery</span><strong>{date(verified?.finished_at)}</strong><small>{verified?'Saved copy downloaded, decrypted and restored; original file hashes matched.':'A completed recovery check has not been recorded.'}</small></div>
   <div><span className="cc-eyebrow">Files protected</span><strong>{count===null?'Not recorded':`${count.toLocaleString()} files`}</strong><small>{bytes===null?'':`${(bytes/1e9).toFixed(2)} GB of original files`}</small></div>
   <div><span className="cc-eyebrow">Open incidents</span><strong>{backup.open_count}</strong><small>{backup.open_count?'Review the open records below.':'No unresolved backup incidents recorded.'}</small></div>
  </div>
  <dl className="cc-backup-details">
   <div><dt>Daily target</dt><dd>01:17 Bangkok · 18:17 UTC<small>The scheduler can start late. Actual times appear below.</small></dd></div>
   <div><dt>Latest run</dt><dd>{latest?`${latest.status} · started ${date(latest.started_at)}`:'No run recorded'}<small>Finished: {date(latest?.finished_at)}</small></dd></div>
   <div><dt>Retention</dt><dd>{backup.policy.keep_daily} verified automatic copies + protected original<small>{backup.policy.prune_enabled?'Older automatic copies are removed after a verified replacement.':'Automatic deletion is disabled.'}</small></dd></div>
  </dl>
  {/^[0-9]+$/.test(runId)?<p className="cc-pad"><a href={`https://github.com/teeleebiz-web/aiconfidenceacademy-site/actions/runs/${runId}`} target="_blank" rel="noreferrer">View the verified backup run ↗</a></p>:null}
  <div className="cc-panel-heading"><h3>Backup incident history</h3><small>Latest 50 incidents · notification delivery shown separately</small></div>
  {backup.incidents.length?<div className="cc-table-scroll"><table className="cc-table"><caption className="cc-sr-only">Backup incidents and recovery notifications</caption><thead><tr>{['Incident','Problem status','Warning email','Recovery email'].map(x=><th key={x} scope="col">{x}</th>)}</tr></thead><tbody>{backup.incidents.map(incident=><tr key={incident.id}>
   <td><strong>{reasons[incident.reason]||'Backup incident'}</strong><small>{date(incident.occurred_at)}</small></td>
   <td><span className={`cc-badge ${incident.resolved_at?'cc-completed':'cc-warning'}`}>{incident.resolved_at?'Resolved':'Open'}</span>{incident.resolved_at?<small>Recovery verified {date(incident.resolved_at)}</small>:null}</td>
   <td>{delivery(incident.warning_delivery)}</td><td>{delivery(incident.recovery_delivery)}</td>
  </tr>)}</tbody></table></div>:<p className="cc-pad cc-muted">No backup incidents recorded.</p>}
  <p className="cc-pad cc-muted">Resolved incidents stay in this history. Recovery emails use the existing daily owner-alert monitor; they may arrive after the backup completes.</p>
 </section>
}
