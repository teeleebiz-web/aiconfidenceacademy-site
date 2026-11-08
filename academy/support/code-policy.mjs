import {createHash} from 'node:crypto'

export const codeModel='gpt-6-luna'
export const codeReservationCents=25
export const codeSources=Object.freeze({
 sign_in:['portal/src/components/SignIn.tsx','portal/src/lib/supabase.ts'],
 saved_work:['academy/workbook/store.ts','academy/workbook/Workbook.tsx'],
 study_timer:['portal/src/lib/lessonStudy.ts','portal/src/components/LessonStudySession.tsx'],
 navigation:['portal/src/lib/usePageStart.ts','portal/src/components/AcademyShell.tsx'],
 support:['academy/support/api.mjs','portal/src/components/SupportInbox.tsx'],
})
export const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const validId=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)
export const validSha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value)

// The provider and public draft receive fixed symptom labels, never the case
// text, name, email, private link, identifiers, logs, or account records.
export function technicalSymptoms(category,text){
 if(!['technical','sign-in'].includes(category)||typeof text!=='string')return null
 const value=text.toLowerCase().slice(0,16000)
 if(/\b(refund|charged|billing|credit card|delete my|privacy|breach|hacked)\b/.test(value))return null
 const kind=category==='sign-in'?'sign_in':/\b(save|saved|workbook|draft|answer)\b/.test(value)?'saved_work':/\b(timer|pause|resume|minutes|inactivity)\b/.test(value)?'study_timer':/\b(tab|navigation|scroll|back button|heading)\b/.test(value)?'navigation':/\b(support|case|contact form)\b/.test(value)?'support':null
 if(!kind)return null
 const symptoms=[]
 for(const [label,re] of [['lost_work',/lost|disappear|missing|did not save/],['error',/error|fail|broken|doesn.t work/],['reload',/reload|refresh|reopen/],['stuck',/stuck|loop|cannot|can.t/],['away',/away|inactive|pause/]])if(re.test(value))symptoms.push(label)
 return symptoms.length?{kind,symptoms}:null
}

export function validateProposal(value,sources,kind){
 if(!value||Object.keys(value).sort().join(',')!=='edits,outcome,test'||!['candidate','no_change'].includes(value.outcome)||!Array.isArray(value.edits)||!value.test||Object.keys(value.test).sort().join(',')!=='content,path')throw Error('Invalid coding proposal')
 if(value.outcome==='no_change'){
  if(value.edits.length||value.test.path!==''||value.test.content!=='')throw Error('Invalid empty proposal')
  return value
 }
 if(value.edits.length<1||value.edits.length>3||Buffer.byteLength(JSON.stringify(value))>50000)throw Error('Unbounded coding proposal')
 const allowed=codeSources[kind]||[],seen=new Set()
 for(const edit of value.edits){
  if(!edit||Object.keys(edit).sort().join(',')!=='after,before,path'||!allowed.includes(edit.path)||seen.has(edit.path)||typeof sources[edit.path]!=='string'||typeof edit.before!=='string'||!edit.before||typeof edit.after!=='string'||edit.before===edit.after||Buffer.byteLength(edit.after)>16000||sources[edit.path].split(edit.before).length!==2)throw Error('Unapproved or ambiguous edit')
  seen.add(edit.path)
 }
 const path='portal/src/agent-regression.test.tsx'
 if(value.test.path!==path||typeof value.test.content!=='string'||value.test.content.length<30||Buffer.byteLength(value.test.content)>16000)throw Error('Invalid regression test')
 return value
}

export function proposalSchema(kind){
 return {type:'object',properties:{outcome:{type:'string',enum:['candidate','no_change']},edits:{type:'array',maxItems:3,items:{type:'object',properties:{path:{type:'string',enum:codeSources[kind]},before:{type:'string'},after:{type:'string'}},required:['path','before','after'],additionalProperties:false}},test:{type:'object',properties:{path:{type:'string',enum:['','portal/src/agent-regression.test.tsx']},content:{type:'string'}},required:['path','content'],additionalProperties:false}},required:['outcome','edits','test'],additionalProperties:false}
}
