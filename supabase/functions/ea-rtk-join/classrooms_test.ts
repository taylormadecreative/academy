import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleJoin, type JoinDeps, type RoomRow } from "./handler.ts";
const slug="htc-0123456789abcdef01234567";
const caller={user:{id:"student",email:"legacy@htu.edu"},role:{admin:true,judge:true,facilitator_sessions:[]},academyAdmin:true,ip:"127.0.0.1"};
const now=new Date("2026-09-21T18:00:00Z");
function fixture(over: Partial<JoinDeps>={}) {
 const calls: string[]=[];
 const room:RoomRow={id:"managed-room",slug,title:"Responsible AI",host_name:"Instructor",host_emails:[caller.user.email],host_preset:"ht-class-host",guest_preset:"ht-class-guest",link_key:"AbC123_-xyzXYZ0987ab-_",is_live:true,live_since:now.toISOString(),meeting_id:"class-meeting",max_participants:50,open_door:true};
 const deps:JoinDeps={cf:async(method,path)=>{calls.push(method+" "+path);return {ok:true,status:200,data:{id:"new-meeting",token:"managed-token",live_participants:1}};},classroomAccess:async()=>({managed:true,can_join:true,is_host:false,room_id:room.id}),claimClassroomMeeting:async(_room,id)=>id,rateCheck:async()=>true,getRoom:async()=>room,getSession:async()=>null,inCohort:async()=>true,isMember:async()=>true,setRoomMeeting:async()=>{},roomMeetingIds:async()=>new Set(),upsertMember:async()=>{},displayName:async()=>"Demo learner",ensurePresets:async()=>{},ensureOpilPresets:async()=>{},now:()=>now,...over};
 return {deps,calls,room};
}
Deno.test("managed join uses roster access even when every legacy host bypass is present",async()=>{
 const {deps,calls}=fixture();const result=await handleJoin({room:slug,key:"AbC123_-xyzXYZ0987ab-_"},caller,deps);
 assertEquals(result.status,200);assertEquals((result.body as {host:boolean}).host,false);assertEquals((result.body as {preset:string}).preset,"ht-class-guest");assertEquals(calls.includes("POST /meetings"),false);
});
Deno.test("managed assigned instructor hosts without Academy privileges",async()=>{
 const f=fixture({classroomAccess:async()=>({managed:true,can_join:true,is_host:true,room_id:"managed-room"})});f.room.is_live=false;
 const result=await handleJoin({room:slug}, {...caller,academyAdmin:false,role:{admin:false,judge:false,facilitator_sessions:[]}},f.deps);
 assertEquals(result.status,200);assertEquals((result.body as {host:boolean}).host,true);assertEquals(f.calls.includes("POST /meetings"),true);
});
Deno.test("managed denial defeats open door, invitation key, host email and Academy admin",async()=>{
 const f=fixture({classroomAccess:async()=>({managed:true,can_join:false,is_host:false,room_id:null})});
 assertEquals((await handleJoin({room:slug,key:f.room.link_key},caller,f.deps)).status,403);assertEquals(f.calls,[]);
 assertEquals((await handleJoin({room:"htc-unknown",key:f.room.link_key},caller,f.deps)).status,403);
});
Deno.test("managed join fails closed for missing RPC, errors and malformed authorization",async()=>{
 for(const classroomAccess of [undefined,async()=>{throw Error("missing rpc");},async()=>null,async()=>({managed:false,can_join:true,is_host:true,room_id:"managed-room"})]){
  const f=fixture({classroomAccess});assertEquals((await handleJoin({room:slug},caller,f.deps)).status,503);assertEquals(f.calls,[]);
 }
});
Deno.test("managed join requires the bridge and room row to identify the same room",async()=>{
 const f=fixture({classroomAccess:async()=>({managed:true,can_join:true,is_host:true,room_id:"other-room"})});
 assertEquals((await handleJoin({room:slug},caller,f.deps)).status,403);assertEquals(f.calls,[]);
});
Deno.test("managed students still wait for their instructor to open the session",async()=>{
 const f=fixture();f.room.is_live=false;assertEquals((await handleJoin({room:slug},caller,f.deps)).status,409);assertEquals(f.calls,[]);
});
Deno.test("different simultaneous session slugs receive their own room and meeting",async()=>{
 const f=fixture();const requested:string[]=[];const other="htc-abcdef0123456789abcdef01";
 f.deps.classroomAccess=async value=>({managed:true,can_join:true,is_host:false,room_id:value});
 f.deps.getRoom=async value=>{requested.push(value);return {...f.room,id:value,slug:value,meeting_id:"meeting-"+value};};
 for(const room of [slug,other])assertEquals((await handleJoin({room},caller,f.deps)).status,200);
 assertEquals(requested,[slug,other]);assertEquals(f.calls.filter(x=>x.endsWith("/participants")),["POST /meetings/meeting-"+slug+"/participants","POST /meetings/meeting-"+other+"/participants"]);
});
Deno.test("OPIL cannot mint a participant when room isolation lookup fails",async()=>{
 const lookedUp:string[]=[];
 const f=fixture({getSession:async()=>({no:7,title:"OPIL",stream_url:"rtk:managed-meeting",is_live:true}),roomMeetingIds:async id=>{lookedUp.push(id);throw Error("database unavailable");}});
 assertEquals((await handleJoin({session_no:7},caller,f.deps)).status,503);
 assertEquals(f.calls,[]);assertEquals(lookedUp,["managed-meeting"]);
});
Deno.test("two managed hosts starting together receive the one persisted meeting and retire the orphan",async()=>{
 let next=0,winner:string|null=null;const retired:string[]=[];const claims:string[]=[];
 const f=fixture({
  classroomAccess:async()=>({managed:true,can_join:true,is_host:true,room_id:"managed-room"}),
  claimClassroomMeeting:async(room,id,previous)=>{assertEquals(room,"managed-room");assertEquals(previous,"class-meeting");claims.push(id);winner ||= id;return winner;},
  setRoomMeeting:async()=>{throw Error("legacy store must not run");},
  cf:async(method,path)=>{
   if(path==="/meetings")return {ok:true,status:200,data:{id:"mint-"+(++next)}};
   if(method==="PATCH")retired.push(path);
   return {ok:true,status:200,data:{token:"token:"+path}};
  },
 });
 f.room.is_live=false;
 const results=await Promise.all([handleJoin({room:slug},caller,f.deps),handleJoin({room:slug},{...caller,user:{id:"second-host",email:"second@example.test"}},f.deps)]);
 const persisted=String(winner);assertEquals(persisted.startsWith("mint-"),true);
 assertEquals(results.map(x=>x.status),[200,200]);
 assertEquals(results.map(x=>(x.body as {meeting_id:string}).meeting_id),[persisted,persisted]);
 assertEquals(results.map(x=>(x.body as {token:string}).token),[`token:/meetings/${winner}/participants`,`token:/meetings/${winner}/participants`]);
 assertEquals(claims.length,2);assertEquals(retired.includes("/meetings/class-meeting"),true);
 assertEquals(retired.includes("/meetings/"+claims.find(id=>id!==winner)),true);
 assertEquals(retired.includes("/meetings/"+winner),false);
});
Deno.test("managed starts fail closed and retire the unused meeting when atomic persistence fails",async()=>{
 for(const claimClassroomMeeting of [async()=>null,async()=>{throw Error("write unavailable");}]){
  const f=fixture({classroomAccess:async()=>({managed:true,can_join:true,is_host:true,room_id:"managed-room"}),claimClassroomMeeting});f.room.is_live=false;
  const result=await handleJoin({room:slug},caller,f.deps);
  assertEquals(result.status,503);assertEquals((result.body as {token?:string}).token,undefined);
  assertEquals(f.calls.includes("PATCH /meetings/new-meeting"),true);
 }
 const missing=fixture({classroomAccess:async()=>({managed:true,can_join:true,is_host:true,room_id:"managed-room"}),claimClassroomMeeting:undefined});missing.room.is_live=false;
 assertEquals((await handleJoin({room:slug},caller,missing.deps)).status,503);assertEquals(missing.calls,[]);
});
Deno.test("managed losing host never receives the orphan token when joining the winner fails",async()=>{
 const f=fixture({classroomAccess:async()=>({managed:true,can_join:true,is_host:true,room_id:"managed-room"}),claimClassroomMeeting:async()=>"winner"});f.room.is_live=false;
 const cf=f.deps.cf;f.deps.cf=async(method,path,body)=>path==="/meetings/winner/participants"?{ok:false,status:503,data:{}}:cf(method,path,body);
 const result=await handleJoin({room:slug},caller,f.deps);
 assertEquals(result.status,502);assertEquals((result.body as {token?:string}).token,undefined);
 assertEquals(f.calls.includes("PATCH /meetings/new-meeting"),true);
});
