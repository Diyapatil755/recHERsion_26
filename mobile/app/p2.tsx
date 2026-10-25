import React, {useState} from 'react';
import {Alert, Linking, Platform, Pressable, ScrollView, Share, Text, View} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {toByteArray} from 'base64-js';
import {useRouter} from 'expo-router';
import {randomId} from '../src/id';
import {useSaheli} from '../src/store';
import {Button, Card, Field, Heading, Notice, Page, Pill} from '../src/ui';
import {C} from '../src/theme';
import {createVolunteerRecord, inspectJpegGps, makeSupportRequest, toggleChecklist, type JpegGpsResult, type VolunteerKind} from '../src/p2';
import type {SupportVolunteer} from '../src/types';

const privacyItems=[
  ['profile','Public profile visibility','Review who can see your profile, posts, followers and tagged content. Set visibility to the narrowest audience you prefer.'],
  ['personal','Personal details exposed','Remove public address, school/work schedule, birth date and other details that could identify or locate you.'],
  ['location','Location sharing','Review live-location sharing, map history, geotags and app access. Turn off sharing you do not need.'],
  ['photos','Photo privacy','Review audience and tags before posting. Consider metadata: this checker can inspect JPEG GPS tags but cannot remove metadata.'],
  ['usernames','Username reuse','Avoid reusing a distinctive handle across personal, work and public accounts; search your own handle from a logged-out view if safe.'],
  ['contact','Contact information','Limit public email/phone details and check who can find you by phone number or sync contacts.']
] as const;
const accountItems=[
  ['unique','Unique passwords','Use a different long password for every important account; never enter it in Saheli.'],
  ['manager','Password manager','Consider a reputable password manager and protect its recovery method. Never store passwords here.'],
  ['twofactor','Two-factor authentication','Enable two-step verification, preferably with a passkey or authenticator where supported; keep recovery codes offline and private.'],
  ['sessions','Active sessions','Review signed-in devices and sessions in each service; sign out sessions you do not recognize. Saheli cannot see them.'],
  ['recovery','Recovery email and phone','Check recovery email/phone are current and controlled by you; secure the email account first.'],
  ['recoveryplan','Recovery and alerts','Read the service’s official account-recovery steps and enable security notifications. Never share a recovery code.']
] as const;
const trackerItems=[
  ['unexpected','Unexpected battery, data or settings changes','These can have many causes; they are not proof of monitoring.'],
  ['access','Someone knows private information or had physical access','Consider account access, shared devices, and who can see your unlock code. Avoid confronting anyone if unsafe.'],
  ['apps','Review unfamiliar apps and special access','From Android Settings, review installed apps and Accessibility, Device admin, VPN, and notification access. Names can be disguised; findings are hints only.'],
  ['permissions','Review sensitive app permissions','Check location, microphone, camera, SMS and contacts permissions in Android Settings; revoke only if safe and understood.'],
  ['trackers','Unknown tracker alerts','Look in Android Settings > Safety & emergency > Unknown tracker alerts (wording and availability vary by Android/device). Keep Bluetooth/location as needed for detection.']
] as const;
const GPS_MESSAGES:Record<JpegGpsResult,string>={
  'gps-present':'GPS-related EXIF tags are present in this JPEG. This checks tags only; it does not decode or show coordinates.',
  'gps-not-found':'No GPS IFD tags were found in this JPEG. Other metadata may still be present.',
  unsupported:'This file is not a supported JPEG. Only JPEG EXIF GPS tags can be inspected here.',
  malformed:'The JPEG/EXIF structure could not be parsed safely. No metadata conclusion was made.'
};
const ruleLevel='This is a guided checklist only—not a spyware scan, tracker detection, or proof. Phone makers and Android versions differ.';

export default function P2Checkups(){
  const router=useRouter();
  const {state,patch}=useSaheli();
  const [photo,setPhoto]=useState<{name:string;result:JpegGpsResult}|null>(null);
  const [photoBusy,setPhotoBusy]=useState(false);
  const [volName,setVolName]=useState(''),[volContact,setVolContact]=useState(''),[volKind,setVolKind]=useState<VolunteerKind>('unverified'),[attested,setAttested]=useState(false);
  const [selectedIds,setSelectedIds]=useState<string[]>([]),[requestText,setRequestText]=useState(''),[callbackText,setCallbackText]=useState(''),[preview,setPreview]=useState('');
  const privacy=state.privacyCheckup||{}, security=state.accountSecurityCheckup||{}, tracker=state.trackerSafetyCheckup||{}, volunteers=state.supportVolunteers||[];
  const saveChecklist=async(which:'privacyCheckup'|'accountSecurityCheckup'|'trackerSafetyCheckup',key:string)=>{
    try{const map=state[which]||{};await patch({[which]:toggleChecklist(map,key)} as Pick<typeof state,typeof which>)}
    catch(e){Alert.alert('Checklist not saved',`${String(e)}. Existing records were preserved.`)}
  };
  const pickPhoto=async()=>{
    let temporaryCopy:string|undefined;
    try{
      const picked=await DocumentPicker.getDocumentAsync({type:['image/jpeg'],copyToCacheDirectory:true,multiple:false});
      if(picked.canceled)return;
      const asset=picked.assets[0];
      if(FileSystem.cacheDirectory&&asset.uri.startsWith(FileSystem.cacheDirectory))temporaryCopy=asset.uri;
      const name=asset.name||'selected image.jpg';
      const isJpeg=(asset.mimeType||'').toLowerCase()==='image/jpeg'||/\.jpe?g$/i.test(name);
      if(!isJpeg){setPhoto({name,result:'unsupported'});return;}
      if(!asset.size||asset.size>20*1024*1024){setPhoto(null);Alert.alert('Image not inspected','Choose a non-empty JPEG smaller than 20 MB. No image was retained.');return;}
      setPhotoBusy(true);
      const base64=await FileSystem.readAsStringAsync(asset.uri,{encoding:FileSystem.EncodingType.Base64});
      const bytes=toByteArray(base64);
      if(bytes.length!==asset.size){setPhoto({name,result:'malformed'});return;}
      setPhoto({name,result:inspectJpegGps(bytes)});
    }catch(e){Alert.alert('Image not inspected',`${String(e)}. No image was saved or uploaded.`)}
    finally{if(temporaryCopy)await FileSystem.deleteAsync(temporaryCopy,{idempotent:true}).catch(()=>undefined);setPhotoBusy(false);}
  };
  const addVolunteer=async()=>{
    let item:SupportVolunteer;
    try{item=createVolunteerRecord(randomId(),volName,volContact,volKind,attested,Date.now())}catch(e){Alert.alert('Check volunteer details',String(e));return;}
    try{await patch({supportVolunteers:[item,...volunteers]});setVolName('');setVolContact('');setVolKind('unverified');setAttested(false);}
    catch(e){Alert.alert('Volunteer not saved',`${String(e)}. Existing records were preserved.`)}
  };
  const toggleOptIn=async(v:SupportVolunteer)=>{
    const commit=async(optedIn:boolean)=>{try{await patch({supportVolunteers:volunteers.map(x=>x.id===v.id?{...x,optedIn}:x)});if(!optedIn)setSelectedIds(ids=>ids.filter(id=>id!==v.id));}catch(e){Alert.alert('Consent not changed',`${String(e)}. Existing records were preserved.`)}};
    if(v.optedIn){await commit(false);return;}
    Alert.alert('Confirm renewed opt-in',`Only continue if ${v.name} has explicitly agreed to be listed again.`,[{text:'Cancel',style:'cancel'},{text:'Confirm opt-in',onPress:()=>void commit(true)}]);
  };
  const deleteVolunteer=(v:SupportVolunteer)=>Alert.alert('Delete volunteer record?',`${v.name} will be removed from Saheli local storage. Copies already shared elsewhere cannot be recalled.`,[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>void patch({supportVolunteers:volunteers.filter(x=>x.id!==v.id)}).then(()=>setSelectedIds(ids=>ids.filter(id=>id!==v.id))).catch(e=>Alert.alert('Record not deleted',String(e)))}]);
  const makePreview=()=>{
    const opted=volunteers.filter(v=>selectedIds.includes(v.id)&&v.optedIn&&v.verification!=='demo');
    if(!opted.length){Alert.alert('Choose an opted-in volunteer','Demo/test and opted-out records cannot be selected. Add or opt in an unverified volunteer first.');return;}
    try{setPreview(makeSupportRequest(opted.map(v=>v.name),requestText,callbackText));}
    catch(e){Alert.alert('Request not prepared',String(e));}
  };
  const confirmShare=()=>Alert.alert('Review before sharing','This opens Android’s system share sheet with the preview text. Saheli does not send it directly and cannot confirm delivery. Choose a destination yourself.',[{text:'Cancel',style:'cancel'},{text:'Open share sheet',onPress:()=>void Share.share({title:'Saheli support request',message:preview}).catch(e=>Alert.alert('Share sheet unavailable',String(e)))}]);
  const openIntent=async(action:string,label:string)=>{
    if(Platform.OS!=='android'){Alert.alert('Android settings only',`${label} can be opened on Android. On this device, open system Settings manually.`);return;}
    try{await Linking.sendIntent(action)}catch{Alert.alert('Could not open settings',`Open Android Settings manually, then find ${label}. Availability depends on your device and Android version.`)}
  };
  const checklist=(items:ReadonlyArray<readonly [string,string,string]>,map:Record<string,boolean>,which:'privacyCheckup'|'accountSecurityCheckup'|'trackerSafetyCheckup')=>items.map(([key,title,detail])=><Pressable key={key} accessibilityRole="checkbox" accessibilityState={{checked:!!map[key]}} onPress={()=>void saveChecklist(which,key)} style={{flexDirection:'row',gap:10,paddingVertical:13,borderTopWidth:1,borderTopColor:C.line}}><Text style={{fontSize:19,color:C.plum}}>{map[key]?'☑':'□'}</Text><View style={{flex:1}}><Text style={{fontSize:14,fontWeight:'700',color:C.ink}}>{title}</Text><Text style={{fontSize:13,lineHeight:19,color:C.muted,marginTop:3}}>{detail}</Text></View></Pressable>);
  return <Page><ScrollView contentContainerStyle={{paddingBottom:32}} keyboardShouldPersistTaps="handled">
    <Button title="‹ Profile & privacy" kind="quiet" onPress={()=>router.back()}/>
    <Heading eyebrow="P2 · Offline checkups" title="Privacy & safety checkups" subtitle="Local, optional checklists. Nothing is scanned or shared unless you choose an action."/>
    <Card><Heading title="Digital footprint & privacy" subtitle="Review public exposure and complete actions you choose."/>{checklist(privacyItems,privacy,'privacyCheckup')}<Notice>Completion state is stored in the existing local app database. A checked item records your own review—not a technical verification.</Notice></Card>
    <Card><Heading title="JPEG photo privacy check" subtitle="Select a JPEG to inspect its EXIF GPS directory locally."/><Notice>The image is read in memory for this check only. Saheli does not retain or upload it. JPEG GPS tags can be detected; this does not display coordinates or inspect every metadata type.</Notice><Button title={photoBusy?'Inspecting…':'Choose JPEG and inspect GPS tags'} kind="secondary" loading={photoBusy} onPress={()=>void pickPhoto()}/>{photo?<View style={{marginTop:10}}><Pill text={photo.result==='gps-present'?'GPS EXIF FOUND':photo.result==='gps-not-found'?'NO GPS EXIF TAG FOUND':'NO CONCLUSION'} tone={photo.result==='gps-present'?'amber':'green'}/><Text style={{fontSize:13,color:C.ink,marginTop:6}}>{photo.name}: {GPS_MESSAGES[photo.result]}</Text><Button title="Clear result" kind="quiet" small onPress={()=>setPhoto(null)}/></View>:null}<Notice tone="warn">Reliable metadata-stripping/export is not supported by the installed dependencies. No stripped copy is produced; the original is never modified. Before posting, use a trusted photo editor/platform that documents metadata removal, or share a screenshot/copy only after considering other identifying details.</Notice></Card>
    <Card><Heading title="Account security checklist" subtitle="A private reminder list—no passwords or recovery codes are requested or stored."/>{checklist(accountItems,security,'accountSecurityCheckup')}<Notice>Saheli does not monitor accounts, view sessions, verify recovery details, or change security settings. Follow the official steps for each service.</Notice></Card>
    <Card><Heading title="Panic voice keyword" subtitle="Deferred—not activated in this app."/><Text style={{fontSize:13,lineHeight:20,color:C.ink}}>Project inspection found no installed speech-recognition dependency or working speech-to-text implementation. Adding keyword listening would require native integration and careful microphone, foreground-service, privacy, and battery testing. Saheli has no microphone permission and does not listen in the foreground or background. No voice trigger is available.</Text></Card>
    <Card><Heading title="Community bystander pilot" subtitle="A local list of people you personally add—not a live community network."/><Notice>There is no cross-device discovery, delivery confirmation, or volunteer verification service. New real-person entries are marked UNVERIFIED and require your attestation of their explicit opt-in. Demo/test entries are clearly marked and cannot be selected for requests. Saheli cannot verify consent independently.</Notice>
      {volunteers.map(v=><View key={v.id} style={{borderTopWidth:1,borderTopColor:C.line,paddingVertical:10}}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={{fontWeight:'700',color:C.ink,flex:1}}>{v.name}</Text><Pill text={v.verification==='demo'?'DEMO / TEST':v.verification.toUpperCase()} tone={v.verification==='verified'?'green':v.verification==='demo'?'amber':'amber'}/></View><Text style={{fontSize:12,color:C.muted,marginTop:3}}>{v.contact} · {v.verification==='demo'?'not a real volunteer':v.optedIn?'opted in locally':'opted out locally'}</Text><View style={{flexDirection:'row',gap:7,marginTop:7}}>{v.verification!=='demo'?<Button title={v.optedIn?'Revoke opt-in':'Opt in again'} kind="secondary" small onPress={()=>void toggleOptIn(v)}/>:null}<Button title="Delete" kind="danger" small onPress={()=>deleteVolunteer(v)}/></View></View>)}
      <Field label="Volunteer name" value={volName} onChangeText={setVolName} maxLength={100} placeholder="Manually entered"/><Field label="Volunteer phone or email" value={volContact} onChangeText={setVolContact} maxLength={254} autoCapitalize="none" placeholder="Never imported from contacts"/>
      <View style={{flexDirection:'row',gap:8,marginBottom:8}}><Button title="Unverified volunteer" kind={volKind==='unverified'?'primary':'secondary'} small onPress={()=>setVolKind('unverified')}/><Button title="Demo/test record" kind={volKind==='demo'?'primary':'secondary'} small onPress={()=>setVolKind('demo')}/></View>
      {volKind==='unverified'?<Pressable onPress={()=>setAttested(x=>!x)} style={{flexDirection:'row',gap:9,paddingVertical:9}}><Text style={{fontSize:18,color:C.plum}}>{attested?'☑':'□'}</Text><Text style={{flex:1,color:C.ink,fontSize:13}}>I have this person’s explicit permission to list them as an opted-in support volunteer.</Text></Pressable>:null}
      <Button title="Add local volunteer record" onPress={()=>void addVolunteer()}/>
      <Field label="Brief support request (optional details only)" value={requestText} onChangeText={setRequestText} multiline maxLength={500} placeholder="For example: Please call when available."/><Field label="Optional callback detail to share" value={callbackText} onChangeText={setCallbackText} maxLength={160} placeholder="No location is included."/>
      {volunteers.filter(v=>v.optedIn&&v.verification!=='demo').map(v=><Pressable key={v.id} accessibilityRole="checkbox" accessibilityState={{checked:selectedIds.includes(v.id)}} onPress={()=>setSelectedIds(ids=>ids.includes(v.id)?ids.filter(x=>x!==v.id):[...ids,v.id])} style={{flexDirection:'row',gap:8,paddingVertical:11,minHeight:44}}><Text>{selectedIds.includes(v.id)?'☑':'□'}</Text><Text style={{color:C.ink}}>{v.name} · unverified local entry</Text></Pressable>)}
      <Button title="Review what would be shared" kind="secondary" onPress={makePreview}/>{preview?<View style={{marginTop:10}}><Heading title="Review support request"/><Notice>{preview}</Notice><View style={{flexDirection:'row',gap:8}}><Button title="Cancel preview" kind="quiet" onPress={()=>setPreview('')}/><Button title="Confirm & open share sheet" onPress={confirmShare}/></View></View>:null}
    </Card>
    <Card><Heading title="Stalkerware & tracker safety check" subtitle="Guided review—not an installed-app or spyware scan."/><Notice>{ruleLevel}</Notice>{checklist(trackerItems,tracker,'trackerSafetyCheckup')}<Button title="Open Android installed-app settings" kind="secondary" onPress={()=>void openIntent('android.settings.APPLICATION_SETTINGS','Apps')}/><Button title="Open Android Security settings" kind="secondary" onPress={()=>void openIntent('android.settings.SECURITY_SETTINGS','Security & privacy')}/><Button title="Open Android Settings" kind="secondary" onPress={()=>void openIntent('android.settings.SETTINGS','Safety & emergency > Unknown tracker alerts')}/><Text style={{fontSize:12,color:C.muted,lineHeight:18,marginTop:8}}>Review app permissions and unfamiliar apps there. On supported Android versions, look under Safety & emergency for Unknown tracker alerts. Menu names vary; no app scan or tracker alert is run by Saheli.</Text><Notice tone="warn">If you suspect monitoring, use a device you trust to seek help. Removing apps or changing settings can alert another person or affect evidence. Do not confront anyone if it could increase danger. Findings and symptoms are hints, never proof.</Notice></Card>
  </ScrollView></Page>;
}
