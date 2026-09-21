import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleRecord, type RecordDeps } from "./handler.ts";
const slug="htc-0123456789abcdef01234567",replayId="12345678-1234-1234-1234-123456789abc";
const caller={user:{id:"host",email:"legacy@htu.edu"},role:{admin:true,judge:false,facilitator_sessions:[]},academyAdmin:true,functionsBase:"https://example.test/functions/v1"};
function fixture(over: Partial<RecordDeps>={}){
 const calls:string[]=[],saved:unknown[]=[];
 const store={latestActive:async()=>null,latestAny:async()=>null,insertReplay:async(row:unknown)=>{saved.push(row);},updateReplayStatus:async()=>{}};
 const deps:RecordDeps={...store,classroomAccess:async()=>({managed:true,can_join:true,is_host:true,room_id:"managed-room"}),getRoom:async()=>({id:"managed-room",meeting_id:"managed-meeting",host_emails:[caller.user.email]}),getSession:async()=>null,cf:async(method,path)=>{calls.push(method+" "+path);return {ok:true,status:200,data:{id:"recording",kicked_participants_count:1}};},uploadedEvent:async()=>({event:"uploaded"}),reprocess:async()=>{calls.push("reprocessed");return {status:"ready"};},roomMeetingIds:async()=>new Set(),room:{...store,replayById:async()=>({id:replayId,room_id:"managed-room",meeting_id:"old-meeting",recording_id:"old-recording",status:"error"})},...over};return {deps,calls,saved};
}
Deno.test("managed recording rejects all operations by roster guests despite legacy admin/email roles",async()=>{
 for(const action of ["start","stop","end","retry_replay"] as const){const f=fixture({classroomAccess:async()=>({managed:true,can_join:true,is_host:false,room_id:"managed-room"})});assertEquals((await handleRecord({room:slug,action,replay_id:replayId},caller,f.deps)).status,403);assertEquals(f.calls,[]);}
});
Deno.test("managed recording fails closed on bridge absence, failure, malformed data and room mismatch",async()=>{
 for(const classroomAccess of [undefined,async()=>{throw Error("missing RPC");},async()=>null,async()=>({managed:false,can_join:true,is_host:true,room_id:"managed-room"}),async()=>({managed:true,can_join:false,is_host:true,room_id:"managed-room"}),async()=>({managed:true,can_join:true,is_host:true,room_id:"other"})]){
  const f=fixture({classroomAccess});const result=await handleRecord({room:slug,action:"start"},caller,f.deps);assertEquals([403,503].includes(result.status),true);assertEquals(f.calls,[]);
 }
});
Deno.test("assigned instructor records only the managed room and can retry its own replay",async()=>{
 const f=fixture();const instructor={...caller,academyAdmin:false,role:{admin:false,judge:false,facilitator_sessions:[]}};
 assertEquals((await handleRecord({room:slug,action:"start"},instructor,f.deps)).status,200);
 assertEquals(f.saved,[{room_id:"managed-room",meeting_id:"managed-meeting",recording_id:"recording",status:"invoked"}]);
 assertEquals((await handleRecord({room:slug,action:"retry_replay",replay_id:replayId},instructor,f.deps)).status,200);
});
Deno.test("a legacy room request cannot smuggle a managed replay through the Academy admin shortcut",async()=>{
 const f=fixture({getRoom:async()=>({id:"legacy-room",meeting_id:"legacy-meeting",host_emails:[]})});
 assertEquals((await handleRecord({room:"academy",action:"retry_replay",replay_id:replayId},caller,f.deps)).status,403);assertEquals(f.calls,[]);
});
Deno.test("a managed host cannot retry another session's replay",async()=>{
 const f=fixture();f.deps.room.replayById=async()=>({id:replayId,room_id:"different-session",meeting_id:"other-meeting",recording_id:"other",status:"error"});
 assertEquals((await handleRecord({room:slug,action:"retry_replay",replay_id:replayId},caller,f.deps)).status,403);assertEquals(f.calls,[]);
});
Deno.test("OPIL cannot record, end, or retry a meeting when room isolation lookup fails",async()=>{
 for(const action of ["start","stop","end","retry_replay"] as const){
  const lookedUp:string[]=[];
  const f=fixture({getSession:async()=>({no:7,title:"OPIL",stream_url:"rtk:managed-meeting",is_live:true}),roomMeetingIds:async id=>{lookedUp.push(id);throw Error("database unavailable");}});
  assertEquals((await handleRecord({session_no:7,action},caller,f.deps)).status,503);
  assertEquals(f.calls,[]);assertEquals(f.saved,[]);assertEquals(lookedUp,["managed-meeting"]);
 }
});
