import test from 'node:test'
import assert from 'node:assert/strict'
import {incidentStatus} from './incident-status.mjs'
test('diagnostic snapshot reads only the private service RPC',async()=>{
 let method;const data={available:true,policy:{enabled:false},coordinator:null,reports:[]}
 assert.equal(await incidentStatus({rpc:async name=>{method=name;return {data}}}),data);assert.equal(method,'aca_incident_snapshot')
})
test('unavailable diagnostics cannot prevent the existing owner snapshot from loading',async()=>{
 for(const rpc of [async()=>{throw Error('offline')},async()=>({error:{message:'not deployed'}}),async()=>({data:{}})])assert.deepEqual(await incidentStatus({rpc}),{available:false,policy:null,coordinator:null,reports:[]})
})
