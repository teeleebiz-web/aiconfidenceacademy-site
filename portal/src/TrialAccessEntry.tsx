import {useEffect,useRef,useState} from 'react'
import {supabase} from './lib/supabase'
import {academyBackendOrigin} from './lib/academyApi'

const enterTrial=(path:string)=>window.location.replace(path)

async function openTrial(code:string) {
  if (!/^ACA_[a-f0-9]{64}$/i.test(code)) throw Error('This trial invitation is incomplete. Please open the button in your invitation email.')
  const response=await fetch(`${academyBackendOrigin()}/api/trials/accept`,{
    method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({code}),
  })
  const invitation=await response.json()
  if (!response.ok) throw Error(invitation.error||'Your trial could not be opened. Please try your invitation again.')
  if (!invitation.token_hash || !['invite','magiclink'].includes(invitation.type) || ![1,2].includes(invitation.phase)) throw Error('Your trial could not be verified. Please try your invitation again.')
  const {data,error}=await supabase.auth.verifyOtp({token_hash:invitation.token_hash,type:invitation.type})
  if (error || !data.session || data.session.user.id!==invitation.learner_id) throw Error('Your trial could not be opened. Please open your invitation again.')
  return invitation.phase===2?'/learn/?course=phase-two':'/learn/'
}

export function TrialAccessEntry({onEnter=enterTrial}:{onEnter?:(path:string)=>void}) {
  const [code]=useState(()=>new URLSearchParams(window.location.hash.slice(1)).get('invite')||'')
  const [error,setError]=useState('')
  const attempt=useRef<Promise<string>|null>(null)
  useEffect(()=>{
    let active=true
    document.title='Your Academy trial | AI Confidence Academy'
    window.history.replaceState(null,'',window.location.pathname+window.location.search)
    // React StrictMode must not consume the one-time Auth verification twice.
    attempt.current ||= openTrial(code)
    attempt.current.then(path=>{if(active)onEnter(path)}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Your trial could not be opened. Please try your invitation again.')})
    return()=>{active=false}
  },[code,onEnter])
  return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">AI Confidence Academy · Trial access</p><h1>{error?'Your trial invitation':'Opening your trial…'}</h1>{error?<p className="global-error" role="alert">{error}</p>:<p role="status">Preparing your Academy welcome.</p>}</section></main>
}
