let request,db;self.onmessage=async({data})=>{if(!db){await IDBinit()}self.postMessage({status:"Importing User Data"});const reader=new FileReader;reader.onload=async()=>{let fileContent;try{self.postMessage({progress:0});self.postMessage({progress:30});fileContent=JSON.parse(reader.result);self.postMessage({progress:75})}catch(e){fileContent=undefined}try{if(!fileContent){self.postMessage({progress:0});fileContent=await parseAsync(reader.result);self.postMessage({progress:75})}if(!fileContent){self.postMessage({status:"File parsing has failed"});self.postMessage({error:"File parsing has failed"});return}let username=fileContent.username;if(typeof username==="string"){await saveJSON(username,"username")}self.postMessage({importedUsername:username});let shouldImportAniEntries=Object.keys(await retrieveJSON("animeEntries")||{}).length<Object.keys(fileContent.animeEntries||{}).length;self.postMessage({progress:76.10993657505286});let lastAnimeUpdate=fileContent.lastAnimeUpdate?new Date(fileContent.lastAnimeUpdate):null;let currentAnimeUpdate=await retrieveJSON("lastAnimeUpdate")||null;if(shouldImportAniEntries){let importingLastAnimeUpdate=new Date(1670770349*1e3);if(lastAnimeUpdate instanceof Date&&!isNaN(lastAnimeUpdate)){importingLastAnimeUpdate=lastAnimeUpdate}else if(currentAnimeUpdate instanceof Date&&!isNaN(currentAnimeUpdate)){importingLastAnimeUpdate=currentAnimeUpdate}await saveJSON(importingLastAnimeUpdate,"lastAnimeUpdate")}else{currentAnimeUpdate=currentAnimeUpdate||new Date(1670770349*1e3);if(lastAnimeUpdate instanceof Date&&!isNaN(lastAnimeUpdate)&&lastAnimeUpdate>currentAnimeUpdate){await saveJSON(lastAnimeUpdate,"lastAnimeUpdate")}}self.postMessage({progress:76.74418604651163});let lastAiringUpdateDate=fileContent.lastAiringUpdateDate?new Date(fileContent.lastAiringUpdateDate):null;let currentAiringAnimeUpdate=await retrieveJSON("lastAiringUpdateDate")||null;if(shouldImportAniEntries){let importingLastAiringUpdate=new Date(1670770349*1e3);if(lastAiringUpdateDate instanceof Date&&!isNaN(lastAiringUpdateDate)){importingLastAiringUpdate=lastAiringUpdateDate}else if(currentAiringAnimeUpdate instanceof Date&&!isNaN(currentAiringAnimeUpdate)){importingLastAiringUpdate=currentAiringAnimeUpdate}await saveJSON(importingLastAiringUpdate,"lastAiringUpdateDate")}else{currentAiringAnimeUpdate=currentAiringAnimeUpdate||new Date(1670770349*1e3);if(lastAiringUpdateDate instanceof Date&&!isNaN(lastAiringUpdateDate)&&lastAiringUpdateDate>currentAiringAnimeUpdate){await saveJSON(lastAiringUpdateDate,"lastAiringUpdateDate")}}self.postMessage({progress:77.3784355179704});let lastUserAnimeUpdate=fileContent.lastUserAnimeUpdate?new Date(fileContent.lastUserAnimeUpdate):null;if(lastUserAnimeUpdate instanceof Date&&!isNaN(lastUserAnimeUpdate)){await saveJSON(lastUserAnimeUpdate,"lastUserAnimeUpdate")}self.postMessage({progress:77.80126849894292});let lastRunnedAutoUpdateDate=fileContent.lastRunnedAutoUpdateDate?new Date(fileContent.lastRunnedAutoUpdateDate):null;if(lastRunnedAutoUpdateDate instanceof Date&&!isNaN(lastRunnedAutoUpdateDate)){await saveJSON(lastRunnedAutoUpdateDate,"lastRunnedAutoUpdateDate")}self.postMessage({importedlastRunnedAutoUpdateDate:lastRunnedAutoUpdateDate});self.postMessage({progress:78.43551797040169});let lastRunnedAutoExportDate=fileContent.lastRunnedAutoExportDate?new Date(fileContent.lastRunnedAutoExportDate):null;if(lastRunnedAutoExportDate instanceof Date&&!isNaN(lastRunnedAutoExportDate)){await saveJSON(lastRunnedAutoExportDate,"lastRunnedAutoExportDate")}self.postMessage({importedlastRunnedAutoExportDate:lastRunnedAutoExportDate});let tagCategoryInfo=fileContent.tagCategoryInfo?new Date(fileContent.tagCategoryInfo):null;if(isJsonObject(tagCategoryInfo)&&!jsonIsEmpty(tagCategoryInfo)){await saveJSON(tagCategoryInfo,"tagCategoryInfo")}self.postMessage({progress:79.49260042283298});let hiddenEntries=fileContent.hiddenEntries;fileContent.hiddenEntries=null;if(isJsonObject(hiddenEntries)){await saveJSON(hiddenEntries,"hiddenEntries")}self.postMessage({importedHiddenEntries:hiddenEntries});hiddenEntries=null;self.postMessage({progress:81.60676532769556});let userEntries=fileContent.userEntries;fileContent.userEntries=null;if(userEntries instanceof Array){await saveJSON(userEntries,"userEntries");userEntries=null}self.postMessage({progress:82.87526427061312});let activeTagFilters=fileContent.activeTagFilters;fileContent.activeTagFilters=null;if(isJsonObject(activeTagFilters)&&!jsonIsEmpty(activeTagFilters)){await saveJSON(activeTagFilters,"activeTagFilters")}let selectedCustomFilter=fileContent.selectedCustomFilter;fileContent.selectedCustomFilter=null;if(!activeTagFilters?.[selectedCustomFilter||""]){for(let customFilterNames in activeTagFilters){if(activeTagFilters?.[customFilterNames]?.["Anime Filter"]){selectedCustomFilter=customFilterNames;await saveJSON(selectedCustomFilter,"selectedCustomFilter");break}}}else{await saveJSON(selectedCustomFilter,"selectedCustomFilter")}let filterOptions=fileContent.filterOptions||await retrieveJSON("filterOptions")||{};fileContent.filterOptions=null;if(filterOptions&&(!isJsonObject(filterOptions?.sortFilter)||!(filterOptions?.sortFilter?.[selectedCustomFilter]instanceof Array))){if(!isJsonObject(filterOptions?.sortFilter)){filterOptions.sortFilter={}}filterOptions.sortFilter[selectedCustomFilter]=[{sortName:"weighted score",sortType:"desc"},{sortName:"date",sortType:"none"},{sortName:"user score",sortType:"none"},{sortName:"average score",sortType:"none"},{sortName:"score",sortType:"none"},{sortName:"popularity",sortType:"none"}];await saveJSON(filterOptions,"filterOptions")}if(selectedCustomFilter&&filterOptions.filterSelection instanceof Array&&activeTagFilters[selectedCustomFilter]){filterOptions.filterSelection=filterOptions.filterSelection.map(filterType=>{let filterSelectionName=filterType.filterSelectionName;filterType.filters.Checkbox=filterType.filters.Checkbox.map((cbFilter,optionIdx)=>{let activeTag=activeTagFilters[selectedCustomFilter][filterSelectionName].find(e=>{return e?.filterType==="checkbox"&&e?.optionIdx===optionIdx});cbFilter.isSelected=activeTag?.selected==="included";return cbFilter});filterType.filters.Dropdown=filterType.filters.Dropdown.map((dpFilter,categIdx)=>{dpFilter.options=dpFilter.options.map((optFilter,optionIdx)=>{let activeTag=activeTagFilters[selectedCustomFilter][filterSelectionName].find(e=>{return e?.filterType==="dropdown"&&e?.categIdx===categIdx&&e?.optionIdx===optionIdx});optFilter.selected=activeTag?.selected||"none";return optFilter});return dpFilter});filterType.filters["Input Number"]=filterType.filters["Input Number"].map((inFilter,optionIdx)=>{let activeTag=activeTagFilters[selectedCustomFilter][filterSelectionName].find(e=>{return e?.filterType==="input number"&&e?.optionIdx===optionIdx});inFilter.numberValue=activeTag?.optionValue||"";return inFilter});return filterType});await saveJSON(filterOptions,"filterOptions")}else if(isJsonObject(filterOptions)){await saveJSON(filterOptions,"filterOptions")}self.postMessage({progress:94.08033826638479});let animeEntries=fileContent.animeEntries;fileContent=null;if(shouldImportAniEntries){await saveJSON(animeEntries,"animeEntries")}else{if(lastAnimeUpdate instanceof Date&&!isNaN(lastAnimeUpdate)&&lastAnimeUpdate>currentAnimeUpdate&&isJsonObject(animeEntries)&&!jsonIsEmpty(animeEntries)){await saveJSON(animeEntries,"animeEntries")}}animeEntries=null;self.postMessage({status:"Data has been Imported"});self.postMessage({updateFilters:true});self.postMessage({updateRecommendationList:true});self.postMessage({status:null});self.postMessage({progress:100});self.postMessage({message:"success"})}catch(error){console.error(error);self.postMessage({status:typeof error==="string"?error:"Something went wrong"});self.postMessage({progress:100});self.postMessage({error:error})}};reader.onerror=error=>{console.error(error);self.postMessage({status:typeof error==="string"?error:"Something went wrong"});self.postMessage({progress:100});self.postMessage({error:error})};if(reader.readyState!==1){reader.readAsText(data.importedFile)}else{reader.onabort=()=>{reader.readAsText(data.importedFile)};reader.abort()}};function isJsonObject(obj){return Object.prototype.toString.call(obj)==="[object Object]"}function jsonIsEmpty(obj){for(const key in obj){return false}return true}async function IDBinit(){return await new Promise(resolve=>{request=indexedDB.open("Kanshi.Anime.Recommendations.Anilist.W~uPtWCq=vG$TR:Zl^#t<vdS]I~N70",1);request.onerror=error=>{console.error(error)};request.onsuccess=event=>{db=event.target.result;return resolve()};request.onupgradeneeded=event=>{db=event.target.result;db.createObjectStore("MyObjectStore");let transaction=event.target.transaction;transaction.oncomplete=()=>{return resolve()}}})}async function saveJSON(data,name){return await new Promise(async(resolve,reject)=>{try{let write=db.transaction("MyObjectStore","readwrite").objectStore("MyObjectStore").openCursor();write.onsuccess=async event=>{let put=await db.transaction("MyObjectStore","readwrite").objectStore("MyObjectStore").put(data,name);put.onsuccess=event=>{return resolve()};put.onerror=event=>{return resolve()}};write.onerror=async error=>{console.error(error);return reject()}}catch(ex){console.error(ex)}})}async function retrieveJSON(name){return await new Promise(resolve=>{try{let read=db.transaction("MyObjectStore","readwrite").objectStore("MyObjectStore").get(name);read.onsuccess=()=>{return resolve(read.result)};read.onerror=error=>{console.error(error);return resolve()}}catch(ex){console.error(ex);return resolve()}})}async function parseAsync(text,iterLimit=1e3){function isValidJson(j){let construct=j?.constructor.name;try{return construct==="Object"&&`${j}`==="[object Object]"||j instanceof Array||construct==="Array"}catch(e){return false}}return await new Promise(resolve=>{let counter=0;let keyN=0;let ogStr=text;let parseStr=ogStr;let constructor=parseStr?.constructor.name??parseStr;let at=0;let ch=" ";let word="";let yielding="";function ParseError(_mes,_pos,_val,_cons){let _ogStr=ogStr;this.message=_mes;if(isNaN(_pos)){this.construct=_cons??constructor}this.value=_ogStr;if(!isNaN(_pos)){this.position=_pos??0;let rpos=Math.max(0,_pos-100);let strLen=Math.min(100,100);this.preview=_ogStr.substr(rpos,strLen);_char=_pos<_ogStr.length?_ogStr.charAt(_pos):"EOS";this.char=_char.match(/['"`]/gm)?` ${_char} `:_char}}if(isValidJson(ogStr)){console.warn(new ParseError(`Data is already a valid JSON`));return ogStr}else if(!(typeof ogStr==="string"||ogStr instanceof String)){console.error(new ParseError("Unexpected Type"));return null}else if(typeof ogStr==="string"||ogStr instanceof String){if(!ogStr.match(/^\s*[\[\{]/gm)){console.error(new ParseError("Data is not a Valid JSON"));return null}}let position=()=>{var pos=parseStr.length;var fChar=parseStr.charAt(0);pos=ogStr.length-pos;return Math.min(Math.max(pos,0),ogStr.length)};let seek=()=>{ch=parseStr.charAt(at);at++;while(ch&&ch<=" "){seek()}return ch};let unseek=()=>{ch=parseStr.charAt(--at)};let wordCheck=()=>{word="";do{word+=ch;seek()}while(ch.match(/[a-z]/i));parseStr=parseStr.slice(at-1);at=0;return word};let normalizeUnicodedString=quote=>{let inQuotes=" ";let tempIndex=at;let index=0;let slash=0;let c=quote;while(c){index=parseStr.indexOf(quote,tempIndex+1);tempIndex=index;ch=parseStr.charAt(tempIndex-1);while(ch==="\\"){slash++;ch=parseStr.charAt(tempIndex-(slash+1))}if(slash%2===0){inQuotes=parseStr.substring(at,index);parseStr=parseStr.slice(++index);slash=0;break}else slash=0}index=inQuotes.indexOf("\\");while(index>=0){let escapee={quote:quote,"'":"'","/":"/","\\":"\\",b:"\b",f:"\f",n:"\n",r:"\r",t:"\t"};let hex=0;let i=0;let uffff=0;at=index;ch=inQuotes.charAt(++at);if(ch==="u"){uffff=0;for(i=0;i<4;i+=1){hex=parseInt(ch=inQuotes.charAt(++at),16);if(!isFinite(hex)){break}uffff=uffff*16+hex}inQuotes=inQuotes.slice(0,index)+String.fromCharCode(uffff)+inQuotes.slice(index+6);at=index}else if(typeof escapee[ch]==="string"){inQuotes=inQuotes.slice(0,index)+escapee[ch]+inQuotes.slice(index+2);at=index+1}else{break}index=inQuotes.indexOf("\\",at)}at=0;return inQuotes};var isFirstChar=true;var firstChar;function*parseYield(){let key="";let returnObj={};let returnArr=[];let v="";let inQuotes="";let num=0;let numHolder="";let _quote;let addup=()=>{numHolder+=ch;seek()};if(yielding instanceof ParseError){return yielding}if(typeof parseStr==="number"||typeof parseStr==="boolean"||parseStr===null){parseStr="";return text}else if(typeof parseStr==="undefined"){parseStr=undefined;return text}else if(parseStr.charAt(0)==="["&&parseStr.charAt(1)==="]"&&parseStr.length===2){parseStr="";return[]}else if(parseStr.charAt(0)==="{"&&parseStr.charAt(1)==="}"){parseStr="";return{}}else{if(++counter>iterLimit){counter=0;yield}if(keyN!==1){if(yielding instanceof ParseError){return yielding}seek()}switch(ch){case"{":isFirstChar=true;if(yielding instanceof ParseError){return yielding}seek();if(ch==="}"){parseStr=parseStr.slice(at);at=0;return returnObj}else if(isFirstChar&&!ch.match(/^\s*["'`]$/gm)){parseStr=parseStr.slice(at-1);return yielding=new ParseError("Expected property name or '}' in JSON",position())}if(isFirstChar){isFirstChar=false}var first=true;do{if(!ch.match(/^\s*["'`]$/gm)){seek()}if(first&&!ch.match(/^\s*["'`,]$/gm)){first=false;parseStr=parseStr.slice(at-1);return yielding=new ParseError("Expected quoted property name in JSON",position())}keyN=1;key=yield*parseYield();if(yielding instanceof ParseError){return yielding}if(parseStr.charAt(0)!==":"){return yielding=new ParseError("Expected ':' after property name in JSON",position())}keyN=0;seek();returnObj[key]=yield*parseYield();if(yielding instanceof ParseError){return yielding}seek();if(ch==="}"){parseStr=parseStr.slice(at);at=0;return returnObj}}while(ch===",");if(parseStr.length>0){return yielding=new ParseError("Expected ',' or '}' after property value in JSON",position())}return yielding=new ParseError("Unmatched Brace",position());case"[":if(yielding instanceof ParseError){return yielding}seek();if(ch==="]"){parseStr=parseStr.slice(at);at=0;return returnArr}unseek();do{v=yield*parseYield();if(yielding instanceof ParseError){return yielding}seek();returnArr.push(v);if(ch==="]"){parseStr=parseStr.slice(at);at=0;return returnArr}}while(ch===",");return yielding=new ParseError("Umatched Bracket",position());case'"':_quote='"';if(yielding instanceof ParseError){return yielding}parseStr=parseStr.slice(at-1);at=0;if(parseStr.charAt(0)===_quote&&parseStr.charAt(1)===_quote){parseStr=parseStr.slice(2);at=0;return inQuotes}else{seek();let strInQuotes=normalizeUnicodedString(_quote);if(strInQuotes===_quote){return yielding=new ParseError("Unmatched Double Quote",position())}return strInQuotes}case"'":_quote="'";if(yielding instanceof ParseError){return yielding}parseStr=parseStr.slice(at-1);at=0;if(parseStr.charAt(0)===_quote&&parseStr.charAt(1)===_quote){parseStr=parseStr.slice(2);at=0;return inQuotes}else{seek();let strInQuotes=normalizeUnicodedString(_quote);if(strInQuotes===_quote){return yielding=new ParseError("Unmatched Single Quote",position())}return strInQuotes}case"`":_quote="`";if(yielding instanceof ParseError){return yielding}parseStr=parseStr.slice(at-1);at=0;if(parseStr.charAt(0)===_quote&&parseStr.charAt(1)===_quote){parseStr=parseStr.slice(2);at=0;return inQuotes}else{seek();let strInQuotes=normalizeUnicodedString(_quote);if(strInQuotes===_quote){return yielding=new ParseError("Unmatched Backtick",position())}return strInQuotes}case"0":case"1":case"2":case"3":case"4":case"5":case"6":case"7":case"8":case"9":case"-":if(yielding instanceof ParseError){return yielding}if(ch==="-"){addup()}do{addup();if(ch==="."||ch==="e"||ch==="E"||ch==="-"||ch==="+"||ch>=String.fromCharCode(65)&&ch<=String.fromCharCode(70)){addup()}}while(ch==="-"||ch==="+"||isFinite(ch)&&ch!=="");num=Number(numHolder);if(isNaN(num)){if(parseStr.match(/^\s*[,:]/gm)){parseStr=parseStr.slice(1)}return yielding=new ParseError("Invalid Number",position())}parseStr=parseStr.slice(at-1);at=0;return num;case"t":if(yielding instanceof ParseError){return yielding}word=wordCheck();if(word==="true"){return true}else{if(parseStr.match(/^\s*[,:]/gm)){parseStr=parseStr.slice(1)}return yielding=new ParseError("Unexpected Token",position())}case"f":if(yielding instanceof ParseError){return yielding}word=wordCheck();if(word==="false"){return false}else{if(parseStr.match(/^\s*[,:]/gm)){parseStr=parseStr.slice(1)}return yielding=new ParseError("Unexpected Token",position())}case"n":if(yielding instanceof ParseError){return yielding}word=wordCheck();if(word==="null"){return null}else{if(parseStr.match(/^\s*[,:]/gm)){parseStr=parseStr.slice(1)}return yielding=new ParseError("Unexpected Token",position())}default:if(yielding instanceof ParseError){return yielding}if(parseStr.match(/^[,:]{1}/gm)){parseStr=parseStr.slice(1)}if(parseStr.match(/^[\[\{]{1}/gm)){parseStr=parseStr.slice(1)}return yielding=new ParseError("Unexpected Token",position())}}}function*yieldBridge(){if(yielding instanceof ParseError){return yielding}yielding=yield*parseYield()}let rs=yieldBridge();let gen=rs.next();let yieldCPU=()=>{setTimeout(()=>{gen=rs.next();if(gen&&gen.done===true){if(isValidJson(yielding)&&(typeof parseStr==="string"||parseStr instanceof String)){if(parseStr.length<=0){resolve(yielding)}else{console.error(new ParseError("Unexpected non-whitespace character after JSON",position()));resolve(null)}}else if(yielding instanceof ParseError){console.error(yielding);resolve(null)}else if(typeof yielding==="string"||yielding instanceof String){console.error(new ParseError("Unexpected Type",null,yielding));resolve(null)}else{console.error(new ParseError("Unexpected Type",yielding,null,yielding?.constructor.name));resolve(null)}}else{yieldCPU()}},0)};return yieldCPU()})}