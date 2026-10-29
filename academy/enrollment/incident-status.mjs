export async function incidentStatus(db){
 try{const result=await db.rpc('aca_incident_snapshot');if(result.error||result.data?.available!==true)throw new Error();return result.data}
 catch{return {available:false,policy:null,coordinator:null,reports:[]}}
}
