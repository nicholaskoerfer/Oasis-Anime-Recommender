let request,db,isShowingProgress;self.onmessage=async({data})=>{if(!db){await IDBinit()}self.postMessage({status:"Exporting User Data"});if(data==="android"){self.postMessage({state:0})}const userData=await retrieveJSON("userData");let username=userData?.username;const userList=await retrieveJSON("userList");const excludedEntries=await retrieveJSON("excludedEntries");const animeEntries=await retrieveJSON("animeEntries");if(!isJsonObject(userList)||jsonIsEmpty(userList)||(!isJsonObject(excludedEntries)||jsonIsEmpty(excludedEntries))||(!isJsonObject(animeEntries)||jsonIsEmpty(animeEntries))){self.postMessage({missingData:true});return}let backUpData={userData:userData??{username:username,userEntries:await retrieveJSON("userEntries")},animeUpdateAt:await retrieveJSON("animeUpdateAt"),airingAnimeUpdateAt:await retrieveJSON("airingAnimeUpdateAt"),userAnimeUpdateAt:await retrieveJSON("userAnimeUpdateAt"),tagInfo:await retrieveJSON("tagInfo"),userList:userList,excludedEntries:excludedEntries,animeEntries:animeEntries};self.postMessage({progress:0});let maxRecursion=0;function countRecursiveCalls(x){maxRecursion++;if(isJsonObject(x)){for(const value of Object.values(x)){if(value===undefined)continue;if(isJsonObject(value)||value instanceof Array){countRecursiveCalls(value)}}}else if(x instanceof Array){for(let i=0,l=x.length;i<l;i++){let value=x[i];if(isJsonObject(value)||value instanceof Array){countRecursiveCalls(value)}}}}countRecursiveCalls(backUpData);if(data==="android"){const byteSize=64*1024;let chunkStr="";let completedRecursionCalls=0;function stringify(x){if(chunkStr.length>=byteSize){self.postMessage({chunk:chunkStr,state:1});chunkStr=""}completedRecursionCalls++;if(!isShowingProgress){isShowingProgress=true;setTimeout(()=>{self.postMessage({progress:completedRecursionCalls/maxRecursion*100});isShowingProgress=false},17)}let first=true;if(isJsonObject(x)){chunkStr+="{";for(const[k,v]of Object.entries(x)){if(v===undefined)continue;if(isJsonObject(v)||v instanceof Array){if(first){first=false;chunkStr+=`${JSON.stringify(k)}:`}else{chunkStr+=`,${JSON.stringify(k)}:`}stringify(v)}else{if(first){first=false;chunkStr+=`${JSON.stringify(k)}:${JSON.stringify(v)}`}else{chunkStr+=`,${JSON.stringify(k)}:${JSON.stringify(v)}`}}}chunkStr+="}"}else if(x instanceof Array){chunkStr+="[";for(let i=0,l=x.length;i<l;i++){let v=x[i];if(isJsonObject(v)||v instanceof Array){if(first){first=false}else{chunkStr+=","}stringify(v)}else{if(first){first=false;chunkStr+=JSON.stringify(v)}else{chunkStr+=`,${JSON.stringify(v)}`}}}chunkStr+="]"}return}stringify(backUpData);await saveJSON(new Date,"lastRunnedAutoExportDate");self.postMessage({status:null});self.postMessage({chunk:chunkStr||"",state:2,username:username})}else{let blob=JSONToBlob(backUpData,maxRecursion);let url=URL.createObjectURL(blob);await saveJSON(new Date,"lastRunnedAutoExportDate");self.postMessage({status:"Data has been Exported"});self.postMessage({progress:100});self.postMessage({status:null});self.postMessage({url:url,username:username})}};function isJsonObject(obj){return Object.prototype.toString.call(obj)==="[object Object]"}const jsonIsEmpty=obj=>{for(const key in obj){return false}return true};async function IDBinit(){return await new Promise(resolve=>{let request=indexedDB.open("Kanshi.Anime.Recommendations.Anilist.W~uPtWCq=vG$TR:Zl^#t<vdS]I~N70",1);request.onerror=error=>{console.error(error)};request.onsuccess=event=>{db=event.target.result;return resolve()};request.onupgradeneeded=event=>{db=event.target.result;db.createObjectStore("MyObjectStore");let transaction=event.target.transaction;transaction.oncomplete=()=>{return resolve()}}})}async function retrieveJSON(name){return await new Promise(resolve=>{try{let read=db.transaction("MyObjectStore","readwrite").objectStore("MyObjectStore").get(name);read.onsuccess=()=>{return resolve(read.result)};read.onerror=error=>{console.error(error);return resolve()}}catch(ex){console.error(ex);return resolve()}})}async function saveJSON(data,name){return await new Promise(async(resolve,reject)=>{try{let write=db.transaction("MyObjectStore","readwrite").objectStore("MyObjectStore").openCursor();write.onsuccess=async event=>{let put=await db.transaction("MyObjectStore","readwrite").objectStore("MyObjectStore").put(data,name);put.onsuccess=event=>{return resolve()};put.onerror=event=>{return resolve()}};write.onerror=async error=>{console.error(error);return reject()}}catch(ex){console.error(ex)}})}function JSONToBlob(object,_maxRecursion){let propertyStrings=[];let chunkStr="";const maxRecursion=_maxRecursion;const maxByteSize=4*1024*1024;function isJsonObject(obj){return Object.prototype.toString.call(obj)==="[object Object]"}let completedRecursionCalls=0;function bloberize(x){if(chunkStr.length>=maxByteSize){const propertyBlob=new Blob([chunkStr],{type:"text/plain"});propertyStrings.push(propertyBlob);chunkStr=""}completedRecursionCalls++;if(!isShowingProgress){isShowingProgress=true;setTimeout(()=>{self.postMessage({progress:completedRecursionCalls/maxRecursion*100});isShowingProgress=false},17)}let first=true;if(isJsonObject(x)){chunkStr+="{";for(let[k,v]of Object.entries(x)){if(v===undefined)continue;if(isJsonObject(v)||v instanceof Array){if(first){first=false;chunkStr+=`${JSON.stringify(k)}:`}else{chunkStr+=`,${JSON.stringify(k)}:`}bloberize(v)}else{if(first){first=false;chunkStr+=`${JSON.stringify(k)}:${JSON.stringify(v)}`}else{chunkStr+=`,${JSON.stringify(k)}:${JSON.stringify(v)}`}}}chunkStr+="}"}else if(x instanceof Array){chunkStr+="[";for(let i=0,l=x.length;i<l;i++){let v=x[i];if(isJsonObject(v)||v instanceof Array){if(first){first=false}else{chunkStr+=","}bloberize(v)}else{if(first){first=false;chunkStr+=JSON.stringify(v)}else{chunkStr+=`,${JSON.stringify(v)}`}}}chunkStr+="]"}}bloberize(object);const propertyBlob=new Blob([chunkStr],{type:"text/plain"});propertyStrings.push(propertyBlob);chunkStr="";return new Blob(propertyStrings,{type:"application/json"})}