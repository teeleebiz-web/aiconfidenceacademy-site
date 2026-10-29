export type AvailabilityConfiguration={configured:boolean;website:string;backend:string;dashboard_url:string|null;verified_at:string|null;interval_seconds:number|null}

export function ExternalAvailability({configuration}:{configuration?:AvailabilityConfiguration}) {
 const configured=configuration?.configured===true
 return <section className="cc-panel" aria-labelledby="outside-monitoring-heading">
  <div className="cc-panel-heading"><h2 id="outside-monitoring-heading">Independent outage monitoring</h2><span className={`cc-badge ${configured?'cc-completed':''}`}>{configured?'External checks configured':'Setup pending'}</span></div>
  <div className="cc-pad">
   <p>{configured?'The outside monitoring service checks the website and backend independently of Academy hosting and email.':'The backend readiness address is prepared. The outside monitoring account and alert delivery still need verification.'}</p>
   <dl className="cc-key-values"><dt>Public website</dt><dd>https://aiconfidenceacademy.org/</dd><dt>Backend readiness</dt><dd>https://checkout.aiconfidenceacademy.org/api/health</dd>
   {configured?<><dt>Configured check interval</dt><dd>{Math.round(configuration!.interval_seconds!/60)} minutes</dd><dt>Setup verified</dt><dd>{new Date(configuration!.verified_at!).toLocaleString()}</dd></>:null}</dl>
   {configured&&configuration?.dashboard_url?<p><a className="cc-button" href={configuration.dashboard_url} target="_blank" rel="noreferrer">Open independent incident history ↗</a></p>:null}
   <p className="cc-muted">Once configured, outage and recovery notices come directly from the outside service. Its private dashboard keeps incident and alert history available during an Academy outage. This panel records setup; open that dashboard for current availability.</p>
  </div>
 </section>
}
