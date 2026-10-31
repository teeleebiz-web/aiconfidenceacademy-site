import {answers,findAnswers} from './support-knowledge.js?v=20261031-cancellation'
const endpoint='https://checkout.aiconfidenceacademy.org/api/support/cases'
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n}
const list=document.getElementById('help-results'),question=document.getElementById('help-question')
function show(items){if(!list)return;list.replaceChildren();for(const a of items){const item=el('details'),summary=el('summary',a.title),p=el('p',a.answer),link=el('a','Read more →');link.href=a.url;item.append(summary,p,link);list.append(item)}if(!items.length)list.append(el('p','No approved answer matched that question. Use the support form below so the issue can be checked.'))}
if(list){show(answers);question?.addEventListener('input',()=>show(question.value.trim()?findAnswers(question.value):answers));document.getElementById('help-search')?.addEventListener('submit',e=>{e.preventDefault();show(findAnswers(question.value))})}
const form=document.getElementById('support-form'),status=document.getElementById('support-status'),casePanel=document.getElementById('support-case')
const key=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('')
let requestId=crypto.randomUUID(),caseKey=key(),active=null
function notice(text,error=false){status.textContent=text;status.setAttribute('role',error?'alert':'status');status.focus()}
async function call(url,options={}){const r=await fetch(url,{cache:'no-store',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});const b=await r.json();if(!r.ok)throw Error(b.error||'Support could not be reached. Keep your message and try again.');return b}
function linkFor(id,secret){const u=new URL('/contact/',location.origin);u.hash=new URLSearchParams({case:id,key:secret});return u.href}
async function loadCase(){if(!active||!casePanel)return;const data=await call(endpoint+'/'+active.id,{headers:{'X-ACA-Support-Key':active.key}});casePanel.hidden=false;casePanel.replaceChildren();casePanel.append(el('h2','Your support case'),el('p',data.case.subject),el('p','Reference '+data.case.id.slice(0,8)+' · '+data.case.status));for(const m of data.messages){const box=el('section');box.className='support-message';box.append(el('strong',m.author==='academy'?'ACA support':'Your message'),el('p',m.body),el('small',new Date(m.created_at).toLocaleString()));casePanel.append(box)}const follow=el('form'),label=el('label','Add information'),input=el('textarea'),button=el('button','Send follow-up'),refresh=el('button','Refresh replies');input.required=true;input.minLength=5;input.maxLength=4000;label.append(input);button.className='button button-gold';refresh.type='button';refresh.className='button';refresh.onclick=()=>loadCase().catch(e=>notice(e.message,true));follow.append(label,button,refresh);let followId=crypto.randomUUID();follow.onsubmit=async e=>{e.preventDefault();button.disabled=true;try{await call(endpoint+'/'+active.id+'/messages',{method:'POST',headers:{'X-ACA-Support-Key':active.key},body:JSON.stringify({requestId:followId,message:input.value})});followId=crypto.randomUUID();await loadCase();notice('Your follow-up is saved.')}catch(e){notice(e.message,true)}finally{button.disabled=false}};casePanel.append(follow)}
if(form){form.addEventListener('submit',async e=>{e.preventDefault();if(!form.reportValidity())return;const v=Object.fromEntries(new FormData(form));v.consent=v.consent==='yes';v.requestId=requestId;v.key=caseKey;const button=form.querySelector('button[type=submit]');button.disabled=true;try{const result=await call(endpoint,{method:'POST',body:JSON.stringify(v)});active={id:result.id,key:caseKey};notice('Your request is saved. Reference '+result.id.slice(0,8)+(result.emailSent?'. A confirmation has been sent.':'. Save your private case link below; email confirmation was not delivered.'));const a=el('a','Open or copy your private case link');a.href=linkFor(result.id,caseKey);status.append(el('br'),a,el('p','Keep this link private. It gives access to this case.'));form.reset();requestId=crypto.randomUUID();caseKey=key();await loadCase()}catch(e){notice(e.message,true)}finally{button.disabled=false}})}
function openPrivateCaseLink(){const fragment=new URLSearchParams(location.hash.slice(1));if(fragment.has('case')&&fragment.has('key')){active={id:fragment.get('case'),key:fragment.get('key')};history.replaceState(null,'',location.pathname+location.search);loadCase().catch(e=>notice(e.message,true))}}
openPrivateCaseLink();window.addEventListener('hashchange',openPrivateCaseLink)

// A withdrawal notice uses the existing private case store, not a payment action.
const withdrawalForm=document.getElementById('withdrawal-form')
if(withdrawalForm){
 const review=document.getElementById('withdrawal-review'),receiptPanel=document.getElementById('withdrawal-status')
 const confirm=document.getElementById('withdrawal-confirm'),edit=document.getElementById('withdrawal-edit')
 const start=document.getElementById('withdrawal-review-button')
 let pending=null,receiptUrl=null
 start.disabled=false
 const withdrawalNotice=(text,error=false)=>{receiptPanel.replaceChildren(el('p',text));receiptPanel.setAttribute('role',error?'alert':'status');receiptPanel.focus()}
 withdrawalForm.addEventListener('submit',e=>{
  e.preventDefault()
  if(!withdrawalForm.reportValidity())return
  const values=Object.fromEntries(new FormData(withdrawalForm))
  pending={name:values.name.trim(),email:values.email.trim().toLowerCase(),contract:values.contract.trim(),website:values.website,requestId:crypto.randomUUID(),key:key()}
  if(!pending.name||pending.contract.length<5){withdrawalNotice('Enter your name and enough details to identify the enrollment.',true);return}
  document.getElementById('withdrawal-statement').textContent=`I hereby give notice that I withdraw from my ACA enrollment contract identified below.\nName: ${pending.name}\nContract or part withdrawn: ${pending.contract}\nConfirmation email: ${pending.email}`
  withdrawalForm.hidden=true;review.hidden=false;receiptPanel.replaceChildren();review.focus()
 })
 edit.addEventListener('click',()=>{review.hidden=true;withdrawalForm.hidden=false;withdrawalForm.querySelector('input[name=name]').focus();pending=null})
 async function submitWithdrawal(){
  if(!pending)return
  confirm.disabled=true;edit.disabled=true
  try{
   const result=await call(endpoint.replace('/cases','/withdrawals'),{method:'POST',body:JSON.stringify(pending)})
   review.hidden=true
   withdrawalNotice(`Your withdrawal notice is received. Reference ${result.id.slice(0,8)}. Received (UTC): ${result.receipt.receivedAt}. ${result.emailSent?'An acknowledgment has been submitted for email delivery.':'Email confirmation could not be submitted. Save your acknowledgment below; your notice is still recorded.'}`)
   const statement=el('pre',result.receipt.text),download=el('a','Save withdrawal acknowledgment (.txt)'),privateCase=el('a','Open your private withdrawal case')
   if(receiptUrl)URL.revokeObjectURL(receiptUrl)
   receiptUrl=URL.createObjectURL(new Blob([result.receipt.text],{type:'text/plain;charset=utf-8'}))
   download.href=receiptUrl;download.download=`ACA_withdrawal_${result.id.slice(0,8)}.txt`;download.className='button button-gold'
   privateCase.href=linkFor(result.id,pending.key);privateCase.className='button'
   receiptPanel.append(statement,download,privateCase,el('p','Keep your acknowledgment and private link. The link gives access to this case. Receipt is not confirmation that a refund has already been processed.'))
   if(!result.emailSent){const retry=el('button','Retry acknowledgment email');retry.type='button';retry.className='button';retry.onclick=()=>{retry.disabled=true;submitWithdrawal()};receiptPanel.append(retry)}
  }catch(error){withdrawalNotice(error.message,true)}finally{confirm.disabled=false;edit.disabled=false}
 }
 confirm.addEventListener('click',submitWithdrawal)
 if(location.hash==='#withdrawal')requestAnimationFrame(()=>document.getElementById('withdrawal').scrollIntoView())
}
