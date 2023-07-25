let request, db;

self.onmessage = async ({ data }) => {
    if (!db) {
        await IDBinit();
    }
    self.postMessage({ status: "Exporting User Data..." })
    if (data === 'android') {
        self.postMessage({ state: 0 }) // Start Deleting Existing File
    }
    const username = await retrieveJSON("username");
    let backUpData = {
        username: username,
        lastAnimeUpdate: await retrieveJSON("lastAnimeUpdate"),
        lastAiringUpdateDate: await retrieveJSON("lastAiringUpdateDate"),
        lastUserAnimeUpdate: await retrieveJSON("lastUserAnimeUpdate"),
        lastRunnedAutoUpdateDate: await retrieveJSON("lastRunnedAutoUpdateDate"),
        lastRunnedAutoExportDate: new Date(),
        activeTagFilters: await retrieveJSON("activeTagFilters"),
        hiddenEntries: await retrieveJSON("hiddenEntries"),
        userEntries: await retrieveJSON("userEntries"),
        filterOptions: await retrieveJSON("filterOptions"),
        animeEntries: await retrieveJSON("animeEntries"),
    };
    self.postMessage({ progress: 0 })
    let maxRecursion = 0;
    function countRecursiveCalls(x) {
        maxRecursion++;
        if (isJsonObject(x)) {
            for (const value of Object.values(x)) {
                if (value === undefined) continue
                if (isJsonObject(value) || value instanceof Array) {
                    countRecursiveCalls(value);
                }
            }
        } else if (x instanceof Array) {
            for (let i = 0; i < x.length; i++) {
                let value = x[i]
                if (isJsonObject(value) || value instanceof Array) {
                    countRecursiveCalls(value);
                }
            }
        }
    }
    countRecursiveCalls(backUpData)
    if (data === 'android') {
        const byteSize = 64 * 1024 // 64KB
        let chunkStr = ''
        let completedRecursionCalls = 0;
        let currentDate = performance.now()
        function stringify(x) {
            if (chunkStr.length >= byteSize) {
                self.postMessage({
                    chunk: chunkStr,
                    state: 1
                })
                chunkStr = ''
            }
            completedRecursionCalls++;
            if (Math.abs(performance.now() - currentDate) >= 50) {
                self.postMessage({ progress: (completedRecursionCalls / maxRecursion) * 100 })
                currentDate = performance.now()
            }
            let first = true;
            if (isJsonObject(x)) {
                chunkStr += '{'
                for (const [k, v] of Object.entries(x)) {
                    if (v === undefined) continue
                    if (isJsonObject(v) || v instanceof Array) {
                        if (first) {
                            first = false
                            chunkStr += `${JSON.stringify(k)}:`
                        } else {
                            chunkStr += `,${JSON.stringify(k)}:`
                        }
                        stringify(v);
                    } else {
                        if (first) {
                            first = false
                            chunkStr += `${JSON.stringify(k)}:${JSON.stringify(v)}`
                        } else {
                            chunkStr += `,${JSON.stringify(k)}:${JSON.stringify(v)}`
                        }
                    }
                }
                chunkStr += '}'
            } else if (x instanceof Array) {
                chunkStr += '[';
                for (let i = 0; i < x.length; i++) {
                    let v = x[i]
                    if (isJsonObject(v) || v instanceof Array) {
                        if (first) { first = false }
                        else { chunkStr += ',' }
                        stringify(v);
                    } else {
                        if (first) {
                            first = false
                            chunkStr += JSON.stringify(v)
                        } else {
                            chunkStr += `,${JSON.stringify(v)}`
                        }
                    }
                }
                chunkStr += ']'
            }
            return
        }
        stringify(backUpData)
        backUpData = null
        await saveJSON(new Date(), "lastRunnedAutoExportDate");
        self.postMessage({ status: "Data has been Exported..." })
        self.postMessage({ progress: 100 })
        self.postMessage({ status: null })
        self.postMessage({
            chunk: chunkStr,
            state: 2,
            username: username
        })
    } else {
        let blob = JSONToBlob(backUpData, maxRecursion)
        backUpData = null
        let url = URL.createObjectURL(blob);
        await saveJSON(new Date(), "lastRunnedAutoExportDate");
        self.postMessage({ status: "Data has been Exported..." })
        self.postMessage({ progress: 100 })
        self.postMessage({ status: null })
        self.postMessage({ url: url, username: username });
    }
};


function isJsonObject(obj) {
    return Object.prototype.toString.call(obj) === "[object Object]"
}
async function IDBinit() {
    return await new Promise((resolve) => {
        request = indexedDB.open(
            "Kanshi.Anime.Recommendations.Anilist.W~uPtWCq=vG$TR:Zl^#t<vdS]I~N70",
            1
        );
        request.onerror = (error) => {
            console.error(error);
        };
        request.onsuccess = (event) => {
            db = event.target.result;
            return resolve();
        };
        request.onupgradeneeded = (event) => {
            db = event.target.result;
            db.createObjectStore("MyObjectStore");
            let transaction = event.target.transaction
            transaction.oncomplete = () => {
                return resolve();
            }
        };
    });
}
async function retrieveJSON(name) {
    return await new Promise((resolve) => {
        try {
            let read = db
                .transaction("MyObjectStore", "readwrite")
                .objectStore("MyObjectStore")
                .get(name);
            read.onsuccess = () => {
                return resolve(read.result);
            };
            read.onerror = (error) => {
                console.error(error);
                return resolve();
            };
        } catch (ex) {
            console.error(ex);
            return resolve();
        }
    });
}
async function saveJSON(data, name) {
    return await new Promise(async (resolve, reject) => {
        try {
            let write = db
                .transaction("MyObjectStore", "readwrite")
                .objectStore("MyObjectStore")
                .openCursor();
            write.onsuccess = async (event) => {
                let put = await db
                    .transaction("MyObjectStore", "readwrite")
                    .objectStore("MyObjectStore")
                    .put(data, name);
                put.onsuccess = (event) => {
                    return resolve();
                }
                put.onerror = (event) => {
                    return resolve();
                }
            };
            write.onerror = async (error) => {
                console.error(error);
                return reject()
            };
        } catch (ex) {
            console.error(ex)
        }
    });
}
function JSONToBlob(object, _maxRecursion) {
    let propertyStrings = [];
    let chunkStr = '';
    const maxRecursion = _maxRecursion
    const maxByteSize = 4 * 1024 * 1024; // Maximum byte 4MB size for each chunk
    function isJsonObject(obj) {
        return Object.prototype.toString.call(obj) === "[object Object]"
    }
    let currentDate = performance.now();
    let completedRecursionCalls = 0
    function bloberize(x) {
        if (chunkStr.length >= maxByteSize) {
            const propertyBlob = new Blob([chunkStr], { type: 'text/plain' });
            propertyStrings.push(propertyBlob);
            chunkStr = '';
        }
        completedRecursionCalls++;
        if (Math.abs(performance.now() - currentDate) >= 50) {
            self.postMessage({ progress: (completedRecursionCalls / maxRecursion) * 100 })
            currentDate = performance.now()
        }
        let first = true;
        if (isJsonObject(x)) {
            chunkStr += '{';
            for (let [k, v] of Object.entries(x)) {
                if (v === undefined) continue;
                if (isJsonObject(v) || v instanceof Array) {
                    if (first) {
                        first = false;
                        chunkStr += `${JSON.stringify(k)}:`;
                    } else {
                        chunkStr += `,${JSON.stringify(k)}:`;
                    }
                    bloberize(v);
                } else {
                    if (first) {
                        first = false;
                        chunkStr += `${JSON.stringify(k)}:${JSON.stringify(v)}`;
                    } else {
                        chunkStr += `,${JSON.stringify(k)}:${JSON.stringify(v)}`;
                    }
                }
            }
            chunkStr += '}';
        } else if (x instanceof Array) {
            chunkStr += '[';
            for (let i = 0; i < x.length; i++) {
                let v = x[i];
                if (isJsonObject(v) || v instanceof Array) {
                    if (first) {
                        first = false;
                    } else {
                        chunkStr += ',';
                    }
                    bloberize(v);
                } else {
                    if (first) {
                        first = false;
                        chunkStr += JSON.stringify(v);
                    } else {
                        chunkStr += `,${JSON.stringify(v)}`;
                    }
                }
            }
            chunkStr += ']';
        }
    }
    bloberize(object)
    const propertyBlob = new Blob([chunkStr], { type: 'text/plain' });
    propertyStrings.push(propertyBlob);
    chunkStr = '';
    return new Blob(propertyStrings, { type: 'application/json' });
}