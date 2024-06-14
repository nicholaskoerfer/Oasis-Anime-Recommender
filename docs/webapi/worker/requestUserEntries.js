let db,windowHREF,isShowingProgress,isShowingProgressTimeout;self.addEventListener("unhandledrejection",event=>{console.error(event?.reason);self.postMessage({error:event?.reason||"Something went wrong"})});self.onmessage=async({data})=>{if(!windowHREF){windowHREF=data?.windowHREF}if(!db)await IDBinit();let username=data?.username;let visibilityChange=data?.visibilityChange??false;let userAnimeUpdateAt=await retrieveJSON("userAnimeUpdateAt");let userData=await retrieveJSON("userData");let savedUsername=userData?.username??await retrieveJSON("username");let userEntriesLen=((userData?.userEntries??await retrieveJSON("userEntries"))||[]).length;let retryCount=0;if(typeof savedUsername==="string"&&userEntriesLen<1){username=savedUsername;getUserEntries()}else if(typeof savedUsername==="string"&&userEntriesLen>0&&(username===savedUsername||!username)){username=savedUsername;recallUE()}else if(typeof username==="string"&&username!==savedUsername){getUserEntries()}else{self.postMessage({message:"No Anilist Username Found"})}function recallUE(){if(typeof userAnimeUpdateAt==="number"&&!isNaN(userAnimeUpdateAt)){if(retryCount<2&&!visibilityChange){self.postMessage({status:"Checking Latest User Entries"})}fetch("https://graphql.anilist.co",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json","Cache-Control":"max-age=31536000, immutable"},body:JSON.stringify({query:`{User(name:"${username}"){updatedAt}}`})}).then(async response=>{return await response.json()}).then(result=>{let error;if(typeof(error=result?.errors?.[0]?.message)==="string"){self.postMessage({status:error||"Failed to check entries"});self.postMessage({error:error})}else{let currentUserAnimeUpdateAt=result?.data?.User?.updatedAt;if(typeof currentUserAnimeUpdateAt==="number"&&!isNaN(currentUserAnimeUpdateAt)){if(currentUserAnimeUpdateAt!==userAnimeUpdateAt){self.postMessage({status:"Found latest User Entries"});getUserEntries()}else{self.postMessage({status:null});self.postMessage({message:"User Entries is Up to Date"})}}}}).catch(async error=>{if(!await isConnected()){self.postMessage({status:"Server unreachable"});self.postMessage({error:"Server unreachable"});return}let headers=error.headers;let errorText=error.message;if(errorText==="User not found"||errorText==="Private User"){self.postMessage({status:errorText});self.postMessage({error:errorText})}else{if(headers?.get("x-ratelimit-remaining")>0){return recallUE()}else{++retryCount;if(retryCount>=2){self.postMessage({status:"Request Timeout"})}let rateLimitInterval;if(retryCount<2){let secondsPassed=60;rateLimitInterval=setInterval(()=>{self.postMessage({status:`Rate Limit: ${msToTime(secondsPassed*1e3)}`});--secondsPassed},1e3)}setTimeout(()=>{if(rateLimitInterval)clearInterval(rateLimitInterval);self.postMessage({status:"Retrying"});return recallUE()},6e4)}}console.error(error)})}else{getUserEntries()}}function getUserEntries(){let userEntries=[];let maxAnimePerChunk=500;let currentUserAnimeUpdate;if(retryCount<2){self.postMessage({status:"Getting User Entries"})}function recallAV(chunk){fetch("https://graphql.anilist.co",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json","Cache-Control":"max-age=31536000, immutable"},body:JSON.stringify({query:`{MediaListCollection(userName:"${username}",${chunk>1?"chunk:"+chunk+",perChunk:"+maxAnimePerChunk+",":""}forceSingleCompletedList:true,type:ANIME){hasNextChunk lists{entries{status media{id}score progress}}user{updatedAt}}m:MediaListCollection(userName:"${username}",${chunk>1?"chunk:"+chunk+",perChunk:"+maxAnimePerChunk+",":""}forceSingleCompletedList:true,type:MANGA){hasNextChunk lists{entries{status media{id}score progress progressVolumes}}user{updatedAt}}}`})}).then(async response=>{let headers=response.headers;let result=await response.json();return{result:result,headers:headers}}).then(({result,headers})=>{let error;if(typeof(error=result?.errors?.[0]?.message)==="string"){self.postMessage({status:error||"Failed to retrieve entries."});self.postMessage({error:error})}else{let animeCollection=result?.data?.MediaListCollection;let mangaCollection=result?.data?.m;if(typeof currentUserAnimeUpdate!=="number"||isNaN(currentUserAnimeUpdate)){currentUserAnimeUpdate=animeCollection?.user?.updatedAt||mangaCollection?.user?.updatedAt}let userList=[];if(animeCollection?.lists){userList=animeCollection?.lists??[]}if(mangaCollection?.lists){userList=userList.concat(mangaCollection?.lists??[])}for(let i=0;i<userList.length;i++){userEntries=userEntries.concat(userList[i]?.entries??[])}retryCount=0;let hasNextChunk=animeCollection?.hasNextChunk||mangaCollection?.hasNextChunk;if(hasNextChunk&&(userList?.length??0)>0){if(!isShowingProgress){isShowingProgress=true;isShowingProgressTimeout=setTimeout(()=>{self.postMessage({status:`${userEntries.length} User ${userEntries.length>1?"Entries":"Entry"} has been added`});isShowingProgress=false},16)}if(headers?.get("x-ratelimit-remaining")>0){return recallAV(++chunk)}else{let secondsPassed=60;let rateLimitInterval=setInterval(()=>{self.postMessage({status:`Rate Limit: ${msToTime(secondsPassed*1e3)}`});--secondsPassed},1e3);setTimeout(()=>{clearInterval(rateLimitInterval);return recallAV(++chunk)},6e4)}}else{(async()=>{clearTimeout(isShowingProgressTimeout);isShowingProgress=false;self.postMessage({status:`${userEntries.length} User ${userEntries.length>1?"Entries":"Entry"} has been added`});isShowingProgress=false;await saveJSON(true,"shouldProcessRecommendation");const animeEntries=await retrieveJSON("animeEntries");await saveJSON({username:username,userEntries:userEntries.reduce((result,entry)=>{let userAnimeID=entry?.media?.id;let userEntry={};if(userAnimeID&&animeEntries[userAnimeID]){userEntry.media=animeEntries[userAnimeID];userEntry.status=entry?.status;userEntry.score=entry?.score;userEntry.progress=entry?.progress;userEntry.progressVolumes=entry?.progressVolumes;result.push(userEntry)}return result},[])},"userData");if(typeof currentUserAnimeUpdate==="number"&&!isNaN(currentUserAnimeUpdate)){await saveJSON(currentUserAnimeUpdate,"userAnimeUpdateAt")}self.postMessage({status:null});self.postMessage({updateRecommendationList:true});self.postMessage({newusername:username})})()}}}).catch(async error=>{clearTimeout(isShowingProgressTimeout);isShowingProgress=false;if(!await isConnected()){self.postMessage({status:"Server unreachable"});self.postMessage({error:"Server unreachable",showToUser:true});return}let headers=error.headers;let errorText=error.message;if(errorText==="User not found"||errorText==="Private User"){self.postMessage({status:errorText});self.postMessage({error:errorText})}else{if(headers?.get("x-ratelimit-remaining")>0){return recallAV(chunk)}else{++retryCount;if(retryCount>=2){self.postMessage({status:"Request Timeout"})}let rateLimitInterval;if(retryCount<2){let secondsPassed=60;rateLimitInterval=setInterval(()=>{self.postMessage({status:`Rate Limit: ${msToTime(secondsPassed*1e3)}`});--secondsPassed},1e3)}setTimeout(()=>{if(rateLimitInterval)clearInterval(rateLimitInterval);self.postMessage({status:"Retrying"});return recallAV(chunk)},6e4)}}console.error(error)})}recallAV(1)}};async function IDBinit(){return await new Promise(resolve=>{let request=indexedDB.open("Kanshi.Anime.Recommendations.Anilist.W~uPtWCq=vG$TR:Zl^#t<vdS]I~N70",1);request.onerror=error=>{console.error(error)};request.onsuccess=event=>{db=event.target.result;return resolve()};request.onupgradeneeded=event=>{db=event.target.result;db.createObjectStore("MyObjectStore");let transaction=event.target.transaction;transaction.oncomplete=()=>{return resolve()}}})}async function saveJSON(data,name){return await new Promise(async(resolve,reject)=>{try{let write=db.transaction("MyObjectStore","readwrite").objectStore("MyObjectStore").openCursor();write.onsuccess=async()=>{let put=await db.transaction("MyObjectStore","readwrite").objectStore("MyObjectStore").put(data,name);put.onsuccess=()=>{return resolve()};put.onerror=()=>{return resolve()}};write.onerror=async error=>{console.error(error);return reject()}}catch(ex){console.error(ex)}})}async function retrieveJSON(name){return await new Promise(resolve=>{try{let read=db.transaction("MyObjectStore","readwrite").objectStore("MyObjectStore").get(name);read.onsuccess=()=>{return resolve(read.result)};read.onerror=error=>{console.error(error);return resolve()}}catch(ex){console.error(ex);return resolve()}})}function msToTime(duration,limit){try{if(duration<1e3){return"0s"}let seconds=Math.floor(duration/1e3%60),minutes=Math.floor(duration/6e4%60),hours=Math.floor(duration/36e5%24),days=Math.floor(duration/864e5%7),weeks=Math.floor(duration/6048e5%4),months=Math.floor(duration/24192e5%12),years=Math.floor(duration/290304e5%10),decades=Math.floor(duration/290304e6%10),century=Math.floor(duration/290304e7%10),millenium=Math.floor(duration/290304e8%10);let time=[];if(millenium>0)time.push(`${millenium}mil`);if(century>0)time.push(`${century}cen`);if(decades>0)time.push(`${decades}dec`);if(years>0)time.push(`${years}y`);if(months>0)time.push(`${months}mon`);if(weeks>0)time.push(`${weeks}w`);if(days>0)time.push(`${days}d`);if(hours>0)time.push(`${hours}h`);if(minutes>0)time.push(`${minutes}m`);if(seconds>0)time.push(`${seconds}s`);if(limit>0){time=time.slice(0,limit)}return time.join(" ")||"0s"}catch(e){return""}}let isConnectedPromise;async function isConnected(){if(isConnectedPromise)return isConnectedPromise;isConnectedPromise=new Promise(async resolve=>{try{if(navigator?.onLine!==false){let href=windowHREF||"https://u-kuro.github.io/Kanshi-Anime-Recommender";let response=await fetch(href,{method:"HEAD",cache:"no-store"});isConnectedPromise=null;resolve(response?.ok)}isConnectedPromise=null;resolve(false)}catch(error){isConnectedPromise=null;resolve(false)}});return isConnectedPromise}