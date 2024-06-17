let request,db;const maxByteSize=64*1024;self.addEventListener("unhandledrejection",event=>{console.error(event?.reason);self.postMessage({error:event?.reason||"Something went wrong"})});self.onmessage=async({data})=>{if(!db){await IDBinit()}self.postMessage({status:"Exporting User Data"});if(data==="android"){self.postMessage({state:0})}const userData=await retrieveJSON("userData");let username;if(userData?.userEntries instanceof Array&&userData?.userEntries?.length>0){username=userData?.username}const userList=await retrieveJSON("userList");const excludedEntries=await retrieveJSON("excludedEntries");const animeEntries=await retrieveJSON("animeEntries");if(!isJsonObject(userList)||jsonIsEmpty(userList)||(!isJsonObject(excludedEntries)||jsonIsEmpty(excludedEntries))||(!isJsonObject(animeEntries)||jsonIsEmpty(animeEntries))){self.postMessage({missingData:true});return}let backUpData={userData:userData,animeUpdateAt:await retrieveJSON("animeUpdateAt"),userAnimeUpdateAt:await retrieveJSON("userAnimeUpdateAt"),tagInfo:await retrieveJSON("tagInfo"),userList:userList,algorithmFilters:await retrieveJSON("algorithmFilters"),entriesVersion:await retrieveJSON("entriesVersion"),excludedEntries:excludedEntries,animeEntries:animeEntries};self.postMessage({progress:0});let maxRecursion=0;function countRecursiveCalls(x){maxRecursion++;if(isJsonObject(x)){for(const value of Object.values(x)){if(value===undefined)continue;if(isJsonObject(value)||value instanceof Array){countRecursiveCalls(value)}}}else if(x instanceof Array){for(let i=0,l=x.length;i<l;i++){let value=x[i];if(isJsonObject(value)||value instanceof Array){countRecursiveCalls(value)}}}}countRecursiveCalls(backUpData);if(data==="android"){let chunkStr="";let completedRecursionCalls=0;let startPost=performance.now();function stringify(x){if(chunkStr.length>=maxByteSize){const endPost=performance.now();if(endPost-startPost>17){startPost=endPost;self.postMessage({chunk:chunkStr,state:1});chunkStr="";let progress=completedRecursionCalls/maxRecursion;if(progress<.9763){progress=progress*100;self.postMessage({progress:progress});if(progress>.01){self.postMessage({status:`${progress.toFixed(2)}% Exporting User Data`})}}}}completedRecursionCalls++;let first=true;if(isJsonObject(x)){chunkStr+="{";for(const[k,v]of Object.entries(x)){if(v===undefined)continue;if(isJsonObject(v)||v instanceof Array){if(first){first=false;chunkStr+=`${JSON.stringify(k)}:`}else{chunkStr+=`,${JSON.stringify(k)}:`}stringify(v)}else{if(first){first=false;chunkStr+=`${JSON.stringify(k)}:${JSON.stringify(v)}`}else{chunkStr+=`,${JSON.stringify(k)}:${JSON.stringify(v)}`}}}chunkStr+="}"}else if(x instanceof Array){chunkStr+="[";for(let i=0,l=x.length;i<l;i++){let v=x[i];if(isJsonObject(v)||v instanceof Array){if(first){first=false}else{chunkStr+=","}stringify(v)}else{if(first){first=false;chunkStr+=JSON.stringify(v)}else{chunkStr+=`,${JSON.stringify(v)}`}}}chunkStr+="]"}return}stringify(backUpData);const firstTimeout=Math.max(performance.now()-startPost,0);if(chunkStr.length>0){const strChunkLeft=splitString(chunkStr,maxByteSize);const strChunkLeftLen=strChunkLeft.length;for(let i=0;i<strChunkLeftLen;i++){const isLast=i>=strChunkLeftLen-1;if(isLast){self.postMessage({status:null});await saveJSON((new Date).getTime(),"runnedAutoExportAt")}if(i===0){setTimeout(async()=>{const message={chunk:strChunkLeft[i]};if(isLast){message.state=2;message.username=username}else{message.state=1}self.postMessage(message)},Math.min(firstTimeout,2e9))}else{setTimeout(async()=>{const message={chunk:strChunkLeft[i]};if(isLast){message.state=2;message.username=username}else{message.state=1}self.postMessage(message)},Math.min(firstTimeout+i*17,2e9))}}}else{await saveJSON((new Date).getTime(),"runnedAutoExportAt");setTimeout(async()=>{self.postMessage({status:null});self.postMessage({chunk:"",state:2,username:username})},Math.min(firstTimeout,2e9))}}else{let blob=JSONToBlob(backUpData,maxRecursion);let url=URL.createObjectURL(blob);await saveJSON((new Date).getTime(),"runnedAutoExportAt");self.postMessage({status:"Data has been Exported"});self.postMessage({progress:100});self.postMessage({status:null});self.postMessage({url:url,username:username})}};function isJsonObject(obj){return Object.prototype.toString.call(obj)==="[object Object]"}const jsonIsEmpty=obj=>{for(const key in obj){return false}return true};async function IDBinit(){return await new Promise(resolve=>{let request=indexedDB.open("Kanshi.Anime.Recommendations.Anilist.W~uPtWCq=vG$TR:Zl^#t<vdS]I~N70",1);request.onerror=error=>{console.error(error)};request.onsuccess=event=>{db=event.target.result;return resolve()};request.onupgradeneeded=event=>{db=event.target.result;db.createObjectStore("MyObjectStore");let transaction=event.target.transaction;transaction.oncomplete=()=>{return resolve()}}})}async function retrieveJSON(name){return await new Promise(resolve=>{try{let read=db.transaction("MyObjectStore","readwrite").objectStore("MyObjectStore").get(name);read.onsuccess=()=>{return resolve(read.result)};read.onerror=error=>{console.error(error);return resolve()}}catch(ex){console.error(ex);return resolve()}})}async function saveJSON(data,name){return await new Promise(async(resolve,reject)=>{try{let write=db.transaction("MyObjectStore","readwrite").objectStore("MyObjectStore").openCursor();write.onsuccess=async event=>{let put=await db.transaction("MyObjectStore","readwrite").objectStore("MyObjectStore").put(data,name);put.onsuccess=event=>{return resolve()};put.onerror=event=>{return resolve()}};write.onerror=async error=>{console.error(error);return reject()}}catch(ex){console.error(ex)}})}function JSONToBlob(object,_maxRecursion){let propertyStrings=[];let chunkStr="";const maxRecursion=_maxRecursion;function isJsonObject(obj){return Object.prototype.toString.call(obj)==="[object Object]"}let completedRecursionCalls=0;let startPost=performance.now();function bloberize(x){if(chunkStr.length>=maxByteSize){const propertyBlob=new Blob([chunkStr]);propertyStrings.push(propertyBlob);chunkStr="";let progress=completedRecursionCalls/maxRecursion;if(progress<.9763){const endPost=performance.now();if(endPost-startPost>17){startPost=endPost;progress=progress*100;self.postMessage({progress:progress});if(progress>.01){self.postMessage({status:`${progress.toFixed(2)}% Exporting User Data`})}}}}completedRecursionCalls++;let first=true;if(isJsonObject(x)){chunkStr+="{";for(let[k,v]of Object.entries(x)){if(v===undefined)continue;if(isJsonObject(v)||v instanceof Array){if(first){first=false;chunkStr+=`${JSON.stringify(k)}:`}else{chunkStr+=`,${JSON.stringify(k)}:`}bloberize(v)}else{if(first){first=false;chunkStr+=`${JSON.stringify(k)}:${JSON.stringify(v)}`}else{chunkStr+=`,${JSON.stringify(k)}:${JSON.stringify(v)}`}}}chunkStr+="}"}else if(x instanceof Array){chunkStr+="[";for(let i=0,l=x.length;i<l;i++){let v=x[i];if(isJsonObject(v)||v instanceof Array){if(first){first=false}else{chunkStr+=","}bloberize(v)}else{if(first){first=false;chunkStr+=JSON.stringify(v)}else{chunkStr+=`,${JSON.stringify(v)}`}}}chunkStr+="]"}}bloberize(object);const propertyBlob=new Blob([chunkStr],{type:"text/plain"});propertyStrings.push(propertyBlob);chunkStr="";return new Blob(propertyStrings,{type:"application/json"})}function splitString(str,len){const result=[];let i=0;while(i<str.length){result.push(str.substring(i,i+len));i+=len}return result}