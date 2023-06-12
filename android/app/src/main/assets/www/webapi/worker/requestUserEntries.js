let db;
self.onmessage = async ({ data }) => {
    if (!db) await IDBinit()
    let username = data?.username
    let savedUsername = await retrieveJSON("username")
    let lastUserAnimeUpdate = await retrieveJSON("lastUserAnimeUpdate")
    let userEntriesLen = (await retrieveJSON("userEntries") || []).length

    if (typeof savedUsername === "string" && userEntriesLen < 1) {
        username = savedUsername
        getUserEntries() // Empty User Entries
    } else if (typeof savedUsername === "string" && userEntriesLen > 0 && (username === savedUsername || !username)) {
        username = savedUsername
        recallUE() // Check/Update Same User
    } else if ((typeof username === "string" && username !== savedUsername)) {
        getUserEntries() // Get New User Data
    } else {
        self.postMessage({ message: "No Anilist Username Found" })
    }

    function recallUE() {
        if (lastUserAnimeUpdate instanceof Date && !isNaN(lastUserAnimeUpdate)) {
            self.postMessage({ status: "Checking Latest User Entries" })
            fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Cache-Control': 'max-age=31536000, immutable'
                },
                body: JSON.stringify({
                    query: `{User(name: "${username}"){updatedAt}}`
                })
            }).then(async (response) => {
                return await response.json()
            })
                .then((result) => {
                    let error;
                    if (typeof (error = result?.errors?.[0]?.message) === "string") {
                        self.postMessage({ status: error || "Error in Checking Entries" })
                        self.postMessage({ message: error })
                    } else {
                        let currentUserAnimeUpdate = new Date(result?.data?.User?.updatedAt * 1000)
                        if (currentUserAnimeUpdate instanceof Date && !isNaN(currentUserAnimeUpdate)) {
                            if (currentUserAnimeUpdate > lastUserAnimeUpdate) {
                                self.postMessage({ status: "Found latest User Entries" })
                                getUserEntries()
                            } else {
                                self.postMessage({ status: null })
                                self.postMessage({ message: "User Entries is Up to Date" })
                            }
                        }
                    }
                })
                .catch((error) => {
                    let headers = error.headers;
                    let errorText = error.message;
                    if (errorText === 'User not found') {
                        // Handle the specific error here
                        self.postMessage({ status: null })
                        self.postMessage({ message: 'User not found' })
                    } else {
                        let secondsPassed = 60
                        let rateLimitInterval = setInterval(() => {
                            self.postMessage({ status: `Rate Limit: ${msToTime(secondsPassed * 1000)}` })
                            --secondsPassed
                        }, 1000)
                        setTimeout(() => {
                            clearInterval(rateLimitInterval)
                            return recallUE();
                        }, 60000);
                    }
                })
        } else {
            getUserEntries()
        }
    }

    function getUserEntries() {
        let userEntries = [];
        let maxAnimePerChunk = 500
        let currentUserAnimeUpdate;
        self.postMessage({ status: "Getting User Entries: 0" })
        function recallAV(chunk) {
            fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Cache-Control': 'max-age=31536000, immutable'
                },
                body: JSON.stringify({
                    query: `
                        {
                            MediaListCollection(
                            userName: "${username}",
                            chunk: ${chunk},
                            perChunk: ${maxAnimePerChunk},
                            forceSingleCompletedList: true,
                            type: ANIME
                            ) {
                                hasNextChunk
                                lists {
                                    entries {
                                        status
                                        media {
                                            id
                                        }
                                        score
                                    }
                                }
                                user {
                                    updatedAt
                                }
                            }
                        }
                    `
                })
            })
                .then(async (response) => {
                    let headers = response.headers
                    let result = await response.json()
                    return { result, headers }
                })
                .then(({ result, headers }) => {
                    let error;
                    if (typeof (error = result?.errors?.[0]?.message) === "string") {
                        self.postMessage({ status: error })
                        self.postMessage({ message: error })
                    } else {
                        let collection = result?.data?.MediaListCollection
                        if (!(currentUserAnimeUpdate instanceof Date) || isNaN(currentUserAnimeUpdate)) {
                            currentUserAnimeUpdate = new Date(collection?.user?.updatedAt * 1000)
                        }
                        let userList = collection?.lists ?? []
                        let hasNextChunk = (result?.data?.MediaListCollection?.hasNextChunk ?? (userList?.length ?? 0) > 0)
                        for (let i = 0; i < userList.length; i++) {
                            userEntries = userEntries.concat(userList[i]?.entries ?? [])
                        }
                        self.postMessage({ status: "Getting User Entries: " + userEntries.length })
                        if (hasNextChunk) {
                            // Handle the successful response here
                            if (headers?.get('x-ratelimit-remaining') > 0) {
                                return recallAV(++chunk);
                            } else {
                                let secondsPassed = 60
                                let rateLimitInterval = setInterval(() => {
                                    self.postMessage({ status: `Rate Limit: ${msToTime(secondsPassed * 1000)}` })
                                    --secondsPassed
                                }, 1000)
                                setTimeout(() => {
                                    clearInterval(rateLimitInterval)
                                    return recallAV(++chunk);
                                }, 60000);
                            }
                        } else {
                            (async () => {
                                if (currentUserAnimeUpdate instanceof Date && !isNaN(currentUserAnimeUpdate)) {
                                    await saveJSON(currentUserAnimeUpdate, "lastUserAnimeUpdate")
                                }
                                await saveJSON(userEntries, "userEntries")
                                await saveJSON(username, "username")
                                self.postMessage({ status: null })
                                self.postMessage({ updateRecommendationList: true })
                                self.postMessage({ newusername: username })
                            })();
                        }
                    }
                })
                .catch((error) => {
                    let headers = error.headers;
                    let errorText = error.message;
                    if (errorText === 'User not found') {
                        // Handle the specific error here
                        self.postMessage({ status: null })
                        self.postMessage({ message: 'User not found' })
                    } else {
                        if (headers?.get('x-ratelimit-remaining') > 0) {
                            return recallAV(chunk);
                        } else {
                            let secondsPassed = 60
                            let rateLimitInterval = setInterval(() => {
                                self.postMessage({ status: `Rate Limit: ${msToTime(secondsPassed * 1000)}` })
                                --secondsPassed
                            }, 1000)
                            setTimeout(() => {
                                clearInterval(rateLimitInterval)
                                return recallAV(chunk);
                            }, 60000);
                        }
                    }
                });
        }
        recallAV(1)
    }
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
            return resolve();
        };
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
function msToTime(duration) {
    let seconds = Math.floor((duration / 1000) % 60),
        minutes = Math.floor((duration / (1000 * 60)) % 60),
        hours = Math.floor((duration / (1000 * 60 * 60)) % 24),
        days = Math.floor((duration / (1000 * 60 * 60 * 24)) % 7),
        weeks = Math.floor((duration / (1000 * 60 * 60 * 24 * 7)) % 4),
        months = Math.floor((duration / (1000 * 60 * 60 * 24 * 7 * 4)) % 12)
    years = Math.floor((duration / (1000 * 60 * 60 * 24 * 7 * 4 * 12)) % 10)
    decades = Math.floor((duration / (1000 * 60 * 60 * 24 * 7 * 4 * 12 * 10)) % 10)
    century = Math.floor((duration / (1000 * 60 * 60 * 24 * 7 * 4 * 12 * 10 * 10)) % 10)
    millenium = Math.floor((duration / (1000 * 60 * 60 * 24 * 7 * 4 * 12 * 10 * 10 * 10)) % 10)
    let time = []
    if (millenium <= 0 && century <= 0 && decades <= 0 && years <= 0 && months <= 0 && weeks <= 0 && days <= 0 && hours <= 0 && minutes <= 0 && seconds <= 0) return "0s"
    if (millenium > 0) time.push(millenium === 1 ? `${millenium}mil` : `${millenium}mils`)
    if (decades > 0) time.push(decades === 1 ? `${decades}de` : `${decades}des`)
    if (years > 0) time.push(`${years}y`)
    if (months > 0) time.push(months === 1 ? `${months}mo` : `${months}mos`)
    if (weeks > 0) time.push(`${weeks}w`)
    if (days > 0) time.push(`${days}d`)
    if (hours > 0) time.push(`${hours}h`)
    if (minutes > 0) time.push(`${minutes}m`)
    if (seconds > 0) time.push(`${seconds}s`)
    return time.join(" ")
}