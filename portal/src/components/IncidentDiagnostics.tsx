type Sample={code:number|null;ready:boolean;readiness:string|null;error:string|null}
type Report={id:string;role:'website'|'backend';source_at:string;observed_at:string;resolved_at:string|null;status:'open'|'recovered';diagnosis:string;provider_status:'up'|'down';repair_performed:false;samples:{website:Sample[];backend:Sample[]}}
export type IncidentStatus={available:boolean;policy:{enabled:boolean;activated_at:string|null}|null;coordinator:{checked_at:string;status:'completed'|'sync_pending';workflow_run_id:string}|null;reports:Report[]}
const findings:Record<string,string>={
 website_unavailable:'Public website unavailable in both confirmation checks.',
 backend_readiness_failed:'Backend database readiness failed in both checks. The underlying cause needs investigation.',
 backend_unavailable:'Backend unavailable in both confirmation checks.',
 both_unavailable:'Both addresses failed confirmation. A shared network, domain or provider issue is possible; the cause is unconfirmed.',
 monitor_disagreement:'Monitoring and current checks disagree. An intermittent issue or monitoring configuration needs review.',
 recovered:'StatusCake and two current checks confirm availability again.',
}
const date=(value?:string|null)=>value?new Date(value).toLocaleString(): 'No run recorded'

export function IncidentDiagnostics({diagnostics,now=Date.now()}:{diagnostics?:IncidentStatus;now?:number}){
 const enabled=diagnostics?.available&&diagnostics.policy?.enabled===true
 const coordinator=diagnostics?.coordinator
 const stale=enabled&&coordinator&&now-Date.parse(coordinator.checked_at)>60*60*1000
 const status=!diagnostics?.available?'Diagnosis status unavailable':!enabled?'Awaiting activation':!coordinator?'Awaiting first collection':stale?'Collector needs review':coordinator.status==='sync_pending'?'Evidence synchronization pending':'Last collection completed'
 return <section className="cc-panel" aria-labelledby="incident-diagnosis-heading">
  <div className="cc-panel-heading"><h2 id="incident-diagnosis-heading">Incident diagnosis</h2><span className="cc-badge">{status}</span></div>
  <div className="cc-pad">
   <p>Verified monitoring events receive two checks of each Academy address and a private diagnostic record. Findings describe the evidence; they do not establish a root cause.</p>
   <dl className="cc-key-values"><dt>Collection target</dt><dd>Every 15 minutes · scheduling may be delayed</dd><dt>Last collection</dt><dd>{date(coordinator?.checked_at)}</dd></dl>
   <p className="cc-muted">StatusCake continues its separate five-minute checks and owner alerts. During an Academy outage, this panel may be unavailable. The collector retains encrypted evidence outside Academy hosting and synchronizes it after the backend returns.</p>
   <p><strong>No automatic repair actions are enabled.</strong></p>
   {!diagnostics?.reports.length?<p className="cc-muted">No diagnostic incidents recorded in this view.</p>:<div className="cc-stack">{diagnostics.reports.map(report=><article key={report.id}>
    <h3>{report.role==='backend'?'Backend':'Public website'} · {report.status==='recovered'?'Recovery confirmed':'Needs review'}</h3>
    <p>{findings[report.diagnosis]||'Recorded evidence needs review.'}</p>
    <dl className="cc-key-values"><dt>Monitoring event</dt><dd>{date(report.source_at)}</dd><dt>Last confirmation</dt><dd>{date(report.observed_at)}</dd>{report.resolved_at?<><dt>Recovery confirmed</dt><dd>{date(report.resolved_at)}</dd></>:null}</dl>
    <details><summary>Confirmation evidence</summary><ul>{(['website','backend'] as const).map(role=><li key={role}>{role==='backend'?'Backend':'Public website'}: {report.samples[role].map(sample=>sample.error?'Request failed':`HTTP ${sample.code??'unknown'}${sample.readiness?` · readiness ${sample.readiness}`:''} · ${sample.ready?'passed':'failed'}`).join('; ')}</li>)}</ul><p className="cc-muted">No response bodies, credentials, learner records or repair instructions are stored in this report.</p></details>
   </article>)}</div>}
  </div>
 </section>
}
