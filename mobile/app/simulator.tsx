import React from'react';
import{Alert,ScrollView,Text,View}from'react-native';
import{router}from'expo-router';
import{useSaheli}from'../src/store';
import{Button,Card,Heading,Notice,Page,Pill}from'../src/ui';
import{C}from'../src/theme';
const groups:[string,[string,string][]][]=[['Alert delivery',[['success','Simulated send accepted'],['poor','Poor connectivity / queued'],['offline','No network → recovery'],['failed','Simulated send failed']]],['Journey check-in',[['missed','Missed check-in'],['cancel','Cancel during grace'],['escalate','Grace elapsed / local escalation'],['ack','Simulated acknowledgement']]]];
const scripts:Record<string,string[]>={success:['Alert prepared','DEMO transport accepted request','DEMO sent status; not delivered'],poor:['DEMO poor connection','Alert remains in local queue','DEMO retry available after recovery; no transport is configured'],offline:['DEMO network unavailable','Alert queued locally','DEMO connectivity restored','Retry remains a simulation; no actual send'],failed:['DEMO transport failed','Status failed · no external send'],missed:['DEMO check-in reminder displayed','DEMO grace period started'],cancel:['DEMO user checked in during grace','Escalation cancelled'],escalate:['DEMO grace expired','DEMO escalation attempt stored locally','No trusted contacts alerted'],ack:['DEMO contact acknowledgement recorded','No contact received an alert']};
export default function Simulator(){
 const{state,patch}=useSaheli();
 const run=async(id:string)=>{const events=[`${new Date().toLocaleTimeString()} · DEMO · ${id.toUpperCase()}`,...(scripts[id]||scripts.failed).map(x=>`${new Date().toLocaleTimeString()} · DEMO · ${x}`)];try{await patch({demoLog:[...events,...state.demoLog].slice(0,80)})}catch(e){Alert.alert('Demo event not saved',String(e))}};
 const reset=()=>Alert.alert('Reset simulator?', 'Only simulated event logs will be deleted. Real SOS and incident records remain.',[{text:'Cancel',style:'cancel'},{text:'Reset demo',style:'destructive',onPress:()=>void patch({demoLog:[]}).catch(e=>Alert.alert('Demo reset failed',String(e)))}]);
 return <Page><ScrollView contentContainerStyle={{paddingBottom:30}}>
  <Button title="‹  Back to safety" kind="quiet" onPress={()=>router.back()}/>
  <Heading eyebrow="Practice mode" title="Emergency simulator" subtitle="Explore example states without contacting anyone or creating real SOS records."/>
  <Notice tone="warn">Everything in this screen is a simulation. Demo statuses and acknowledgements are not real delivery, contact receipt, or emergency escalation.</Notice>
  {groups.map(([group,items])=><Card key={group}><Heading title={group} subtitle={group==='Alert delivery'?'Practice local alert-state scenarios.':'Practice check-in and grace-period scenarios.'}/>{items.map(([id,label])=><Button key={id} title={`${label}  ·  DEMO`} kind="secondary" onPress={()=>void run(id)}/>)}</Card>)}
  <Card><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><Heading eyebrow="Stored separately" title="Simulation log" subtitle={`${state.demoLog.length} recent demo event(s)`}/><Pill text="DEMO ONLY" tone="amber"/></View>{state.demoLog.map((event,index)=><View key={`${index}-${event}`} style={{flexDirection:'row',gap:9,paddingVertical:9,borderTopWidth:1,borderTopColor:C.line}}><Text style={{color:C.amber,fontWeight:'800'}}>·</Text><Text style={{fontSize:12,color:C.ink,lineHeight:18,flex:1}}>{event}</Text></View>)}{!state.demoLog.length?<Text style={{fontSize:13,color:C.muted}}>No simulated events yet. Choose any scenario above to try it.</Text>:null}<Button title="Reset demo events" kind="danger" onPress={reset}/></Card>
  <Notice>Demo events are stored separately and never represented as a real SOS or delivered message.</Notice>
 </ScrollView></Page>
}
