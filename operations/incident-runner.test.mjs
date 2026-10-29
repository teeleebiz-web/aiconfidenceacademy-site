import test from 'node:test'
import assert from 'node:assert/strict'
import {runIncidentCoordinator} from './incident-runner.mjs'
import {targets} from './incident-diagnostics.mjs'
const env={GITHUB_REPOSITORY:'teeleebiz-web/aiconfidenceacademy-site',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_RUN_ID:'123',ACA_BACKUP_KEY_BASE64:Buffer.alloc(32,1).toString('base64'),ACA_R2_PRIVATE_CONFIRMED:'a'.repeat(32)+'/aca-private-backups',ACA_R2_ACCESS_KEY_ID:'fixture',ACA_R2_SECRET_ACCESS_KEY:'fixture',ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY:'fixture'}
test('storage verification is isolated from provider calls, production records and backup execution',async()=>{
 let verified;const result=await runIncidentCoordinator({env:{...env,ACA_INCIDENT_MODE:'verify-private-storage'},makeStore:()=>({verify:async id=>{verified=id}}),makeDb:()=>{throw Error('Unexpected database call')}});assert.deepEqual(result,{verification:true});assert.equal(verified,'123')
})
test('unreviewed repositories, refs and scheduled storage-verification inputs are rejected',async()=>{
 for(const change of [{GITHUB_REF:'refs/heads/other'},{GITHUB_REPOSITORY:'other/repo'},{GITHUB_RUN_ID:'invalid'},{ACA_INCIDENT_MODE:'verify-private-storage',GITHUB_EVENT_NAME:'schedule'}])await assert.rejects(()=>runIncidentCoordinator({env:{...env,...change},makeStore:()=>({verify:async()=>{throw Error('Unexpected action')}})}))
})
test('provider verification proves fixed identities and endpoints without activation, storage writes or reports',async()=>{
 let reads=0,checks=0
 const policy={enabled:false,monitors:{website:'1',backend:'2'},contact_group:'3'}
 const query={select(){return this},eq(){return this},async single(){return {data:policy}}}
 const result=await runIncidentCoordinator({env:{...env,ACA_INCIDENT_MODE:'verify-provider'},makeStore:()=>({}),makeDb:()=>({from(name){assert.equal(name,'aca_incident_settings');return query}}),makeReader:()=>async(id,resource)=>{reads++;return resource?{data:[]}:{data:{id,website_url:targets[id==='1'?'website':'backend'],test_type:'HTTP',status:'up',paused:false,check_rate:300,contact_groups:['3']}}},check:async role=>{assert.ok(role in targets);checks++;return {ready:true}}})
 assert.deepEqual(result,{providerVerification:true});assert.equal(reads,4);assert.equal(checks,2);assert.equal(policy.enabled,false)
 await assert.rejects(()=>runIncidentCoordinator({env:{...env,ACA_INCIDENT_MODE:'verify-provider',GITHUB_EVENT_NAME:'schedule'},makeStore:()=>({}),makeDb:()=>({})}),/controlled run/)
})
