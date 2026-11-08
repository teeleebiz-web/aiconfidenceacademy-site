export type Investigation={case_id:string;status:string;generation:number;completed_at:string|null;attempts:number;report:{diagnosis:string;observed_at:string;repair_performed:false;user_flow_verified:false}|null}
const diagnoses:Record<string,string>={
 no_shared_outage:'Both service addresses passed two checks. The reported user action still needs investigation.',
 both_unavailable:'Both service addresses failed two checks. The cause is not yet confirmed.',
 intermittent:'The two check rounds disagreed. An intermittent problem needs further investigation.',
 website_unavailable:'The public website failed two checks while backend readiness passed.',
 backend_readiness_failed:'The backend reported a database readiness failure in both checks.',
 backend_unavailable:'The backend failed both checks while the public website passed.',
}
export function SupportInvestigation({value,unavailable}:{value?:Investigation;unavailable?:boolean}){
 if(unavailable)return <p role="status">Investigation records could not load. The support case remains available.</p>
 if(!value)return null
 const status:Record<string,string>={queued:'Waiting for diagnostic collection',running:'Diagnostic collection in progress',investigated:'Initial diagnostic evidence recorded',needs_review:'Diagnostic collection reached its retry limit'}
 return <section aria-label="Technical investigation" className="cc-message"><h4>Technical investigation</h4><p>{status[value.status]||'Investigation status unavailable'}</p>{value.report?<><p>{diagnoses[value.report.diagnosis]||'The recorded evidence needs review.'}</p><small>Observed: {new Date(value.report.observed_at).toLocaleString()}</small></>:null}<p>No repair or verification of the reported user action is recorded by this diagnostic step. These checks do not establish resolution of the case.</p></section>
}

export type CodingResult={case_id:string;generation:number;status:string;pull_request_number:number|null;completed_at:string|null}
export function SupportCoding({value,unavailable}:{value?:CodingResult;unavailable?:boolean}){
 if(unavailable)return <p role="status">Coding status could not load. The support case remains available.</p>
 if(!value)return null
 const statuses:Record<string,string>={running:'Preparing and testing a possible repair',no_change:'No supported code repair identified',test_failed:'Proposed repair did not pass verification',failed:'Coding work stopped safely',draft_ready:'Tested repair draft prepared',branch_ready:'Tested repair branch prepared; draft opening is pending'}
 const number=value.pull_request_number
 return <section aria-label="Coding investigation" className="cc-message"><h4>Coding investigation</h4><p>{statuses[value.status]||'Coding status unavailable'}</p>{value.status==='draft_ready'&&typeof number==='number'&&Number.isSafeInteger(number)&&number>0?<p><a href={'https://github.com/teeleebiz-web/aiconfidenceacademy-site/pull/'+number} target="_blank" rel="noreferrer">View repair draft</a></p>:null}<p>This step does not change the live academy or establish recovery of the reported problem.</p></section>
}
