import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { canRunSummary } from "./handler.ts";
const key="room:12345678-1234-1234-1234-123456789abc";
Deno.test("room summaries use caller-scoped host authorization before all administrator shortcuts",async()=>{
 const roles={admin:true,academyAdmin:true};let checked="";
 assertEquals(await canRunSummary(key,roles,async value=>{checked=value;return false;}),false);assertEquals(checked,key);
 assertEquals(await canRunSummary(key,roles,async()=>{throw Error("missing function");}),false);
 assertEquals(await canRunSummary(key,{admin:false,academyAdmin:false},async()=>true),true);
});
Deno.test("OPIL coordinator summary behavior is unchanged",async()=>{
 assertEquals(await canRunSummary("opil:7",{admin:true,academyAdmin:false},async()=>{throw Error("unneeded");}),true);
 assertEquals(await canRunSummary("opil:7",{admin:false,academyAdmin:false},async()=>true),true);
 assertEquals(await canRunSummary("opil:7",{admin:false,academyAdmin:false},async()=>false),false);
});
