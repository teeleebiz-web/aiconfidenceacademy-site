import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {incidentPrefix,seal,unseal,incidentStore,incidentConfiguration} from './incident-store.mjs'
const key=randomBytes(32),path=incidentPrefix+'state.bin'
test('private evidence encryption authenticates the record, key and exact path and refuses all backup paths',()=>{
 const data={diagnosis:'private test'},bytes=seal(data,key,path);assert.deepEqual(unseal(bytes,key,path),data);assert.equal(bytes.includes(Buffer.from('private test')),false)
 assert.throws(()=>unseal(bytes,randomBytes(32),path));const changed=Buffer.from(bytes);changed[20]^=1;assert.throws(()=>unseal(changed,key,path))
 assert.throws(()=>unseal(bytes,key,incidentPrefix+'verification/1.bin'));assert.throws(()=>seal(data,key,'aca-backups/original/snapshot.json'))
 assert.throws(()=>seal({large:'x'.repeat(1100000)},key,path))
})
test('R2 adapter uses only Get/Put in the fixed incident namespace and proves readback',async()=>{
 const objects=new Map(),calls=[];const client={async send(command){calls.push(command);const {Key,Body}=command.input;if(Body){objects.set(Key,Buffer.from(Body));return {}}if(!objects.has(Key))throw Object.assign(Error(),{name:'NoSuchKey'});return {Body:[objects.get(Key)]}}}
 const store=incidentStore({key,r2:{bucket:'aca-private-backups'}},client);assert.equal(await store.load(),null);await store.save({version:1});assert.deepEqual(await store.load(),{version:1});await store.verify('123')
 assert.ok(calls.every(c=>['GetObjectCommand','PutObjectCommand'].includes(c.constructor.name)));assert.ok(calls.every(c=>c.input.Key.startsWith(incidentPrefix)));assert.ok(calls.filter(c=>c.constructor.name==='PutObjectCommand').every(c=>c.input.CacheControl==='private, no-store'))
})
test('failed or altered readback is not accepted as durable evidence',async()=>{
 const store=incidentStore({key,r2:{bucket:'aca-private-backups'}},{async send(c){return c.input.Body?{}:{Body:[Buffer.from('invalid')]}}});await assert.rejects(()=>store.save({version:1}),/invalid/)
})
test('incident key derivation keeps private diagnostic keys separate from the backup master and validates the existing destination',()=>{
 const master=randomBytes(32),env={ACA_BACKUP_KEY_BASE64:master.toString('base64'),ACA_R2_PRIVATE_CONFIRMED:'a'.repeat(32)+'/aca-private-backups',ACA_R2_ACCESS_KEY_ID:'fixture',ACA_R2_SECRET_ACCESS_KEY:'fixture'}
 const config=incidentConfiguration(env);assert.notDeepEqual(config.key,master);assert.equal(config.r2.bucket,'aca-private-backups');assert.throws(()=>incidentConfiguration({...env,ACA_R2_PRIVATE_CONFIRMED:'a'.repeat(32)+'/other'}));assert.throws(()=>incidentConfiguration({...env,ACA_BACKUP_KEY_BASE64:'bad'}))
})
