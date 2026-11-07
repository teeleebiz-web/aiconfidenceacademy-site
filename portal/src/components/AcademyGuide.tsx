import {useEffect,useRef,useState} from 'react'
import {findGuidance,type Guidance} from '../../../academy/support/knowledge.mjs'
import {academyBackendOrigin} from '../lib/academyApi'

export function AcademyGuide({accessToken,page=false}:{accessToken:string;page?:boolean}) {
 const [question,setQuestion]=useState(''),[topic,setTopic]=useState('all'),[results,setResults]=useState<Guidance[]|null>(null),[enabled,setEnabled]=useState(false),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const pending=useRef<AbortController|null>(null)
 useEffect(()=>{const controller=new AbortController();setEnabled(false);setConsent(false);setQuestion('');setResults(null);setNotice('');setBusy(false)
  void fetch(`${academyBackendOrigin()}/api/support/assist`,{headers:{'X-ACA-Access-Token':accessToken},cache:'no-store',signal:controller.signal}).then(r=>r.ok?r.json():null).then(v=>{if(!controller.signal.aborted)setEnabled(v?.enabled===true)}).catch(()=>{})
  return()=>{controller.abort();pending.current?.abort();pending.current=null}
 },[accessToken])
 async function submit(event:React.FormEvent){event.preventDefault();pending.current?.abort();const controller=new AbortController();pending.current=controller;setNotice('');setResults(findGuidance(question,topic))
  if(!enabled||!consent)return
  setBusy(true)
  const timer=setTimeout(()=>controller.abort(),18000)
  try{const response=await fetch(`${academyBackendOrigin()}/api/support/assist`,{method:'POST',headers:{'Content-Type':'application/json','X-ACA-Access-Token':accessToken},cache:'no-store',signal:controller.signal,body:JSON.stringify({question,topic,consent:true})});const body=await response.json();if(!response.ok)throw Error();if(!controller.signal.aborted){setResults(body.answers);setNotice(body.mode==='assisted'?'Matched with AI; wording comes from the Academy source.':'AI matching is unavailable. Showing the Academy’s standard guidance.')}}
  catch{if(pending.current===controller&&!controller.signal.aborted)setNotice('AI matching is unavailable. Showing the Academy’s standard guidance.');else if(pending.current===controller)setNotice('AI matching timed out. Showing the Academy’s standard guidance.')}
  finally{clearTimeout(timer);if(pending.current===controller)setBusy(false)}
 }
 return <section className="aca-guide" aria-labelledby="aca-guide-heading">{page?<h1 id="aca-guide-heading">Ask ACA</h1>:<h3 id="aca-guide-heading">Ask ACA</h3>}<p>Find Academy answers, a small practice suggestion, or a resource to explore. Check that the suggested guidance fits your question.</p>
 <form onSubmit={submit}><label>What would help?<select value={topic} onChange={e=>setTopic(e.target.value)}><option value="all">All guidance</option><option value="learning">Learning and practice</option><option value="support">Academy support</option></select></label><label>Your question<textarea required maxLength={600} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="For example: How can I check an AI answer? Leave out private information."/></label>
 {enabled?<label className="aca-guide-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Use AI to match my question. This sends the question to OpenAI. Account records and workbook answers are not included.</label>:null}<button disabled={busy}>{busy?'Finding guidance…':'Find guidance'}</button></form>
 <div aria-live="polite">{notice?<p>{notice}</p>:null}{results?results.length?results.map(item=><article key={item.id}><h4>{item.title}</h4><p>{item.answer}</p><a href={item.url} target="_blank" rel="noreferrer">Read the Academy source ↗</a></article>):<p>No matching Academy answer was found. Try a more specific question, browse the resources, or open a support case.</p>:null}</div>
 <p className="aca-guide-links"><a href="/library/ai-updates/" target="_blank" rel="noreferrer">AI Updates & Guidance ↗</a><br/><a href="/contact/#request" target="_blank" rel="noreferrer">Open a support case ↗</a></p><p>Account, billing, privacy, and access exceptions need authorized review. This guide does not change your records or start a lesson.</p>
 </section>
}
