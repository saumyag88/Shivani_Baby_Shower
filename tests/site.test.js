import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {CONFIG} from '../config.js';
import {createIcs, mapsUrl, normalizeRsvp, submitRsvp, endpointIsConfigured, toAppsScriptPayload} from '../lib.js';
const endpoint = 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec';
const input = {familyName:' Example Family ',attending:'yes',count:'3',guestNames:'Alex, Sam, Jamie',dietaryNeeds:'Vegetarian',message:'Congratulations!',website:''};

test('event is Sunday Dec 13, 2026, with correct Pacific winter offset',()=>{
 assert.equal(new Intl.DateTimeFormat('en-US',{weekday:'long',timeZone:CONFIG.timeZone}).format(new Date(CONFIG.startsAt)), 'Sunday');
 assert.equal(new Date(CONFIG.startsAt).toISOString(),'2026-12-13T18:00:00.000Z');
 assert.equal(new Date(CONFIG.lunchAt).toISOString(),'2026-12-13T19:00:00.000Z');
});
test('attendance data normalizes and clears hidden fields for declines',()=>{
 assert.equal(normalizeRsvp(input).familyName,'Example Family');
 assert.deepEqual(normalizeRsvp({...input,attending:'no'}),{familyName:'Example Family',attending:'no',count:0,guestNames:'',dietaryNeeds:'',message:'Congratulations!',website:''});
});
test('required data, count bounds and field length are enforced',()=>{
 for(const patch of [{familyName:' '},{attending:''},{count:''},{count:'0'},{count:'11'},{count:'1.5'},{familyName:'a'.repeat(121)},{message:'a'.repeat(1501)}]) assert.throws(()=>normalizeRsvp({...input,...patch}));
 for(const count of ['1','10']) assert.equal(normalizeRsvp({...input,count}).count,Number(count));
});
test('maps search includes no invented street address',()=>{
 assert.equal(new URL(mapsUrl(CONFIG)).searchParams.get('query'),'The Courtyard Hall, Sunnyvale, CA');
 assert.throws(()=>mapsUrl({...CONFIG,mapsUrl:'javascript:alert(1)'}));
});
test('calendar has UTC start, no invented end, CRLF and safe UTF-8 folding',()=>{
 const ics=createIcs(CONFIG,new Date('2026-10-24T00:00:00Z'));
 assert.match(ics,/DTSTART:20261213T180000Z/); assert.doesNotMatch(ics,/DTEND/);
 assert.match(ics,/Lunch & Games at 11:00 AM/); assert.match(ics,/Sunnyvale\\, CA/);
 for(const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line)<=75);
 assert.ok(!/(?<!\r)\n/.test(ics));
 const escaped=createIcs({...CONFIG,title:'A, B; C\\D\n♥'.repeat(30)}).replace(/\r\n /g,'');
 assert.ok(escaped.includes('SUMMARY:A\\, B\\; C\\\\D\\n♥'));
});
test('a confirmed end time is reflected in calendar metadata and description',()=>{
 const ics=createIcs({...CONFIG,endsAt:'2026-12-13T14:00:00-08:00'}).replace(/\r\n /g,'');
 assert.match(ics,/DTEND:20261213T220000Z/);assert.doesNotMatch(ics,/End time to be confirmed/);
});
test('checked-in calendar matches current configuration except creation stamp',()=>{
 const saved=readFileSync(new URL('../shivani-baby-shower.ics',import.meta.url),'utf8').replace(/\r?\n/g,'\r\n');
 const scrub=s=>s.replace(/DTSTAMP:[^\r]+/,'DTSTAMP:GENERATED');
 assert.equal(scrub(saved),scrub(createIcs(CONFIG)));
});
test('only production Apps Script exec endpoints are accepted',()=>{
 assert.equal(endpointIsConfigured(endpoint),true);
 for(const url of ['',endpoint.replace('/exec','/dev'),'https://example.com/exec',endpoint+'?token=secret']) assert.equal(endpointIsConfigured(url),false);
});
test('the adapter matches the supplied script and preserves all optional details',()=>{
 const mapped=toAppsScriptPayload(input);
 assert.deepEqual(mapped,{name:'Example Family',attending:'yes',partySize:3,email:'',notes:'Guest names: Alex, Sam, Jamie\nDietary needs: Vegetarian\nMessage: Congratulations!'});
 assert.equal(toAppsScriptPayload({...input,attending:'no'}).partySize,0);
 assert.equal(toAppsScriptPayload({...input,attending:'no'}).notes,'Message: Congratulations!');
 assert.ok(toAppsScriptPayload({...input,familyName:'=HYPERLINK("x")'}).name.startsWith("'="));
 assert.throws(()=>toAppsScriptPayload({...input,website:'spam'}));
});
test('submission uses the deployed script field names and confirms the saved row',async()=>{
 const result=await submitRsvp(endpoint,input,{fetchImpl:async(url,options)=>{
  assert.equal(url,endpoint);assert.equal(options.mode,'cors');assert.equal(options.redirect,'follow');assert.equal(options.credentials,'omit');assert.equal(options.headers,undefined);
  assert.equal(options.body.get('name'),'Example Family');assert.equal(options.body.get('partySize'),'3');assert.equal(options.body.has('familyName'),false);
  return {ok:true,json:async()=>({result:'success',row:2})};
 }});assert.equal(result.row,2);
});
test('opaque, malformed, failed, and invalid saved-row responses never show success',async()=>{
 for(const response of [{ok:true,type:'opaque'},{ok:false},{ok:true,json:async()=>{throw new Error('HTML login page');}},{ok:true,json:async()=>({result:'success',row:1})},{ok:true,json:async()=>({result:'error',error:'internal private details'})}]) {
  await assert.rejects(submitRsvp(endpoint,input,{fetchImpl:async()=>response}),e=>e.uncertain===true && !e.message.includes('private details'));
 }
});
test('offline and timeout failures ask the host to check before resubmission',async()=>{
 await assert.rejects(submitRsvp(endpoint,input,{fetchImpl:async()=>{throw new TypeError('Network error');}}),e=>e.uncertain && e.message.includes('contact the host'));
 await assert.rejects(submitRsvp(endpoint,input,{timeoutMs:5,fetchImpl:(_,o)=>new Promise((resolve,reject)=>o.signal.addEventListener('abort',()=>reject(new Error('aborted'))))}),e=>e.uncertain);
});

function backend() {
 const rows=[];const summary={};const properties={};let released=false;
 const range=(target,key)=>({setValue:value=>{target[key]=value;return range(target,key);},setFormula:value=>{target[key]=value;return range(target,key);},setFontWeight:()=>range(target,key)});
 const sheet={getLastRow:()=>rows.length,appendRow:row=>rows.push(row),getRange:()=>range({},''),setFrozenRows:()=>{}};
 const summarySheet={getRange:key=>range(summary,key)};
 const spreadsheet={getId:()=> 'fake-sheet-id',getSheetByName:name=>name==='RSVPs'?sheet:name==='Summary'?summarySheet:null};
 const context=vm.createContext({Date,ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})},PropertiesService:{getScriptProperties:()=>({getProperty:key=>properties[key],setProperty:(key,value)=>{properties[key]=value;}})},SpreadsheetApp:{getActiveSpreadsheet:()=>spreadsheet,openById:()=>spreadsheet},LockService:{getScriptLock:()=>({waitLock:()=>{},releaseLock:()=>{released=true;}})}});
 vm.runInContext(readFileSync(new URL('../google-apps-script/Code.gs',import.meta.url),'utf8'),context);
 context.setup();
 return {context,rows,summary,properties,post:(data=toAppsScriptPayload(input))=>{const body=new URLSearchParams(data);return context.doPost({parameter:Object.fromEntries(body),postData:{contents:body.toString()}});},released:()=>released};
}
test('supplied setup creates six columns and the live guest-total formula',()=>{
 const b=backend();assert.equal(b.rows[0].length,6);assert.equal(b.summary.B1,'=SUMIF(RSVPs!C2:C,"yes",RSVPs!D2:D)');assert.equal(b.properties.SPREADSHEET_ID,'fake-sheet-id');
});
test('adapter and exact supplied Apps Script agree on a three-person RSVP',()=>{
 const b=backend();const result=b.post();assert.equal(result.result,'success');assert.equal(result.row,2);assert.equal(b.rows[1][1],'Example Family');assert.equal(b.rows[1][2],'yes');assert.equal(b.rows[1][3],3);assert.equal(b.rows[1][4],'');assert.ok(b.rows[1][5].includes('Guest names: Alex, Sam, Jamie'));assert.ok(b.rows[1][5].includes('Dietary needs: Vegetarian'));assert.ok(b.rows[1][5].includes('Message: Congratulations!'));assert.equal(b.released(),true);
});
test('declines written through the adapter have zero guests',()=>{
 const b=backend();b.post(toAppsScriptPayload({...input,attending:'no'}));assert.equal(b.rows[1][2],'no');assert.equal(b.rows[1][3],0);
});
test('supplied backend appends every request; retries cannot be assumed safe',()=>{
 const b=backend();b.post();b.post();assert.equal(b.rows.length,3);
});
test('health response contains no RSVP data',()=>{
 const b=backend();b.post();const health=b.context.doGet();assert.equal(health.status,'ok');assert.ok(!JSON.stringify(health).includes('Example Family'));
});
