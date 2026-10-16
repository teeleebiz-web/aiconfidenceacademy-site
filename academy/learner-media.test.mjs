import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handleLearnerMedia } from './learner-media.mjs'

async function request({ token='learner', state={current_lesson_id:'lesson',access_status:'active',remaining_seconds:90}, lessonId='lesson', userError=false, enrollment=true, method='GET' }={}) {
 const signed=[]
 const db={auth:{getUser:async()=>({data:{user:{id:'learner'}},error:userError})},rpc:async()=>({data:[state]}),from:table=>{
  const q={select:()=>q,eq:()=>q,in:()=>q,maybeSingle:async()=>({data:table==='enrollments'?(enrollment?{id:'enrollment'}:null):{content:{video_path:'lesson/video.mp4',audio_path:'lesson/audio.mp3'}}})};return q
 },storage:{from:()=>({createSignedUrl:async(path,ttl)=>{signed.push({path,ttl});return{data:{signedUrl:`https://media.test/${path}`}}}})}}
 let status,body,headers
 await handleLearnerMedia({method,headers:{'x-aca-access-token':token}}, {writeHead:(s,h)=>{status=s;headers=h},end:data=>{body=JSON.parse(data)}}, {db,courseId:'course',lessonId})
 return {status,body,headers,signed}
}
test('lesson media requires a valid learner and enrollment',async()=>{
 for(const options of [{token:''},{userError:true},{enrollment:false}]){
  const result=await request(options);assert.ok([401,403].includes(result.status));assert.deepEqual(result.signed,[])
 }
})
test('expired, scheduled, completed, and other lessons cannot issue media links',async()=>{
 for(const access_status of ['expired','scheduled','completed','available']){
  const result=await request({state:{current_lesson_id:'lesson',access_status,remaining_seconds:90}});assert.equal(result.status,403);assert.deepEqual(result.signed,[])
 }
 assert.equal((await request({lessonId:'another-lesson'})).status,403)
 assert.equal((await request({state:{current_lesson_id:'lesson',access_status:'active',remaining_seconds:0}})).status,403)
})
test('signed recordings expire within the remaining lesson window',async()=>{
 const result=await request();assert.equal(result.status,200)
 assert.deepEqual(result.signed.map(i=>i.path),['lesson/video.mp4','lesson/audio.mp3'])
 assert.ok(result.signed.every(i=>i.ttl>0&&i.ttl<90))
 assert.equal(result.body.video,'https://media.test/lesson/video.mp4')
 assert.match(result.headers['Cache-Control'],/no-store/)
})
test('media does not accept writes',async()=>assert.equal((await request({method:'POST'})).status,405))
