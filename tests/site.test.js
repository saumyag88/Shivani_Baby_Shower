import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {CONFIG} from '../config.js';
import {createIcs, googleFormLinks, mapsUrl, normalizeRsvp, submitRsvp, endpointIsConfigured} from '../lib.js';
const endpoint = 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec';
const input = {familyName:' Example Family ',attending:'yes',count:'3',guestNames:'Alex, Sam, Jamie',dietaryNeeds:'Vegetarian',message:'Congratulations!',website:''};
const payload = {...normalizeRsvp(input),requestId:'12345678-1234-4123-8123-123456789abc'};

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
test('submission uses a simple POST and waits for matching acknowledgement',async()=>{
 const result=await submitRsvp(endpoint,payload,{fetchImpl:async(url,options)=>{
  assert.equal(url,endpoint);assert.equal(options.mode,'cors'); assert.equal(options.redirect,'follow');assert.equal(options.credentials,'omit');assert.equal(options.headers,undefined);
  assert.equal(options.body.get('familyName'),'Example Family');assert.equal(options.body.get('count'),'3');
  return {ok:true,json:async()=>({ok:true,requestId:payload.requestId})};
 }});assert.equal(result.ok,true);
});
test('opaque, malformed, mismatched, and failed HTTP responses never show success',async()=>{
 for(const response of [{ok:true,type:'opaque'},{ok:false},{ok:true,json:async()=>{throw new Error('HTML login page');}},{ok:true,json:async()=>({ok:true,requestId:'wrong'})}]) {
  await assert.rejects(submitRsvp(endpoint,payload,{fetchImpl:async()=>response}), e=>e.uncertain===true);
 }
});
test('validation rejection unlocks edits; ambiguous storage failure preserves retry',async()=>{
 for(const code of ['INVALID_INPUT','TRY_AGAIN']) await assert.rejects(submitRsvp(endpoint,payload,{fetchImpl:async()=>({ok:true,json:async()=>({ok:false,requestId:payload.requestId,code})})}),e=>e.uncertain===(code!=='INVALID_INPUT'));
});
test('offline and timed-out submissions remain unconfirmed',async()=>{
 await assert.rejects(submitRsvp(endpoint,payload,{fetchImpl:async()=>{throw new TypeError('Network error');}}),e=>e.uncertain);
 await assert.rejects(submitRsvp(endpoint,payload,{timeoutMs:5,fetchImpl:(_,o)=>new Promise((resolve,reject)=>o.signal.addEventListener('abort',()=>reject(new Error('aborted'))))}),e=>e.uncertain);
});

function backend({failAfterWrite=false,busy=false}={}) {
 const headers=['Timestamp','Guest / family name','Attending','Number attending','Guest names','Dietary needs','Message','Request ID'];
 const rows=[headers]; let released=false,fail=failAfterWrite;
 const sheet={getLastRow:()=>rows.length,appendRow:row=>rows.push(row),getRange:(row,col)=>({
  getValues:()=>[headers],createTextFinder:id=>{const finder={matchEntireCell:()=>finder,matchCase:()=>finder,useRegularExpression:()=>finder,findNext:()=>rows.slice(1).find(r=>r[7].toLowerCase()===id.toLowerCase())||null};return finder;}
 })};
 const context=vm.createContext({Date,ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})},PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'fake-sheet-id'})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush:()=>{if(fail){fail=false;throw new Error('interrupted after write');}}},LockService:{getScriptLock:()=>({tryLock:()=>!busy,hasLock:()=>!busy,releaseLock:()=>{released=true;}})}});
 vm.runInContext(readFileSync(new URL('../google-apps-script/Code.gs',import.meta.url),'utf8'),context);
 return {context,rows,post:(data=payload)=>context.doPost({parameter:data,postData:{length:JSON.stringify(data).length}}),released:()=>released};
}
test('Apps Script saves all fields and deduplicates retries by request ID',()=>{
 const b=backend();assert.equal(b.post().ok,true);assert.equal(b.rows.length,2);assert.equal(b.rows[1][3],3);assert.equal(b.released(),true);
 assert.equal(b.post().duplicate,true);assert.equal(b.rows.length,2);
});
test('Apps Script neutralizes spreadsheet formulas and validates untrusted inputs',()=>{
 const b=backend();assert.equal(b.post({...payload,familyName:'=HYPERLINK("x")',message:' +SUM(1,2)'}).ok,true);
 assert.ok(b.rows[1][1].startsWith("'="));assert.ok(b.rows[1][6].startsWith("'+"));
 for(const patch of [{website:'spam'},{requestId:'bad'},{familyName:''},{attending:'maybe'},{count:11},{count:1.2},{message:'a'.repeat(1501)},{familyName:'bad\u0000name'}]) assert.equal(backend().post({...payload,...patch}).code,'INVALID_INPUT');
});
test('Apps Script decline stores zero guests and clears attendance details',()=>{
 const b=backend(); assert.equal(b.post({...payload,attending:'no'}).ok,true); assert.equal(b.rows[1][3],0);assert.equal(b.rows[1][4],'');assert.equal(b.rows[1][5],'');
});
test('Apps Script handles concurrent lock failure and write-then-error retry safely',()=>{
 const locked=backend({busy:true});assert.equal(locked.post().code,'TRY_AGAIN');assert.equal(locked.rows.length,1);
 const b=backend({failAfterWrite:true});assert.equal(b.post().ok,false);assert.equal(b.rows.length,2);assert.equal(b.post().ok,true);assert.equal(b.rows.length,2);
});
test('public health response never includes guest data',()=>{
 const b=backend();b.post();const health=b.context.doGet();assert.equal(health.ok,true);assert.ok(!JSON.stringify(health).includes(payload.familyName));
});

test('Google Forms uses the supplied responder URL and a responsive embed URL',()=>{
 const urls=googleFormLinks(CONFIG.googleFormUrl);
 assert.ok(urls.direct.endsWith('/viewform'));
 assert.equal(new URL(urls.embed).searchParams.get('embedded'),'true');
 assert.deepEqual(googleFormLinks(urls.embed),urls);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(html.includes(`src="${urls.embed}"`));
 assert.ok(html.includes('id="custom-rsvp" hidden'));
});
test('Google Forms configuration rejects unrelated sites and editor URLs',()=>{
 for(const url of ['javascript:alert(1)','https://example.com/forms/d/e/id/viewform','https://docs.google.com/forms/d/id/edit']) assert.throws(()=>googleFormLinks(url));
});
