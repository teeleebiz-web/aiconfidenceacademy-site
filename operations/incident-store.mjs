import {createCipheriv,createDecipheriv,hkdfSync,randomBytes} from 'node:crypto'
import {S3Client,GetObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3'
import {r2Configuration} from './r2-transfer.mjs'
import {digest} from './incident-diagnostics.mjs'

export const incidentPrefix='aca-incidents/v1/'
const maxBytes=1024*1024
const allowed=key=>key===incidentPrefix+'state.bin'||new RegExp(`^${incidentPrefix}(?:reports/[a-f0-9]{64}/[a-f0-9]{64}|verification/[0-9]+)\\.bin$`).test(key)
export function incidentConfiguration(env){
  const encoded=env.ACA_BACKUP_KEY_BASE64||''
  const master=Buffer.from(encoded,'base64')
  if(master.length!==32||master.toString('base64')!==encoded||!/^[a-f0-9]{32}\/aca-private-backups$/.test(env.ACA_R2_PRIVATE_CONFIRMED||''))throw new Error('Private incident storage configuration is invalid')
  const key=Buffer.from(hkdfSync('sha256',master,Buffer.from('aca-incidents-v1'),Buffer.from('diagnostic-records'),32));master.fill(0)
  const account=env.ACA_R2_PRIVATE_CONFIRMED.split('/')[0]
  return {key,r2:r2Configuration({...env,ACA_R2_ACCOUNT_ID:account,ACA_R2_BUCKET:'aca-private-backups'})}
}
export function seal(value,key,path){
  if(!allowed(path))throw new Error('Incident storage path is not allowed')
  const plain=Buffer.from(JSON.stringify(value));if(plain.length>maxBytes)throw new Error('Incident state is too large')
  const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(Buffer.from(path))
  return Buffer.concat([Buffer.from('ACAI1'),nonce,cipher.update(plain),cipher.final(),cipher.getAuthTag()])
}
export function unseal(bytes,key,path){
  if(!allowed(path)||bytes.length>maxBytes+64||bytes.length<33||bytes.subarray(0,5).toString()!=='ACAI1')throw new Error('Private incident record is invalid')
  const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(5,17));decipher.setAAD(Buffer.from(path));decipher.setAuthTag(bytes.subarray(-16))
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(17,-16)),decipher.final()]).toString('utf8'))
}
export function incidentStore({key,r2},client=new S3Client({region:'auto',endpoint:r2.endpoint,credentials:r2.credentials,maxAttempts:1,requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'})){
  async function get(path){
    if(!allowed(path))throw new Error('Incident storage path is not allowed')
    let response;try{response=await client.send(new GetObjectCommand({Bucket:r2.bucket,Key:path}))}catch(error){if(error.name==='NoSuchKey'||error.$metadata?.httpStatusCode===404)return null;throw new Error('Private incident record could not be read')}
    if(!response.Body)throw new Error('Private incident record is empty')
    const chunks=[];let size=0;for await(const chunk of response.Body){size+=chunk.length;if(size>maxBytes+64)throw new Error('Private incident record is too large');chunks.push(chunk)}
    return unseal(Buffer.concat(chunks),key,path)
  }
  async function put(path,value,immutable=false){
    const body=seal(value,key,path)
    try{await client.send(new PutObjectCommand({Bucket:r2.bucket,Key:path,Body:body,ContentLength:body.length,ContentType:'application/octet-stream',CacheControl:'private, no-store',...(immutable?{IfNoneMatch:'*'}:{})}))}
    catch(error){if(!immutable||error.$metadata?.httpStatusCode!==412)throw new Error('Private incident record could not be saved')}
    const saved=await get(path)
    if(JSON.stringify(saved)!==JSON.stringify(value))throw new Error('Private incident readback did not match')
  }
  return {load:()=>get(incidentPrefix+'state.bin'),save:value=>put(incidentPrefix+'state.bin',value),evidence:report=>put(`${incidentPrefix}reports/${report.id}/${digest(JSON.stringify(report))}.bin`,report,true),
    async verify(runId){if(!/^\d+$/.test(runId))throw new Error('Invalid verification run');const value={verification:true,repair_performed:false,run:runId};await put(`${incidentPrefix}verification/${runId}.bin`,value,true);return true}}
}
