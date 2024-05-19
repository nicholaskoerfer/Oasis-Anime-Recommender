import { get } from "svelte/store"
import { isAndroid, arraySum } from "./others/helper.js"
import { appID, dataStatus, progress } from "./globalValues.js"
import getWebVersion from "../version.js"

let loadedRequestUrlPromises = {}
let loadedRequestUrls = {}
let chunkLoadingLength = {}
const cacheRequest = async (url, totalLength, status, chunkOptions) => {
    if (url instanceof Array) {
        let joinedURL = url.join("KANSHI-SEP")
        if (loadedRequestUrls[joinedURL]) {
            return loadedRequestUrls[joinedURL]
        } else if (loadedRequestUrlPromises[joinedURL]) {
            return loadedRequestUrlPromises[joinedURL]
        } else {
            loadedRequestUrlPromises[joinedURL] = new Promise((resolve, reject) => {
                chunkLoadingLength[joinedURL] = chunkLoadingLength[joinedURL] ?? []
                Promise.all(url.map((chunkUrl, idx) => {
                    if (!chunkLoadingLength[joinedURL]) {
                        chunkLoadingLength[joinedURL] = []
                    }
                    chunkLoadingLength[joinedURL][idx] = 0
                    return cacheRequest(chunkUrl, totalLength, status, { joinedURL, chunkIdx: idx })
                }))
                    .then((chunks) => {
                        let blobUrl = URL.createObjectURL(new Blob([chunks.join("")], { type: 'application/javascript' }));
                        loadedRequestUrls[joinedURL] = blobUrl;
                        chunkLoadingLength[joinedURL] = loadedRequestUrlPromises[joinedURL] = null
                        resolve(blobUrl)
                    })
                    .catch((e) => {
                        chunkLoadingLength[joinedURL] = loadedRequestUrlPromises[joinedURL] = null
                        reject(e)
                    })
            })
            return loadedRequestUrlPromises[joinedURL]
        }
    } else if (loadedRequestUrls[url]) {
        return loadedRequestUrls[url]
    } else if (loadedRequestUrlPromises[url]) {
        return loadedRequestUrlPromises[url]
    } else if (!window?.location?.protocol?.includes?.("file")) {
        loadedRequestUrlPromises[url] = new Promise(async (resolve) => {
            let app_id = get(appID)
            if (!app_id) {
                app_id = await getWebVersion()
                if (app_id) {
                    appID.set(app_id)
                }
            }
            if (typeof app_id !== "number") {
                loadedRequestUrlPromises[url] = null
                resolve(url)
            } else {
                const isChunk = chunkOptions != null
                let newUrl = url + "?v=" + app_id
                fetch(newUrl, {
                    headers: {
                        'Cache-Control': 'public, max-age=31536000, immutable',
                    },
                    cache: 'force-cache'
                }).then(async response => {
                    if (totalLength && status) {
                        const reader = response?.body?.getReader?.();
                        if (typeof (reader?.read) === "function") {
                            try {
                                return new Response(new ReadableStream({
                                    async start(controller) {
                                        let receivedLength = 0;
                                        let streamStatusTimeout, isDataStatusShowing;
                                        while (true) {
                                            const { done, value } = await reader.read()
                                            if (done) {
                                                clearTimeout(streamStatusTimeout)
                                                dataStatus.set(null)
                                                progress.set(100)
                                                return controller.close()
                                            }
                                            receivedLength += value?.byteLength || value?.length || 0;
                                            if (chunkOptions) {
                                                let { joinedURL, chunkIdx } = chunkOptions || {}
                                                if (chunkLoadingLength[joinedURL]?.[chunkIdx] != null) {
                                                    chunkLoadingLength[joinedURL][chunkIdx] = receivedLength
                                                }
                                            }
                                            if (!isDataStatusShowing) {
                                                isDataStatusShowing = true
                                                streamStatusTimeout = setTimeout(() => {
                                                    let percent
                                                    if (chunkOptions) {
                                                        let { joinedURL } = chunkOptions || {}
                                                        if (chunkLoadingLength[joinedURL]) {
                                                            percent = (arraySum(chunkLoadingLength[joinedURL]) / totalLength) * 100
                                                        }
                                                    } else {
                                                        percent = (receivedLength / totalLength) * 100
                                                    }
                                                    let currentProgress = get(progress)
                                                    if (percent > 0 && percent <= 100
                                                        && (
                                                            !currentProgress
                                                            || currentProgress >= 100
                                                            || percent > currentProgress)
                                                    ) {
                                                        progress.set(percent)
                                                        dataStatus.set(`${percent.toFixed(2)}% ` + status)
                                                    }
                                                    isDataStatusShowing = false
                                                }, 17)
                                            }
                                            controller.enqueue(value)
                                        }
                                    }
                                }));
                            } catch {
                                resolve(await cacheRequest(url, undefined, undefined, isChunk))
                                return
                            }
                        } else {
                            resolve(await cacheRequest(url, undefined, undefined, isChunk))
                            return
                        }
                    } else {
                        return response
                    }
                })
                    .then(async response => {
                        if (response) {
                            return await (isChunk ? response.text() : response.blob())
                        }
                    })
                    .then(result => {
                        if (result) {
                            if (isChunk) {
                                resolve(result)
                            } else {
                                try {
                                    let blobUrl = URL.createObjectURL(result);
                                    loadedRequestUrls[url] = blobUrl;
                                    loadedRequestUrlPromises[url] = null
                                    resolve(blobUrl)
                                } catch (e) {
                                    loadedRequestUrlPromises[url] = null
                                    resolve(url)
                                }
                            }
                        }
                    })
                    .catch(() => {
                        loadedRequestUrlPromises[url] = null
                        resolve(url)
                    })
            }
        })
        return loadedRequestUrlPromises[url]
    } else {
        return url
    }
}

const emptyImage = "data:image/png;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
const android = isAndroid()
let loadedImagePromises = {}
let loadedImages = {}
const cacheImage = (url, width, height) => {
    if (loadedImages[url]) {
        return loadedImages[url]
    } else if (loadedImagePromises[url]) {
        return loadedImagePromises[url]
    } else if (window?.location?.origin?.includes?.('https://u-kuro.github.io') && android && window?.["Kanshi.Anime.Recommendations.Anilist.W~uPtWCq=vG$TR:Zl^#t<vdS]I~N70.isOwner"] === true) {
        loadedImagePromises[url] = new Promise(async (resolve) => {
            let newUrl = "https://cors-anywhere-kuro.vercel.app/api?url=" + url;
            fetch(newUrl, {
                headers: {
                    'Cache-Control': 'public, max-age=31536000, immutable',
                },
                cache: 'force-cache'
            }).then(async response => await response.blob())
                .then(blob => {
                    try {
                        let imgUrl = URL.createObjectURL(blob);
                        let img = new Image();
                        img.src = imgUrl
                        img.onload = () => {
                            try {
                                let canvas = document.createElement('canvas')
                                canvas.width = width || img.naturalWidth
                                canvas.height = height || img.naturalHeight
                                let ctx = canvas.getContext('2d')
                                ctx.drawImage(img, 0, 0)
                                canvas.toBlob((blob) => {
                                    try {
                                        let blobUrl = URL.createObjectURL(blob)
                                        loadedImages[url] = blobUrl
                                        loadedImagePromises[url] = null
                                        resolve(blobUrl)
                                    } catch (e) {
                                        loadedImages[url] = imgUrl
                                        loadedImagePromises[url] = null
                                        resolve(imgUrl)
                                    }
                                }, 'image/webp', 0.8)
                            } catch (e) {
                                loadedImages[url] = imgUrl
                                loadedImagePromises[url] = null
                                resolve(imgUrl)
                            }
                        }
                        img.onerror = () => {
                            loadedImagePromises[url] = null
                            resolve(url)
                        }
                    } catch (e) {
                        loadedImagePromises[url] = null
                        resolve(url)
                    }
                })
                .catch(e => {
                    loadedImagePromises[url] = null
                    resolve(url)
                })
        })
        return loadedImagePromises[url]
    } else if (url) {
        return url
    } else {
        return emptyImage
    }
}
export { cacheRequest, cacheImage }