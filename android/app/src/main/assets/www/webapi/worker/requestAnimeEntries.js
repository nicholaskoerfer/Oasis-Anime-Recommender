let db,windowHREF,isShowingProgress,isShowingProgressTimeout;const entriesVersion=2;const maxArraySize=65535;const maxAnimePerPage=50;const maxStaffPerPage=25;const excludedFormats={music:true};const animeFormats={tv:true,tv_short:true,movie:true,special:true,ova:true,ona:true};const currentRequestTimestamp=(new Date).getTime();let newAddedEntriesCount=0,lastAddedEntriesCount=0;let newEditedEntriesCount=0,lastEditedEntriesCount=0;let minimizeTransaction=false;let currentYear;let onlyGetNewEntries;let retryCount;let willProcessList;self.onmessage=async({data})=>{if(!db)await IDBinit();if(!windowHREF){windowHREF=data?.windowHREF}if(data?.hasOwnProperty("minimizeTransaction")){minimizeTransaction=data?.minimizeTransaction}else{currentYear=(new Date).getFullYear();onlyGetNewEntries=data?.onlyGetNewEntries??false;retryCount=0;let animeUpdateAt=await retrieveJSON("animeUpdateAt")||1706674120;let airingAnimeUpdateAt=await retrieveJSON("airingAnimeUpdateAt")||animeUpdateAt;let animeEntries=await retrieveJSON("animeEntries");let excludedEntries=await retrieveJSON("excludedEntries")||{};willProcessList=false;if(isJsonObject(animeEntries)){if(jsonIsEmpty(animeEntries)){self.postMessage({getEntries:true})}else{getNewEntries(animeEntries,excludedEntries,animeUpdateAt,airingAnimeUpdateAt)}}else{self.postMessage({noEntriesFound:true})}}async function getNewEntries(animeEntries,excludedEntries,animeUpdateAt,airingAnimeUpdateAt){self.postMessage({progress:0});const lastHighestID=Math.max(getMax(Object.keys(animeEntries).concat(Object.keys(excludedEntries)).map(id=>parseInt(id)))||0,0);let percentage,newLowestID,newHighestID,largestDif;self.postMessage({status:"Checking New Entries"});let shouldProcessList;function recallGNE(page){fetch("https://graphql.anilist.co",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json","Cache-Control":"max-age=31536000, immutable"},body:JSON.stringify({query:`{Page(page:${page},perPage:${maxAnimePerPage}){pageInfo{hasNextPage}media(sort:ID_DESC){id updatedAt title{romaji english userPreferred}relations{edges{relationType(version:2)node{id popularity}}}description siteUrl averageScore episodes chapters volumes countryOfOrigin duration trending popularity favourites format genres status(version:2)coverImage{large}trailer{id thumbnail site}bannerImage tags{name rank category}studios{edges{node{name siteUrl isAnimationStudio}isMain}}startDate{month day year}endDate{month day year}seasonYear season staff(perPage:${maxStaffPerPage},page:1,sort:RELEVANCE){edges{node{name{userPreferred}siteUrl}role}}nextAiringEpisode{episode airingAt}}}}`})}).then(async response=>{let headers=response.headers;let result=await response.json();return{result:result,headers:headers}}).then(async({result,headers})=>{let error;if(typeof(error=result?.errors?.[0]?.message)==="string"){if(onlyGetNewEntries){self.postMessage({errorDuringInit:true})}++retryCount;if(retryCount>=2){clearTimeout(isShowingProgressTimeout);isShowingProgress=false;self.postMessage({status:"Request Timeout"})}let rateLimitInterval;if(retryCount<2){let secondsPassed=60;rateLimitInterval=setInterval(()=>{self.postMessage({progress:(60-secondsPassed)/60*100});self.postMessage({status:(error?error+" ":"")+`Rate Limit: ${msToTime(secondsPassed*1e3)}`});--secondsPassed},1e3)}setTimeout(()=>{if(rateLimitInterval)clearInterval(rateLimitInterval);self.postMessage({progress:100});self.postMessage({status:"Retrying"});return recallGNE(page)},6e4)}else{let Page=result?.data?.Page;let media=Page?.media||[];let hasUpdatedEntry=false;let hasExcludedEntry=false;if(media instanceof Array&&media.length){for(let anime of media){if(typeof anime?.id==="number"){let currentId=anime.id;if(newHighestID==null||currentId>newHighestID){newHighestID=currentId;if(largestDif==null){largestDif=newHighestID-lastHighestID}else{largestDif=Math.max(largestDif,newHighestID-lastHighestID)}}if(newLowestID==null||currentId<newLowestID){newLowestID=currentId;if(lastHighestID>=newLowestID&&newLowestID&&lastHighestID){break}else if(newHighestID&&lastHighestID<=newLowestID&&newHighestID>newLowestID){percentage=(largestDif-(newLowestID-lastHighestID))/largestDif*100}}if((typeof anime?.format!=="string"||!excludedFormats[anime?.format?.trim?.()?.toLowerCase?.()])&&!anime?.genres?.some?.(genre=>genre?.trim?.()?.toLowerCase?.()==="hentai")){if(anime?.genres instanceof Array){let unique={};anime.genres=anime.genres.filter(genre=>{if(genre&&!unique[genre]){unique[genre]=true;return true}else{return false}})}if(anime?.tags instanceof Array){let unique={};anime.tags=anime.tags.filter(tag=>{let _tag=tag?.name;if(_tag&&!unique[_tag]){unique[_tag]=true;return true}else{return false}})}if(anime?.studios?.edges instanceof Array){let unique={};anime.studios.edges=anime.studios.edges.filter(studio=>{let _studio=studio?.node?.name;if(_studio&&!unique[_studio]){unique[_studio]=true;return true}else{return false}})}let isIncludedInAnimeEntries=isJsonObject(animeEntries?.[anime.id]);if(excludedEntries?.hasOwnProperty?.(anime.id)){delete excludedEntries[anime.id];hasExcludedEntry=true}else if(isIncludedInAnimeEntries){continue}else if(animeFormats[anime?.format?.trim?.()?.toLowerCase?.()]){++newAddedEntriesCount}animeEntries[anime.id]=anime;hasUpdatedEntry=true}else{if(animeEntries?.hasOwnProperty?.(anime.id)){delete animeEntries[anime.id];hasUpdatedEntry=true}excludedEntries[anime.id]=1;hasExcludedEntry=true}}}}retryCount=0;shouldProcessList=shouldProcessList||hasUpdatedEntry;let hasNextPage=Page?.pageInfo?.hasNextPage??true;if(newLowestID>lastHighestID&&hasNextPage&&media.length>0){if(!isShowingProgress){isShowingProgress=true;isShowingProgressTimeout=setTimeout(()=>{if(percentage>=.01){self.postMessage({status:`${percentage.toFixed(2)}% Adding New Entries`})}else{self.postMessage({status:`Adding New Entries`})}self.postMessage({progress:percentage});isShowingProgress=false},16)}if(!minimizeTransaction){if(hasUpdatedEntry){if(!willProcessList){willProcessList=true;await saveJSON(true,"shouldProcessRecommendation")}await saveJSON(animeEntries,"animeEntries")}if(hasExcludedEntry){await saveJSON(excludedEntries,"excludedEntries")}}if(headers?.get("x-ratelimit-remaining")>0){return recallGNE(++page)}else{if(onlyGetNewEntries){self.postMessage({errorDuringInit:true})}let secondsPassed=60;let rateLimitInterval=setInterval(()=>{self.postMessage({progress:(60-secondsPassed)/60*100});self.postMessage({status:`Rate Limit: ${msToTime(secondsPassed*1e3)}`});--secondsPassed},1e3);setTimeout(()=>{clearInterval(rateLimitInterval);self.postMessage({progress:100});self.postMessage({status:"Retrying"});return recallGNE(++page)},6e4)}}else{clearTimeout(isShowingProgressTimeout);isShowingProgress=false;self.postMessage({status:"100% Adding New Entries"});self.postMessage({progress:100});isShowingProgress=false;if(shouldProcessList){if(!willProcessList){willProcessList=true;await saveJSON(true,"shouldProcessRecommendation")}await saveJSON(animeEntries,"animeEntries");self.postMessage({updateRecommendationList:true});shouldProcessList=false}if(hasExcludedEntry){await saveJSON(excludedEntries,"excludedEntries")}if(newAddedEntriesCount>lastAddedEntriesCount){self.postMessage({notifyAddedEntries:newAddedEntriesCount,notifyEditedEntries:newEditedEntriesCount});lastAddedEntriesCount=newAddedEntriesCount}self.postMessage({status:null});if(onlyGetNewEntries){self.postMessage({done:true})}else{updateAiringAnime(animeEntries,excludedEntries,animeUpdateAt,airingAnimeUpdateAt)}}}}).catch(async error=>{clearTimeout(isShowingProgressTimeout);isShowingProgress=false;if(!await isConnected()){self.postMessage({status:"Server unreachable"});self.postMessage({error:"Server unreachable"});return}let headers=error.headers;if(headers?.get("x-ratelimit-remaining")>0){return recallGNE(page)}else{if(onlyGetNewEntries){self.postMessage({errorDuringInit:true})}++retryCount;if(retryCount>=2){self.postMessage({status:"Request Timeout"})}let rateLimitInterval;if(retryCount<2){let secondsPassed=60;rateLimitInterval=setInterval(()=>{self.postMessage({progress:(60-secondsPassed)/60*100});self.postMessage({status:`Rate Limit: ${msToTime(secondsPassed*1e3)}`});--secondsPassed},1e3)}setTimeout(()=>{if(rateLimitInterval)clearInterval(rateLimitInterval);self.postMessage({progress:100});self.postMessage({status:"Retrying"});return recallGNE(page)},6e4)}console.error(error)})}recallGNE(1)}async function updateAiringAnime(animeEntries,excludedEntries,animeUpdateAt,airingAnimeUpdateAt){self.postMessage({progress:0});let airingAnime=Object.values(animeEntries).filter(({seasonYear,status})=>{return ncsCompare(status,"releasing")||ncsCompare(status,"not_yet_released")&&parseInt(seasonYear)>=currentYear});let airingAnimeIDs=airingAnime.map(({id})=>id);let pastAiringEpisodeIDs=airingAnime.filter(anime=>{if(isJsonObject(anime?.nextAiringEpisode)){let releaseDate=new Date(anime?.nextAiringEpisode?.airingAt*1e3);if(releaseDate instanceof Date&&!isNaN(releaseDate)&&releaseDate<=(new Date).getTime()){return true}else{return false}}else{return false}}).map(({id})=>id);const animeLength=airingAnimeIDs.length+pastAiringEpisodeIDs.length;let currentNonProcessedLength=animeLength;const airingAnimeIDsCollection=divideArray(airingAnimeIDs,maxArraySize);const pastAiringEpisodeIDsCollection=divideArray(pastAiringEpisodeIDs,maxArraySize);let airingAnimeIDsCollectionIdx=0;let pastAiringEpisodeIDsCollectionIdx=0;self.postMessage({status:"Checking Latest Entries"});let latestAiringUpdateAt;let shouldProcessList;function recallUAA(page,airingAnimeIDsString){fetch("https://graphql.anilist.co",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json","Cache-Control":"max-age=31536000, immutable"},body:JSON.stringify({query:`{Page(page:${page},perPage:${maxAnimePerPage}){pageInfo{hasNextPage}media(id_in:[${airingAnimeIDsString||""}],sort:UPDATED_AT_DESC){id updatedAt title{romaji english userPreferred}relations{edges{relationType(version:2)node{id popularity}}}description siteUrl averageScore episodes chapters volumes countryOfOrigin duration trending popularity favourites format genres status(version:2)coverImage{large}trailer{id thumbnail site}bannerImage tags{name rank category}studios{edges{node{name siteUrl isAnimationStudio}isMain}}startDate{month day year}endDate{month day year}seasonYear season staff(perPage:${maxStaffPerPage},page:1,sort:RELEVANCE){pageInfo{hasNextPage}edges{node{name{userPreferred}siteUrl}role}}nextAiringEpisode{episode airingAt}}}}`})}).then(async response=>{let headers=response.headers;let result=await response.json();return{result:result,headers:headers}}).then(async({result,headers})=>{let error;if(typeof(error=result?.errors?.[0]?.message)==="string"){++retryCount;if(retryCount>=2){clearTimeout(isShowingProgressTimeout);isShowingProgress=false;self.postMessage({status:"Request Timeout"})}let rateLimitInterval;if(retryCount<2){let secondsPassed=60;rateLimitInterval=setInterval(()=>{self.postMessage({progress:(60-secondsPassed)/60*100});self.postMessage({status:(error?error+" ":"")+`Rate Limit: ${msToTime(secondsPassed*1e3)}`});--secondsPassed},1e3)}setTimeout(()=>{if(rateLimitInterval)clearInterval(rateLimitInterval);self.postMessage({progress:100});self.postMessage({status:"Retrying"});return recallUAA(page,airingAnimeIDsString)},6e4)}else{let Page=result?.data?.Page;let media=Page?.media||[];let currentAnimeUpdateAt;let hasUpdatedEntry=false;let hasExcludedEntry=false;if(media instanceof Array){for(let anime of media){if(typeof anime?.id==="number"){currentAnimeUpdateAt=anime.updatedAt;if(currentAnimeUpdateAt){if(latestAiringUpdateAt==null||currentAnimeUpdateAt>latestAiringUpdateAt){latestAiringUpdateAt=currentAnimeUpdateAt}if(airingAnimeUpdateAt>=currentAnimeUpdateAt&&airingAnimeUpdateAt){break}}airingAnimeIDs=airingAnimeIDs.filter(_id=>_id!==anime.id);if((typeof anime?.format!=="string"||!excludedFormats[anime?.format?.trim?.()?.toLowerCase?.()])&&!anime?.genres?.some?.(genre=>genre?.trim?.()?.toLowerCase?.()==="hentai")){if(anime?.genres instanceof Array){let unique={};anime.genres=anime.genres.filter(genre=>{if(genre&&!unique[genre]){unique[genre]=true;return true}else{return false}})}if(anime?.tags instanceof Array){let unique={};anime.tags=anime.tags.filter(tag=>{let _tag=tag?.name;if(_tag&&!unique[_tag]){unique[_tag]=true;return true}else{return false}})}if(anime?.studios?.edges instanceof Array){let unique={};anime.studios.edges=anime.studios.edges.filter(studio=>{let _studio=studio?.node?.name;if(_studio&&!unique[_studio]){unique[_studio]=true;return true}else{return false}})}let isIncludedInAnimeEntries=isJsonObject(animeEntries?.[anime.id]);if(excludedEntries?.hasOwnProperty?.(anime.id)){delete excludedEntries[anime.id];hasExcludedEntry=true}else if(!isIncludedInAnimeEntries){if(animeFormats[anime?.format?.trim?.()?.toLowerCase?.()]){++newAddedEntriesCount}}else if(isIncludedInAnimeEntries){let isEditedEntry=false;let newCoverImage=anime?.coverImage?.large;if(newCoverImage){let oldCoverImage=animeEntries?.[anime.id]?.coverImage?.large;if(newCoverImage!==oldCoverImage){isEditedEntry=true}}if(!isEditedEntry){let newTrailerId=anime?.trailer?.id;if(newTrailerId){let oldTrailerId=animeEntries?.[anime.id]?.trailer?.id;if(newTrailerId!==oldTrailerId){isEditedEntry=true}}}if(isEditedEntry){if(animeFormats[anime?.format?.trim?.()?.toLowerCase?.()]){++newEditedEntriesCount}anime.dateEdited=currentRequestTimestamp}else if(animeEntries?.[anime.id]?.dateEdited){anime.dateEdited=animeEntries?.[anime.id]?.dateEdited}}if(isIncludedInAnimeEntries){let savedAnime=animeEntries?.[anime.id];let isPossiblyFinished=typeof savedAnime?.nextAiringEpisode?.episode==="number"&&!isNaN(savedAnime?.nextAiringEpisode?.episode)&&savedAnime?.nextAiringEpisode?.episode===savedAnime?.episodes&&typeof savedAnime?.nextAiringEpisode?.airingAt==="number"&&!isNaN(savedAnime?.nextAiringEpisode?.airingAt)&&new Date(savedAnime?.nextAiringEpisode?.airingAt*1e3)<=new Date;let newStatusIsStillReleasing=anime?.status?.toLowerCase?.()==="releasing"&&savedAnime?.status?.toLowerCase?.()==="releasing";let newNextAiringEpisodeIsRemoved=!isJsonObject(anime?.nextAiringEpisode);let dontUpdateNextAiringEpisode=isPossiblyFinished&&newStatusIsStillReleasing&&newNextAiringEpisodeIsRemoved;if(dontUpdateNextAiringEpisode){anime.nextAiringEpisode=savedAnime.nextAiringEpisode}}animeEntries[anime.id]=anime;hasUpdatedEntry=true}else{if(animeEntries?.hasOwnProperty?.(anime.id)){delete animeEntries[anime.id];hasUpdatedEntry=true}excludedEntries[anime.id]=1;hasExcludedEntry=true}}}}retryCount=0;shouldProcessList=shouldProcessList||hasUpdatedEntry;let hasNextPage=Page?.pageInfo?.hasNextPage??true;if(hasNextPage&&media.length>0&&(airingAnimeUpdateAt<currentAnimeUpdateAt||!currentAnimeUpdateAt||!airingAnimeUpdateAt)){if(!minimizeTransaction){if(currentNonProcessedLength>airingAnimeIDs.length+pastAiringEpisodeIDs.length){currentNonProcessedLength=airingAnimeIDs.length+pastAiringEpisodeIDs.length;let processedLength=Math.max(animeLength-currentNonProcessedLength,0);let percentage=100*(processedLength/animeLength);percentage=percentage>=0?percentage:0;if(!isShowingProgress){isShowingProgress=true;isShowingProgressTimeout=setTimeout(()=>{self.postMessage({progress:percentage});self.postMessage({status:`${percentage.toFixed(2)}% Updating Entries`});isShowingProgress=false},16)}}if(hasUpdatedEntry){if(!willProcessList){willProcessList=true;await saveJSON(true,"shouldProcessRecommendation")}await saveJSON(animeEntries,"animeEntries")}if(hasExcludedEntry){await saveJSON(excludedEntries,"excludedEntries")}}if(headers?.get("x-ratelimit-remaining")>0){return recallUAA(++page,airingAnimeIDsString)}else{let secondsPassed=60;let rateLimitInterval=setInterval(()=>{self.postMessage({progress:(60-secondsPassed)/60*100});self.postMessage({status:`Rate Limit: ${msToTime(secondsPassed*1e3)}`});--secondsPassed},1e3);setTimeout(()=>{clearInterval(rateLimitInterval);self.postMessage({progress:100});self.postMessage({status:"Retrying"});return recallUAA(++page,airingAnimeIDsString)},6e4)}}else if(airingAnimeIDsCollection.length-1>airingAnimeIDsCollectionIdx){++airingAnimeIDsCollectionIdx;return recallUAA(1,airingAnimeIDsCollection[airingAnimeIDsCollectionIdx].join(","))}else{clearTimeout(isShowingProgressTimeout);isShowingProgress=false;if(shouldProcessList){if(!willProcessList){willProcessList=true;await saveJSON(true,"shouldProcessRecommendation")}await saveJSON(animeEntries,"animeEntries");self.postMessage({updateRecommendationList:true});shouldProcessList=false}if(hasExcludedEntry){await saveJSON(excludedEntries,"excludedEntries")}if(shouldProcessList&&latestAiringUpdateAt){airingAnimeUpdateAt=latestAiringUpdateAt;await saveJSON(airingAnimeUpdateAt,"airingAnimeUpdateAt")}if(newAddedEntriesCount>lastAddedEntriesCount||newEditedEntriesCount>lastEditedEntriesCount){self.postMessage({notifyAddedEntries:newAddedEntriesCount,notifyEditedEntries:newEditedEntriesCount});lastAddedEntriesCount=newAddedEntriesCount;lastEditedEntriesCount=newEditedEntriesCount}if(pastAiringEpisodeIDs.length>0){self.postMessage({status:null});recallUNAE(1,pastAiringEpisodeIDsCollection[pastAiringEpisodeIDsCollectionIdx].join(","))}else{self.postMessage({progress:100});self.postMessage({status:"100% Updating Entries"});let runnedAutoUpdateAt=(new Date).getTime();await saveJSON(runnedAutoUpdateAt,"runnedAutoUpdateAt");self.postMessage({status:null});updateNonRecentEntries(animeEntries,excludedEntries,animeUpdateAt)}}}}).catch(async error=>{clearTimeout(isShowingProgressTimeout);isShowingProgress=false;if(!await isConnected()){self.postMessage({status:"Server unreachable"});self.postMessage({error:"Server unreachable"});return}let headers=error.headers;if(headers?.get("x-ratelimit-remaining")>0){return recallUAA(page,airingAnimeIDsString)}else{++retryCount;if(retryCount>=2){self.postMessage({status:"Request Timeout"})}let rateLimitInterval;if(retryCount<2){let secondsPassed=60;rateLimitInterval=setInterval(()=>{self.postMessage({progress:(60-secondsPassed)/60*100});self.postMessage({status:`Rate Limit: ${msToTime(secondsPassed*1e3)}`});--secondsPassed},1e3)}setTimeout(()=>{if(rateLimitInterval)clearInterval(rateLimitInterval);self.postMessage({progress:100});self.postMessage({status:"Retrying"});return recallUAA(page,airingAnimeIDsString)},6e4)}console.error(error)})}function recallUNAE(page,pastAiringEpisodeIDsString){fetch("https://graphql.anilist.co",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json","Cache-Control":"max-age=31536000, immutable"},body:JSON.stringify({query:`{Page(page:${page},perPage:${maxAnimePerPage}){pageInfo{hasNextPage}media(id_in:[${pastAiringEpisodeIDsString||""}],type:ANIME){id format genres status(version:2)nextAiringEpisode{episode airingAt}}}}`})}).then(async response=>{let headers=response.headers;let result=await response.json();return{result:result,headers:headers}}).then(async({result,headers})=>{let error;if(typeof(error=result?.errors?.[0]?.message)==="string"){++retryCount;if(retryCount>=2){clearTimeout(isShowingProgressTimeout);isShowingProgress=false;self.postMessage({status:"Request Timeout"})}let rateLimitInterval;if(retryCount<2){let secondsPassed=60;rateLimitInterval=setInterval(()=>{self.postMessage({progress:(60-secondsPassed)/60*100});self.postMessage({status:(error?error+" ":"")+`Rate Limit: ${msToTime(secondsPassed*1e3)}`});--secondsPassed},1e3)}setTimeout(()=>{if(rateLimitInterval)clearInterval(rateLimitInterval);self.postMessage({progress:100});self.postMessage({status:"Retrying"});return recallUNAE(page,pastAiringEpisodeIDsString)},6e4)}else{let Page=result?.data?.Page;let media=Page?.media||[];let hasUpdatedEntry=false;let hasExcludedEntry=false;if(media instanceof Array){for(let anime of media){if(typeof anime?.id==="number"){pastAiringEpisodeIDs=pastAiringEpisodeIDs.filter(_id=>_id!==anime.id);if((typeof anime?.format!=="string"||!excludedFormats[anime?.format?.trim?.()?.toLowerCase?.()])&&!anime?.genres?.some?.(genre=>genre?.trim?.()?.toLowerCase?.()==="hentai")){if(excludedEntries?.hasOwnProperty?.(anime.id)){delete excludedEntries[anime.id];hasExcludedEntry=true}let isIncludedInAnimeEntries=isJsonObject(animeEntries?.[anime.id]);if(isIncludedInAnimeEntries){let savedAnime=animeEntries?.[anime.id];let isPossiblyFinished=typeof savedAnime?.nextAiringEpisode?.episode==="number"&&!isNaN(savedAnime?.nextAiringEpisode?.episode)&&savedAnime?.nextAiringEpisode?.episode===savedAnime?.episodes&&typeof savedAnime?.nextAiringEpisode?.airingAt==="number"&&!isNaN(savedAnime?.nextAiringEpisode?.airingAt)&&new Date(savedAnime?.nextAiringEpisode?.airingAt*1e3)<=new Date;let newStatusIsStillReleasing=anime?.status?.toLowerCase?.()==="releasing"&&savedAnime?.status?.toLowerCase?.()==="releasing";let newNextAiringEpisodeIsRemoved=!isJsonObject(anime?.nextAiringEpisode);let updateNextAiringEpisode=!(isPossiblyFinished&&newStatusIsStillReleasing&&newNextAiringEpisodeIsRemoved);if(updateNextAiringEpisode){if(updateNextAiringEpisode){animeEntries[anime.id].nextAiringEpisode=anime?.nextAiringEpisode}hasUpdatedEntry=true}}}else{if(animeEntries?.hasOwnProperty?.(anime.id)){delete animeEntries[anime.id];hasUpdatedEntry=true}excludedEntries[anime.id]=1;hasExcludedEntry=true}}}}retryCount=0;shouldProcessList=shouldProcessList||hasUpdatedEntry;let hasNextPage=Page?.pageInfo?.hasNextPage??true;if(hasNextPage&&media.length>0){if(!minimizeTransaction){if(currentNonProcessedLength>airingAnimeIDs.length+pastAiringEpisodeIDs.length){currentNonProcessedLength=airingAnimeIDs.length+pastAiringEpisodeIDs.length;let processedLength=Math.max(animeLength-currentNonProcessedLength,0);let percentage=100*(processedLength/animeLength);percentage=percentage>=0?percentage:0;if(!isShowingProgress){isShowingProgress=true;isShowingProgressTimeout=setTimeout(()=>{self.postMessage({progress:percentage});self.postMessage({status:`${percentage.toFixed(2)}% Updating Entries`});isShowingProgress=false},16)}}if(hasUpdatedEntry){if(!willProcessList){willProcessList=true;await saveJSON(true,"shouldProcessRecommendation")}await saveJSON(animeEntries,"animeEntries")}if(hasExcludedEntry){await saveJSON(excludedEntries,"excludedEntries")}}if(headers?.get("x-ratelimit-remaining")>0){return recallUNAE(++page,pastAiringEpisodeIDsString)}else{let secondsPassed=60;let rateLimitInterval=setInterval(()=>{self.postMessage({progress:(60-secondsPassed)/60*100});self.postMessage({status:`Rate Limit: ${msToTime(secondsPassed*1e3)}`});--secondsPassed},1e3);setTimeout(()=>{clearInterval(rateLimitInterval);self.postMessage({progress:100});self.postMessage({status:"Retrying"});return recallUNAE(++page,pastAiringEpisodeIDsString)},6e4)}}else if(pastAiringEpisodeIDs.length-1>pastAiringEpisodeIDsCollectionIdx){++pastAiringEpisodeIDsCollectionIdx;recallUNAE(1,pastAiringEpisodeIDsCollection[pastAiringEpisodeIDsCollectionIdx].join(","))}else{clearTimeout(isShowingProgressTimeout);self.postMessage({progress:100});isShowingProgress=false;if(shouldProcessList){if(!willProcessList){willProcessList=true;await saveJSON(true,"shouldProcessRecommendation")}self.postMessage({status:"100% Updating Entries"});await saveJSON(animeEntries,"animeEntries");self.postMessage({updateRecommendationList:true});shouldProcessList=false}if(hasExcludedEntry){await saveJSON(excludedEntries,"excludedEntries")}let runnedAutoUpdateAt=(new Date).getTime();await saveJSON(runnedAutoUpdateAt,"runnedAutoUpdateAt");self.postMessage({status:null});updateNonRecentEntries(animeEntries,excludedEntries,animeUpdateAt)}}}).catch(async error=>{clearTimeout(isShowingProgressTimeout);isShowingProgress=false;if(!await isConnected()){self.postMessage({status:"Server unreachable"});self.postMessage({error:"Server unreachable"});return}let headers=error.headers;if(headers?.get("x-ratelimit-remaining")>0){return recallUNAE(page,pastAiringEpisodeIDsString)}else{++retryCount;if(retryCount>=2){self.postMessage({status:"Request Timeout"})}let rateLimitInterval;if(retryCount<2){let secondsPassed=60;rateLimitInterval=setInterval(()=>{self.postMessage({progress:(60-secondsPassed)/60*100});self.postMessage({status:`Rate Limit: ${msToTime(secondsPassed*1e3)}`});--secondsPassed},1e3)}setTimeout(()=>{if(rateLimitInterval)clearInterval(rateLimitInterval);self.postMessage({progress:100});self.postMessage({status:"Retrying"});return recallUNAE(page,pastAiringEpisodeIDsString)},6e4)}console.error(error)})}recallUAA(1,airingAnimeIDsCollection[airingAnimeIDsCollectionIdx].join(","))}async function updateNonRecentEntries(animeEntries,excludedEntries,animeUpdateAt){const hasNewVersion=entriesVersion>(await retrieveJSON("entriesVersion")??0);let recursingOldestUpdateAt,newestUpdateAt,largestDif;const limitedExcludedAnimeIDsString=divideArray(Object.keys(excludedEntries),maxArraySize,true)?.[0]?.join(",")||"";self.postMessage({status:"Checking Additional Entries"});self.postMessage({progress:0});function recallGOUD(){self.postMessage({progress:25});fetch("https://graphql.anilist.co",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json","Cache-Control":"max-age=31536000, immutable"},body:JSON.stringify({query:`{Page(page:1,perPage:1){media(sort:UPDATED_AT){updatedAt}}}`})}).then(async response=>{let headers=response.headers;let result=await response.json();return{result:result,headers:headers}}).then(async({result,headers})=>{let error;if(typeof(error=result?.errors?.[0]?.message)==="string"){++retryCount;if(retryCount>=2){clearTimeout(isShowingProgressTimeout);isShowingProgress=false;self.postMessage({status:"Request Timeout"})}let rateLimitInterval;if(retryCount<2){let secondsPassed=60;rateLimitInterval=setInterval(()=>{self.postMessage({progress:(60-secondsPassed)/60*100});self.postMessage({status:(error?error+" ":"")+`Rate Limit: ${msToTime(secondsPassed*1e3)}`});--secondsPassed},1e3)}setTimeout(()=>{if(rateLimitInterval)clearInterval(rateLimitInterval);self.postMessage({progress:100});self.postMessage({status:"Retrying"});return recallGOUD()},6e4)}else{self.postMessage({progress:100});let currentOldestUpdateAt=result?.data?.Page?.media?.[0]?.updatedAt||1706674120;if(hasNewVersion){animeUpdateAt=currentOldestUpdateAt}else if(currentOldestUpdateAt&&currentOldestUpdateAt>animeUpdateAt){animeUpdateAt=currentOldestUpdateAt}self.postMessage({progress:0});recallUNRE(1)}}).catch(async error=>{clearTimeout(isShowingProgressTimeout);isShowingProgress=false;if(!await isConnected()){self.postMessage({status:"Server unreachable"});self.postMessage({error:"Server unreachable"});return}let headers=error.headers;if(headers?.get("x-ratelimit-remaining")>0){return recallGOUD()}else{++retryCount;if(retryCount>=2){self.postMessage({status:"Request Timeout"})}let rateLimitInterval;if(retryCount<2){let secondsPassed=60;rateLimitInterval=setInterval(()=>{self.postMessage({progress:(60-secondsPassed)/60*100});self.postMessage({status:`Rate Limit: ${msToTime(secondsPassed*1e3)}`});--secondsPassed},1e3)}setTimeout(()=>{if(rateLimitInterval)clearInterval(rateLimitInterval);self.postMessage({progress:100});self.postMessage({status:"Retrying"});return recallGOUD()},6e4)}console.error(error)})}let shouldProcessList;let percentage=0;function recallUNRE(page){fetch("https://graphql.anilist.co",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json","Cache-Control":"max-age=31536000, immutable"},body:JSON.stringify({query:`{Page(page:${page},perPage:${maxAnimePerPage}){pageInfo{hasNextPage}media(id_not_in:[${limitedExcludedAnimeIDsString}],sort:UPDATED_AT_DESC){id updatedAt title{romaji english userPreferred}relations{edges{relationType(version:2)node{id popularity}}}description siteUrl averageScore episodes chapters volumes countryOfOrigin duration trending popularity favourites format genres status(version:2)coverImage{large}trailer{id thumbnail site}bannerImage tags{name rank category}studios{edges{node{name siteUrl isAnimationStudio}isMain}}startDate{month day year}endDate{month day year}seasonYear season staff(perPage:${maxStaffPerPage},page:1,sort:RELEVANCE){pageInfo{hasNextPage}edges{node{name{userPreferred}siteUrl}role}}nextAiringEpisode{episode airingAt}}}}`})}).then(async response=>{let headers=response.headers;let result=await response.json();return{result:result,headers:headers}}).then(async({result,headers})=>{let error;if(typeof(error=result?.errors?.[0]?.message)==="string"){++retryCount;if(retryCount>=2){clearTimeout(isShowingProgressTimeout);isShowingProgress=false;self.postMessage({status:"Request Timeout"})}let rateLimitInterval;if(retryCount<2){let secondsPassed=60;rateLimitInterval=setInterval(()=>{self.postMessage({progress:(60-secondsPassed)/60*100});self.postMessage({status:(error?error+" ":"")+`Rate Limit: ${msToTime(secondsPassed*1e3)}`});--secondsPassed},1e3)}setTimeout(()=>{if(rateLimitInterval)clearInterval(rateLimitInterval);self.postMessage({progress:100});self.postMessage({status:"Retrying"});return recallUNRE(page)},6e4)}else{let Page=result?.data?.Page;let media=Page?.media||[];let hasUpdatedEntry=false;let hasExcludedEntry=false;if(media instanceof Array){for(let anime of media){if(typeof anime?.id==="number"){if(typeof anime.updatedAt==="number"){let currentUpdateAt=anime.updatedAt;if(currentUpdateAt){if(newestUpdateAt==null||currentUpdateAt>newestUpdateAt){newestUpdateAt=currentUpdateAt;if(largestDif==null){largestDif=newestUpdateAt-animeUpdateAt}else{largestDif=Math.max(largestDif,newestUpdateAt-animeUpdateAt)}}if(recursingOldestUpdateAt==null||currentUpdateAt<recursingOldestUpdateAt){recursingOldestUpdateAt=currentUpdateAt;if(animeUpdateAt>=recursingOldestUpdateAt&&recursingOldestUpdateAt&&animeUpdateAt){if(!hasNewVersion){break}}else if(newestUpdateAt&&animeUpdateAt<=recursingOldestUpdateAt&&newestUpdateAt>recursingOldestUpdateAt){percentage=(largestDif-(recursingOldestUpdateAt-animeUpdateAt))/largestDif*100}}}}if((typeof anime?.format!=="string"||!excludedFormats[anime?.format?.trim?.()?.toLowerCase?.()])&&!anime?.genres?.some?.(genre=>genre?.trim?.()?.toLowerCase?.()==="hentai")){if(anime?.genres instanceof Array){let unique={};anime.genres=anime.genres.filter(genre=>{if(genre&&!unique[genre]){unique[genre]=true;return true}else{return false}})}if(anime?.tags instanceof Array){let unique={};anime.tags=anime.tags.filter(tag=>{let _tag=tag?.name;if(_tag&&!unique[_tag]){unique[_tag]=true;return true}else{return false}})}if(anime?.studios?.edges instanceof Array){let unique={};anime.studios.edges=anime.studios.edges.filter(studio=>{let _studio=studio?.node?.name;if(_studio&&!unique[_studio]){unique[_studio]=true;return true}else{return false}})}let isIncludedInAnimeEntries=isJsonObject(animeEntries?.[anime.id]);if(excludedEntries?.hasOwnProperty?.(anime.id)){delete excludedEntries[anime.id];hasExcludedEntry=true}else if(!isIncludedInAnimeEntries){if(animeFormats[anime?.format?.trim?.()?.toLowerCase?.()]){++newAddedEntriesCount}}else if(isIncludedInAnimeEntries){let isEditedEntry=false;let newCoverImage=anime?.coverImage?.large;if(newCoverImage){let oldCoverImage=animeEntries?.[anime.id]?.coverImage?.large;if(newCoverImage!==oldCoverImage){isEditedEntry=true}}if(!isEditedEntry){let newTrailerId=anime?.trailer?.id;if(newTrailerId){let oldTrailerId=animeEntries?.[anime.id]?.trailer?.id;if(newTrailerId!==oldTrailerId){isEditedEntry=true}}}if(isEditedEntry){if(animeFormats[anime?.format?.trim?.()?.toLowerCase?.()]){++newEditedEntriesCount}anime.dateEdited=currentRequestTimestamp}else if(animeEntries?.[anime.id]?.dateEdited){anime.dateEdited=animeEntries?.[anime.id]?.dateEdited}}if(isIncludedInAnimeEntries){let savedAnime=animeEntries?.[anime.id];let isPossiblyFinished=typeof savedAnime?.nextAiringEpisode?.episode==="number"&&!isNaN(savedAnime?.nextAiringEpisode?.episode)&&savedAnime?.nextAiringEpisode?.episode===savedAnime?.episodes&&typeof savedAnime?.nextAiringEpisode?.airingAt==="number"&&!isNaN(savedAnime?.nextAiringEpisode?.airingAt)&&new Date(savedAnime?.nextAiringEpisode?.airingAt*1e3)<=new Date;let newStatusIsStillReleasing=anime?.status?.toLowerCase?.()==="releasing"&&savedAnime?.status?.toLowerCase?.()==="releasing";let newNextAiringEpisodeIsRemoved=!isJsonObject(anime?.nextAiringEpisode);let dontUpdateNextAiringEpisode=isPossiblyFinished&&newStatusIsStillReleasing&&newNextAiringEpisodeIsRemoved;if(dontUpdateNextAiringEpisode){anime.nextAiringEpisode=savedAnime.nextAiringEpisode}}if(!hasExcludedEntry){animeEntries[anime.id]=anime;hasUpdatedEntry=true}}else{if(animeEntries?.hasOwnProperty?.(anime.id)){delete animeEntries[anime.id];hasUpdatedEntry=true}excludedEntries[anime.id]=1;hasExcludedEntry=true}}}}shouldProcessList=shouldProcessList||hasUpdatedEntry;let hasNextPage=Page?.pageInfo?.hasNextPage??true;if(hasNextPage&&media.length>0&&(hasNewVersion||recursingOldestUpdateAt>animeUpdateAt||!recursingOldestUpdateAt||!animeUpdateAt)){if(!minimizeTransaction){if(!isShowingProgress){isShowingProgress=true;isShowingProgressTimeout=setTimeout(()=>{if(percentage>=.01){self.postMessage({status:`${percentage.toFixed(2)}% Updating Additional Entries`})}else{self.postMessage({status:"Updating Additional Entries"})}self.postMessage({progress:percentage});isShowingProgress=false},16)}if(hasUpdatedEntry){if(!willProcessList){willProcessList=true;await saveJSON(true,"shouldProcessRecommendation")}await saveJSON(animeEntries,"animeEntries")}if(hasExcludedEntry){await saveJSON(excludedEntries,"excludedEntries")}}if(headers?.get("x-ratelimit-remaining")>0){return recallUNRE(++page)}else{let secondsPassed=60;rateLimitInterval=setInterval(()=>{self.postMessage({progress:(60-secondsPassed)/60*100});self.postMessage({status:(error?error+" ":"")+`Rate Limit: ${msToTime(secondsPassed*1e3)}`});--secondsPassed},1e3);setTimeout(()=>{if(rateLimitInterval)clearInterval(rateLimitInterval);self.postMessage({progress:100});self.postMessage({status:"Retrying"});return recallUNRE(++page)},6e4)}}else{clearTimeout(isShowingProgressTimeout);isShowingProgress=false;self.postMessage({progress:100});if(shouldProcessList){if(!willProcessList){willProcessList=true;await saveJSON(true,"shouldProcessRecommendation")}self.postMessage({status:"100% Updating Additional Entries"});await saveJSON(animeEntries,"animeEntries");await saveJSON(entriesVersion,"entriesVersion");self.postMessage({updateRecommendationList:true})}if(hasExcludedEntry){await saveJSON(excludedEntries,"excludedEntries")}if(shouldProcessList&&newestUpdateAt){animeUpdateAt=newestUpdateAt;await saveJSON(animeUpdateAt,"animeUpdateAt")}if(newAddedEntriesCount>lastAddedEntriesCount||newEditedEntriesCount>lastEditedEntriesCount){self.postMessage({notifyAddedEntries:newAddedEntriesCount,notifyEditedEntries:newEditedEntriesCount});lastAddedEntriesCount=newAddedEntriesCount;lastEditedEntriesCount=newEditedEntriesCount}self.postMessage({status:null});self.postMessage({done:true})}}}).catch(async error=>{clearTimeout(isShowingProgressTimeout);isShowingProgress=false;if(!await isConnected()){self.postMessage({status:"Server unreachable"});self.postMessage({error:"Server unreachable"});return}let headers=error.headers;if(headers?.get("x-ratelimit-remaining")>0){return recallUNRE(page)}else{++retryCount;if(retryCount>=2){self.postMessage({status:"Request Timeout"})}let rateLimitInterval;if(retryCount<2){let secondsPassed=60;rateLimitInterval=setInterval(()=>{self.postMessage({progress:(60-secondsPassed)/60*100});self.postMessage({status:`Rate Limit: ${msToTime(secondsPassed*1e3)}`});--secondsPassed},1e3)}setTimeout(()=>{if(rateLimitInterval)clearInterval(rateLimitInterval);self.postMessage({progress:100});self.postMessage({status:"Retrying"});return recallUNRE(page)},6e4)}console.error(error)})}recallGOUD()}};async function IDBinit(){return await new Promise(resolve=>{let request=indexedDB.open("Kanshi.Anime.Recommendations.Anilist.W~uPtWCq=vG$TR:Zl^#t<vdS]I~N70",1);request.onerror=error=>{console.error(error)};request.onsuccess=event=>{db=event.target.result;return resolve()};request.onupgradeneeded=event=>{db=event.target.result;db.createObjectStore("MyObjectStore");let transaction=event.target.transaction;transaction.oncomplete=()=>{return resolve()}}})}async function saveJSON(data,name){return await new Promise(async(resolve,reject)=>{try{let write=db.transaction("MyObjectStore","readwrite").objectStore("MyObjectStore").openCursor();write.onsuccess=async event=>{let put=await db.transaction("MyObjectStore","readwrite").objectStore("MyObjectStore").put(data,name);put.onsuccess=()=>{return resolve()};put.onerror=()=>{return resolve()}};write.onerror=async error=>{console.error(error);return reject()}}catch(ex){console.error(ex)}})}async function retrieveJSON(name){return await new Promise(resolve=>{try{let read=db.transaction("MyObjectStore","readwrite").objectStore("MyObjectStore").get(name);read.onsuccess=()=>{return resolve(read.result)};read.onerror=error=>{console.error(error);return resolve()}}catch(ex){console.error(ex);return resolve()}})}function getMax(arr){let len=arr.length;let max=-Infinity;while(len--){max=arr[len]>max?arr[len]:max}return max}function divideArray(array,size,sameSize){let result=[];for(let i=0;i<array.length;i+=size){result.push(array.slice(sameSize?Math.min(i,array.length-size):i,i+size))}return result}function msToTime(duration,limit){try{if(duration<1e3){return"0s"}let seconds=Math.floor(duration/1e3%60),minutes=Math.floor(duration/6e4%60),hours=Math.floor(duration/36e5%24),days=Math.floor(duration/864e5%7),weeks=Math.floor(duration/6048e5%4),months=Math.floor(duration/24192e5%12),years=Math.floor(duration/290304e5%10),decades=Math.floor(duration/290304e6%10),century=Math.floor(duration/290304e7%10),millenium=Math.floor(duration/290304e8%10);let time=[];if(millenium>0)time.push(`${millenium}mil`);if(century>0)time.push(`${century}cen`);if(decades>0)time.push(`${decades}dec`);if(years>0)time.push(`${years}y`);if(months>0)time.push(`${months}mon`);if(weeks>0)time.push(`${weeks}w`);if(days>0)time.push(`${days}d`);if(hours>0)time.push(`${hours}h`);if(minutes>0)time.push(`${minutes}m`);if(seconds>0)time.push(`${seconds}s`);if(limit>0){time=time.slice(0,limit)}return time.join(" ")||"0s"}catch(e){return""}}function isJsonObject(obj){return Object.prototype.toString.call(obj)==="[object Object]"}function jsonIsEmpty(obj){for(const key in obj){return false}return true}function ncsCompare(str1,str2){if(typeof str1!=="string"||typeof str2!=="string"){return false}return str1.toLowerCase()===str2.toLowerCase()}let isConnectedPromise;async function isConnected(){if(isConnectedPromise)return isConnectedPromise;isConnectedPromise=new Promise(async resolve=>{try{if(navigator?.onLine!==false){let href=windowHREF||"https://u-kuro.github.io/Kanshi-Anime-Recommender";let response=await fetch(href,{method:"HEAD",cache:"no-store"});isConnectedPromise=null;resolve(response?.ok)}isConnectedPromise=null;resolve(false)}catch(error){isConnectedPromise=null;resolve(false)}});return isConnectedPromise}