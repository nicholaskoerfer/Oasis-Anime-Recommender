let request,db;self.onmessage=async({data})=>{if(!db){await IDBinit()}if(data?.number===0){let currentDate=new Date;let currentYear=currentDate.getFullYear();let currentSeason;let seasons={winter:new Date(parseInt(currentYear),0,1),spring:new Date(parseInt(currentYear),3,1),summer:new Date(parseInt(currentYear),6,1),fall:new Date(parseInt(currentYear),9,1)};if(currentDate>=seasons.winter&&currentDate<seasons.spring){currentSeason="winter"}else if(currentDate>=seasons.spring&&currentDate<seasons.summer){currentSeason="spring"}else if(currentDate>=seasons.summer&&currentDate<seasons.fall){currentSeason="summer"}else{currentSeason="fall"}let recommendedAnimeListArray=Object.values(await retrieveJSON("recommendedAnimeList")||{});let hiddenEntries=(await retrieveJSON("userList"))?.hiddenEntries||{};let animeEntries=recommendedAnimeListArray.filter(anime=>{if(hiddenEntries[anime.id])return false;let loweredFormat=anime?.format?.toLowerCase?.();if(!loweredFormat||loweredFormat==="manga"||loweredFormat==="one shot"||loweredFormat==="novel")return false;let year=anime?.year;let season=anime?.season;let weightedScore=anime?.weightedScore||0;return parseInt(year)===parseInt(currentYear)&&season?.trim?.()?.toLowerCase?.()===currentSeason&&weightedScore>1});let userEntryCount=animeEntries.filter(anime=>anime?.userStatus?.trim?.()?.toLowerCase?.()!=="unwatched").length;let animeEntryCount=animeEntries.length;if(userEntryCount&&animeEntryCount){userEntryCount=formatNumber(userEntryCount,userEntryCount>1e3?1:0);animeEntryCount=formatNumber(animeEntryCount,animeEntryCount>1e3?1:0);let formattedAniText;if(animeEntryCount===userEntryCount){formattedAniText="All"}else{formattedAniText=`${userEntryCount} / ${animeEntryCount}`}self.postMessage({message:`${formattedAniText} Seasonal anime are in your List`,key:0})}else{self.postMessage({message:null})}}else if(data?.number===1){const userData=await retrieveJSON("userData");let userEntries=(userData?.userEntries??await retrieveJSON("userEntries"))||[];userEntries=userEntries.filter(entry=>{let userStatus=entry?.status;return userStatus?.trim?.()?.toLowerCase?.()==="planning"});let userFinishedEntryCount=userEntries.filter(entry=>{let anime=entry?.media;let animeStatus=anime?.status;return animeStatus?.trim?.()?.toLowerCase?.()==="finished"}).length;let userEntryCount=userEntries.length;if(userEntryCount&&userFinishedEntryCount){userEntryCount=formatNumber(userEntryCount,userEntryCount>1e3?1:0);userFinishedEntryCount=formatNumber(userFinishedEntryCount,userFinishedEntryCount>1e3?1:0);let formattedAniText;if(userEntryCount===userFinishedEntryCount){formattedAniText="All"}else{formattedAniText=`${userFinishedEntryCount} / ${userEntryCount}`}self.postMessage({message:`${formattedAniText} Planned entries are Finished`,key:1})}else{self.postMessage({message:null})}}else if(data?.number===2){let recommendedAnimeListArray=Object.values(await retrieveJSON("recommendedAnimeList")||{});let hiddenEntries=(await retrieveJSON("userList"))?.hiddenEntries||{};let unwatchedSeries=recommendedAnimeListArray.filter(anime=>{if(hiddenEntries[anime.id])return false;let animeRelations=anime?.animeRelations;if(animeRelations instanceof Array){let userStatus=anime?.userStatus?.trim?.()?.toLowerCase?.();let isNotUserAnimeUnwatchedSequel=["completed","repeating","dropped"].some(e=>e===userStatus)||!animeRelations.some(e=>{let animeRelationType=e?.relationType?.trim?.()?.toLowerCase?.();let animeRelationID=e?.node?.id;if(typeof animeRelationType==="string"&&animeRelationType==="prequel"&&typeof animeRelationID==="number"&&!isNaN(animeRelationID)){let relationAnime=recommendedAnimeListArray?.find?.(anime=>anime?.id===animeRelationID);let relationStatus=relationAnime?.userStatus?.trim?.()?.toLowerCase?.();return["completed","repeating"].some(e=>e===relationStatus)}});return!isNotUserAnimeUnwatchedSequel}return false});let myUnwatchedSeriesCount=unwatchedSeries?.filter?.(anime=>{return anime?.userStatus?.trim?.()?.toLowerCase?.()!=="unwatched"})?.length;let unwatchedSeriesCount=unwatchedSeries?.length;if(unwatchedSeriesCount&&myUnwatchedSeriesCount){unwatchedSeriesCount=formatNumber(unwatchedSeriesCount,unwatchedSeriesCount>1e3?1:0);myUnwatchedSeriesCount=formatNumber(myUnwatchedSeriesCount,myUnwatchedSeriesCount>1e3?1:0);let formattedAniText;if(myUnwatchedSeriesCount===unwatchedSeriesCount){formattedAniText="All"}else{formattedAniText=`${myUnwatchedSeriesCount} / ${unwatchedSeriesCount}`}self.postMessage({message:`${formattedAniText} available Sequels are in your List`,key:2})}else{self.postMessage({message:null})}}else if(data?.number===3){let recommendedAnimeListArray=Object.values(await retrieveJSON("recommendedAnimeList")||{});let airingAnime=recommendedAnimeListArray.map(anime=>{if(typeof anime?.nextAiringEpisode?.episode==="number"&&!isNaN(anime?.nextAiringEpisode?.episode)&&!["completed","dropped","repeating","unwatched"].some(e=>anime?.userStatus?.trim?.()?.toLowerCase?.()===e)&&typeof anime?.episodes==="number"&&!isNaN(anime?.episodes)&&anime?.episodes>=anime?.nextAiringEpisode?.episode&&typeof anime?.nextAiringEpisode?.airingAt==="number"&&!isNaN(anime?.nextAiringEpisode?.airingAt)&&new Date(anime?.nextAiringEpisode?.airingAt*1e3)>new Date){let nextEp=anime.nextAiringEpisode.episode;let fullEp=anime.episodes;let remainingTimeAfterNextEp=1e3*60*60*24*7*(fullEp-nextEp);let endDate=new Date(anime.nextAiringEpisode.airingAt*1e3+remainingTimeAfterNextEp);if(endDate>new Date){return{endDate:endDate}}else{return null}}}).filter(Boolean);airingAnime.sort((a,b)=>{let x=a?.endDate?.getTime?.()?a?.endDate?.getTime?.():Number.MAX_SAFE_INTEGER;let y=b?.endDate?.getTime?.()?b?.endDate?.getTime?.():Number.MAX_SAFE_INTEGER;if(x!==y)return x-y;return x-y});let closestAiringAnime=airingAnime?.[0];if(closestAiringAnime?.endDate instanceof Date&&!isNaN(closestAiringAnime?.endDate)&&closestAiringAnime?.endDate>new Date){let formattedEndDate=msToTime(closestAiringAnime.endDate.getTime()-(new Date).getTime(),1);self.postMessage({message:`${formattedEndDate} until nearest anime Completion`,key:3})}else{self.postMessage({message:null})}}else if(data?.number===4){let recommendedAnimeListArray=Object.values(await retrieveJSON("recommendedAnimeList")||{});let airingAnime=recommendedAnimeListArray.map(anime=>{if(typeof anime?.nextAiringEpisode?.episode==="number"&&!isNaN(anime?.nextAiringEpisode?.episode)&&!["completed","dropped","repeating","unwatched"].some(e=>anime?.userStatus?.trim?.()?.toLowerCase?.()===e)&&typeof anime?.nextAiringEpisode?.airingAt==="number"&&!isNaN(anime?.nextAiringEpisode?.airingAt)&&new Date(anime?.nextAiringEpisode?.airingAt*1e3)>new Date){let loweredFormat=anime?.format?.toLowerCase?.();if(!loweredFormat||loweredFormat==="manga"||loweredFormat==="one shot"||loweredFormat==="novel")return null;let nextEp=anime.nextAiringEpisode.episode;let fullEp=anime?.episodes;let endDate=new Date(anime.nextAiringEpisode.airingAt*1e3);if(endDate>new Date){return{nextEp:nextEp,fullEp:fullEp,endDate:endDate}}else{return null}}}).filter(Boolean);airingAnime.sort((a,b)=>{let x=a?.endDate?.getTime?.()?a?.endDate?.getTime?.():Number.MAX_SAFE_INTEGER;let y=b?.endDate?.getTime?.()?b?.endDate?.getTime?.():Number.MAX_SAFE_INTEGER;if(x!==y)return x-y;return x-y});let closestAiringAnime=airingAnime?.[0];if(closestAiringAnime?.endDate instanceof Date&&!isNaN(closestAiringAnime?.endDate)&&closestAiringAnime?.endDate>new Date&&typeof closestAiringAnime?.nextEp==="number"&&!isNaN(closestAiringAnime?.nextEp)){let formattedEndDate=msToTime(closestAiringAnime.endDate.getTime()-(new Date).getTime(),1);self.postMessage({message:`${formattedEndDate} until nearest anime Release`,key:4})}else{self.postMessage({message:null})}}else{let currentDate=new Date;let currentYear=currentDate.getFullYear();let seasons={winter:new Date(parseInt(currentYear),0,1),spring:new Date(parseInt(currentYear),3,1),summer:new Date(parseInt(currentYear),6,1),fall:new Date(parseInt(currentYear),9,1)};let dateEnd,dateEndTime;if(currentDate>=seasons.winter&&currentDate<seasons.spring){dateEndTime=seasons.spring.getTime()-1;dateEnd=new Date(dateEndTime)}else if(currentDate>=seasons.spring&&currentDate<seasons.summer){dateEndTime=seasons.summer.getTime()-1;dateEnd=new Date(dateEndTime)}else if(currentDate>=seasons.summer&&currentDate<seasons.fall){dateEndTime=seasons.fall.getTime()-1;dateEnd=new Date(dateEndTime)}else{let nextYearDate=new Date(parseInt(currentYear+1),0,1);dateEndTime=nextYearDate.getTime()-1;dateEnd=new Date(dateEndTime)}let formattedSeasonEnd=msToTime(dateEnd.getTime()-(new Date).getTime(),1);self.postMessage({message:`${formattedSeasonEnd} until Season Ends`,key:5})}};function isJsonObject(obj){return Object.prototype.toString.call(obj)==="[object Object]"}const formatNumber=(number,dec=2)=>{if(typeof number==="number"){const formatter=new Intl.NumberFormat("en-US",{maximumFractionDigits:dec,minimumFractionDigits:0,notation:"compact",compactDisplay:"short"});if(Math.abs(number)>=1e3){return formatter.format(number)}else if(Math.abs(number)<.01&&Math.abs(number)>0){return number.toExponential(0)}else{return number.toFixed(dec)||number.toLocaleString("en-US",{maximumFractionDigits:dec})}}else{return null}};function msToTime(duration,limit){try{if(duration<1e3){return"0s"}let seconds=Math.floor(duration/1e3%60),minutes=Math.floor(duration/6e4%60),hours=Math.floor(duration/36e5%24),days=Math.floor(duration/864e5%7),weeks=Math.floor(duration/6048e5%4),months=Math.floor(duration/24192e5%12),years=Math.floor(duration/290304e5%10),decades=Math.floor(duration/290304e6%10),century=Math.floor(duration/290304e7%10),millenium=Math.floor(duration/290304e8%10);let time=[];let maxUnit=millenium>0?"mil":century>0?"cen":decades>0?"dec":years>0?"y":months>0?"mon":weeks>0?"w":days>0?"d":hours>0?"h":minutes>0?"m":"s";if(limit<=1){switch(maxUnit){case"mil":{if(century>0){millenium+=century*.1;millenium=roundToNearestTenth(millenium)}break}case"cen":{if(decades>0){century+=decades*.1;century=roundToNearestTenth(century)}break}case"dec":{if(years>0){decades+=years*.1;decades=roundToNearestTenth(decades)}break}case"y":{if(months>0){years+=months*.0833333333;years=roundToNearestTenth(years)}break}case"mon":{if(weeks>0){months+=weeks*.229984378;months=roundToNearestTenth(months)}break}case"w":{if(days>0){weeks+=days*.142857143;weeks=roundToNearestTenth(weeks)}break}case"d":{if(hours>0){days+=hours*.0416666667;days=roundToNearestTenth(days)}break}case"h":{if(minutes>0){hours+=minutes*.0166666667;hours=roundToNearestTenth(hours)}break}case"m":{if(seconds>0){minutes+=seconds*.0166666667;minutes=roundToNearestTenth(minutes)}break}}}if(millenium>0)time.push(`${millenium} ${millenium>1?"millennia":"millennium"}`);if(century>0)time.push(`${century} centur${century>1?"ies":"y"}`);if(decades>0)time.push(`${decades} decade${millenium>1?"s":""}`);if(years>0)time.push(`${years} year${years>1?"s":""}`);if(months>0)time.push(`${months} month${months>1?"s":""}`);if(weeks>0)time.push(`${weeks} week${weeks>1?"s":""}`);if(days>0)time.push(`${days} day${days>1?"s":""}`);if(hours>0)time.push(`${hours} hour${hours>1?"s":""}`);if(minutes>0)time.push(`${minutes} minute${minutes>1?"s":""}`);if(seconds>0)time.push(`${seconds} second${seconds>1?"s":""}`);if(limit>0){time=time.slice(0,limit)}return time.join(" ")||"0s"}catch(e){return}}function roundToNearestTenth(number){return Math.round(number*10)/10}async function IDBinit(){return await new Promise(resolve=>{let request=indexedDB.open("Kanshi.Anime.Recommendations.Anilist.W~uPtWCq=vG$TR:Zl^#t<vdS]I~N70",1);request.onerror=error=>{console.error(error)};request.onsuccess=event=>{db=event.target.result;return resolve()};request.onupgradeneeded=event=>{db=event.target.result;db.createObjectStore("MyObjectStore");let transaction=event.target.transaction;transaction.oncomplete=()=>{return resolve()}}})}async function retrieveJSON(name){return await new Promise(resolve=>{try{let read=db.transaction("MyObjectStore","readwrite").objectStore("MyObjectStore").get(name);read.onsuccess=()=>{return resolve(read.result)};read.onerror=error=>{console.error(error);return resolve()}}catch(ex){console.error(ex);return resolve()}})}