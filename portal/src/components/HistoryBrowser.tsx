import {useEffect,useState} from 'react'

type HistoryRow=Record<string,unknown>
const title=(value:string)=>value.replaceAll('_',' ')
const display=(value:unknown)=>value===null?'Not recorded':typeof value==='object'?JSON.stringify(value,null,2):String(value)

export function HistoryBrowser({section,accessToken,endpoint,phase,scope,onClose,onDenied,onLearner}:{section:string;accessToken:string;endpoint:string;phase:number;scope:string;onClose:()=>void;onDenied:()=>void;onLearner:(id:string)=>void}) {
 const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[offset,setOffset]=useState(0),[rows,setRows]=useState<HistoryRow[]>([]),[total,setTotal]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState('')
 useEffect(()=>{const timer=setTimeout(()=>{setQuery(search);setOffset(0)},300);return()=>clearTimeout(timer)},[search])
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setRows([]);setError('')
  const params=new URLSearchParams({history:section,phase:String(phase),scope,search:query,offset:String(offset)})
  fetch(`${endpoint}?${params}`,{headers:{'X-ACA-Access-Token':accessToken},cache:'no-store',signal:controller.signal}).then(async res=>{const value=await res.json();if(!res.ok){if(res.status===401||res.status===403)onDenied();throw Error(value.error||'History is unavailable.')}return value}).then(value=>{if(!controller.signal.aborted){setRows(value.rows);setTotal(value.total)}}).catch(e=>{if(!controller.signal.aborted)setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
  return()=>controller.abort()
 },[accessToken,endpoint,section,phase,scope,query,offset])
 return <section className="cc-modal cc-history-browser" role="dialog" aria-modal="true" aria-labelledby="cc-history-title">
  <button className="cc-modal-close" aria-label="Close full history" onClick={onClose}>×</button>
  <p className="cc-eyebrow">SEARCHABLE ACADEMY RECORDS</p><h2 id="cc-history-title">Full {title(section)} history</h2>
  <p>The phase and collection filters apply here. Search across the complete history, then expand a record for its details.</p>
  <label className="cc-history-search">Search full history<input type="search" value={search} onChange={event=>setSearch(event.target.value)} maxLength={100}/></label>
  {error?<p role="alert" className="cc-alert">{error}</p>:null}
  {loading?<p role="status">Loading history…</p>:rows.length?rows.map((row,index)=><details className="cc-history-record" key={String(row.id||row.stripe_event_id||row.provider_refund_id||index)}><summary>{String(row.subject||row.allowed_email||row.customer_email||row.entity||row.category||row.id||'Record')}{row.status?` · ${title(String(row.status))}`:''}<small>{new Date(String(row.occurred_at||row.created_at||row.updated_at)).toLocaleString()}</small></summary><dl>{Object.entries(row).map(([key,value])=><div style={{display:'contents'}} key={key}><dt>{title(key)}</dt><dd>{display(value)}</dd></div>)}</dl>{typeof row.enrollment_id==='string'?<button className="cc-button" onClick={()=>onLearner(row.enrollment_id as string)}>Open learner record</button>:null}</details>):<p>No matching history records.</p>}
  <div className="cc-history-page"><button className="cc-button" disabled={loading||offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>Newer records</button><span>{total?`${offset+1}–${Math.min(offset+50,total)} of ${total}`:'0 records'}</span><button className="cc-button" disabled={loading||offset+50>=total} onClick={()=>setOffset(offset+50)}>Older records</button></div>
 </section>
}
