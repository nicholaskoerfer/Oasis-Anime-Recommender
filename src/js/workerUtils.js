import { dataStatus } from "./globalValues";
import { get } from "svelte/store";
let terminateDelay = 1000;

let animeLoaderTerminateTimeout;
let animeLoaderWorker;
const animeLoader = (_data) => {
    console.log('eyyy')
    return new Promise((resolve, reject) => {
        if (animeLoaderWorker) animeLoaderWorker.terminate();
        animeLoaderWorker = new Worker("./webapi/worker/animeLoader.js")
        if(animeLoaderTerminateTimeout) clearTimeout(animeLoaderTerminateTimeout)
        animeLoaderWorker.postMessage(_data)
        animeLoaderWorker.onmessage = ({data}) => {
            if(data?.status!==undefined) dataStatus.set(data.status)
            else{
                animeLoaderWorker.onmessage = null
                resolve({finalAnimeList: data.finalAnimeList, animeLoaderWorker})
            }
        }
        animeLoaderWorker.onerror = (error) => {
            reject(error)
        }
    })
}

const getIDBdata = (name) => {
    let worker = new Worker("./webapi/worker/getIDBdata.js")
    return new Promise((resolve, reject) => {
        worker.postMessage({name:name})
        worker.onmessage = ({data}) => {
            if(data?.status!==undefined) dataStatus.set(data.status)
            else{
                worker.terminate()
                resolve(data)
            }
        }
        worker.onerror = (error) => {
            reject(error)
        }
    })
}

let saveIDBdataWorker;
const saveIDBdata = (data, name) => {
    return new Promise((resolve, reject) => {
        if(!saveIDBdataWorker) saveIDBdataWorker = new Worker("./webapi/worker/saveIDBdata.js")
        saveIDBdataWorker.onmessage = ({data}) => {
            if(data?.status!==undefined) dataStatus.set(data.status)
            else{
                resolve()
            }
        }
        saveIDBdataWorker.onerror = (error) => {
            reject(error)
        }
        saveIDBdataWorker.postMessage({data:data, name:name})
    })
}

let requestAnimeEntriesTerminateTimeout;
const requestAnimeEntries = (_data) => {
    return new Promise((resolve, reject) => {
        let worker = new Worker("./webapi/worker/requestAnimeEntries.js")
        if(requestAnimeEntriesTerminateTimeout) clearTimeout(requestAnimeEntriesTerminateTimeout)
        worker.postMessage(_data)
        worker.onmessage = ({data}) => {
            if(data?.status!==undefined) dataStatus.set(data.status)
            else{
                requestAnimeEntriesTerminateTimeout = setTimeout(()=>{
                    worker.terminate();
                },terminateDelay)
                resolve(data)
            }
        }
        worker.onerror = (error) => {
            reject(error)
        }
    })
}

let requestUserEntriesTerminateTimeout
const requestUserEntries = (_data) => {
    return new Promise((resolve, reject) => {
        let worker = new Worker("./webapi/worker/requestUserEntries.js")
        if(requestUserEntriesTerminateTimeout) clearTimeout(requestUserEntriesTerminateTimeout)
        worker.postMessage(_data)
        worker.onmessage = ({data}) => {
            if(data?.status!==undefined) dataStatus.set(data.status)
            else{
                requestUserEntriesTerminateTimeout = setTimeout(()=>{
                    worker.terminate();
                },terminateDelay)
                resolve(data)
            }
        }
        worker.onerror = (error) => {
            reject(error)
        }
    })
}

let processRecommendedAnimeListTerminateTimeout;
let processRecommendedAnimeListWorker;
const processRecommendedAnimeList = (_data) => {
  return new Promise((resolve, reject) => {
    if (processRecommendedAnimeListWorker) processRecommendedAnimeListWorker.terminate();
    processRecommendedAnimeListWorker = new Worker("./webapi/worker/processRecommendedAnimeList.js");
    if (processRecommendedAnimeListTerminateTimeout) clearTimeout(processRecommendedAnimeListTerminateTimeout);
    processRecommendedAnimeListWorker.postMessage(_data);
    processRecommendedAnimeListWorker.onmessage = ({ data }) => {
      if (typeof data?.status === "string") {
        dataStatus.set(data.status);
      } else {
        processRecommendedAnimeListTerminateTimeout = setTimeout(() => {
          processRecommendedAnimeListWorker.terminate();
        }, terminateDelay);
        resolve(data);
      }
    };
    processRecommendedAnimeListWorker.onerror = (error) => {
      reject(error);
    };
  });
};

let getAnimeEntriesTerminateTimeout
const getAnimeEntries = (_data) => {
    return new Promise((resolve, reject) => {
        let worker = new Worker("./webapi/worker/getAnimeEntries.js")
        if(getAnimeEntriesTerminateTimeout) clearTimeout(getAnimeEntriesTerminateTimeout)
        worker.postMessage(_data)
        worker.onmessage = ({data}) => {
            if(data?.status!==undefined) dataStatus.set(data.status)
            else{
                getAnimeEntriesTerminateTimeout = setTimeout(()=>{
                    worker.terminate();
                },terminateDelay)
                resolve(data)
            }
        }
        worker.onerror = (error) => {
            reject(error)
        }
    })
}

let getFilterOptionsTerminateTimeout
const getFilterOptions = (_data) => {
    return new Promise((resolve, reject) => {
        let worker = new Worker("./webapi/worker/getFilterOptions.js")
        if(getFilterOptionsTerminateTimeout) clearTimeout(getFilterOptionsTerminateTimeout)
        worker.postMessage(_data)
        worker.onmessage = ({data}) => {
            if(data?.status!==undefined) dataStatus.set(data.status)
            else{
                getFilterOptionsTerminateTimeout = setTimeout(()=>{
                    worker.terminate();
                },terminateDelay)
                resolve(data)
            }
        }
        worker.onerror = (error) => {
            reject(error)
        }
    })
}

let getAnimeFranchisesTerminateTimeout
const getAnimeFranchises = (_data) => {
    return new Promise((resolve, reject) => {
        let worker = new Worker("./webapi/worker/getAnimeFranchises.js")
        if(getAnimeFranchisesTerminateTimeout) clearTimeout(getAnimeFranchisesTerminateTimeout)
        worker.postMessage(_data)
        worker.onmessage = ({data}) => {
            if(data?.status!==undefined) dataStatus.set(data.status)
            else{
                getAnimeFranchisesTerminateTimeout = setTimeout(()=>{
                    worker.terminate();
                },terminateDelay)
                resolve(data)
            }
        }
        worker.onerror = (error) => {
            reject(error)
        }
    })
}

export { 
    saveIDBdata,
    getIDBdata,
    getAnimeEntries,
    getFilterOptions,
    getAnimeFranchises,
    requestAnimeEntries,
    requestUserEntries,
    processRecommendedAnimeList,
    animeLoader
}