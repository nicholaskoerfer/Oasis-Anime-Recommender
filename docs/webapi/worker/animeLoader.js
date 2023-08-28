let db,
    finalAnimeList,
    filteredList,
    shownIds = {},
    keyword,
    loadLimit = 1,
    firstLoadLimit = 13,
    seasonOrder = { fall: 3, summer: 2, spring: 1, winter: 0 };
// Init Content Caution
let semiCautionContents = {
    genres: {},
    tags: {},
},
    cautionContents = {
        genres: {},
        tags: {},
    };
let sortName, sortType;
self.onmessage = async ({ data }) => {
    if (!db) await IDBinit()
    if (data?.checkStatus) {
        self.postMessage({ isAlive: true })
    } else if (data?.getEarlisetReleaseDate !== undefined) {
        let loadedList = finalAnimeList.slice(0, finalAnimeList.length - filteredList.length)
        if (loadedList.length) {
            loadedList = loadedList.filter((e) => e?.nextAiringEpisode?.airingAt && new Date(e?.nextAiringEpisode?.airingAt * 1000) > new Date)
            if (loadedList.length) {
                loadedList.sort((a, b) => {
                    let x = Number(a?.nextAiringEpisode?.airingAt),
                        y = Number(b?.nextAiringEpisode?.airingAt);
                    if (!x) return 1;
                    if (!y) return -1;
                    return x - y
                })
                let earliestReleaseDate = loadedList?.[0]?.nextAiringEpisode?.airingAt * 1000
                if (typeof earliestReleaseDate === "number") {
                    let timeBeforeEarliestReleaseDate = Math.max(earliestReleaseDate - new Date().getTime(), 0)
                    self.postMessage({
                        getEarlisetReleaseDate: true,
                        timeBeforeEarliestReleaseDate: timeBeforeEarliestReleaseDate,
                        earliestReleaseDate: earliestReleaseDate
                    });
                }
            }
        }
    } else if (data?.reload !== undefined) { // Animation Async
        self.postMessage({
            reload: data?.reload,
            finalAnimeList: editAnimeToLoad(finalAnimeList.slice(0, firstLoadLimit)),
        });
        filteredList = finalAnimeList.slice(firstLoadLimit)
    } else if (data?.filterKeyword !== undefined) {
        keyword = data?.filterKeyword
        if (!keyword) {
            filteredList = finalAnimeList
        } else {
            filteredList = finalAnimeList.filter(({ title }) => {
                if (isJsonObject(title)) {
                    let titles = Object.values(title)
                    return titles.some((_title) => _title?.toLowerCase?.().includes(keyword?.trim()?.toLowerCase?.()))
                } else {
                    return title?.toLowerCase?.().includes(keyword?.trim()?.toLowerCase?.())
                }
            })
        }
        self.postMessage({
            isNew: true,
            finalAnimeList: editAnimeToLoad(filteredList.slice(0, firstLoadLimit)),
        });
        filteredList = filteredList.slice(firstLoadLimit)
    } else if (data?.removeID !== undefined) {
        finalAnimeList = finalAnimeList.filter(({ id }) => id !== data.removeID)
        filteredList = filteredList.filter(({ id }) => id !== data.removeID)
        self.postMessage({
            isRemoved: true,
            removedID: data.removeID,
        });
    } else if (data?.loadMore !== undefined) {
        self.postMessage({
            isNew: false,
            isLast: filteredList.length <= loadLimit,
            finalAnimeList: editAnimeToLoad(filteredList.slice(0, loadLimit)),
        });
        filteredList = filteredList.slice(loadLimit)
    } else {
        finalAnimeList = filteredList = []
        shownIds = {}
        if (data?.loadSaved) {
            let savedFinalAnimeList = await retrieveJSON("finalAnimeList") || []
            if (savedFinalAnimeList.length) {
                finalAnimeList = savedFinalAnimeList
                let hiddenEntries = (await retrieveJSON("hiddenEntries")) || {}
                self.postMessage({
                    isNew: true,
                    finalAnimeList: editAnimeToLoad(finalAnimeList.slice(0, firstLoadLimit)),
                    hiddenEntries: hiddenEntries,
                    hasPassedFilters: data?.hasPassedFilters
                });
                filteredList = finalAnimeList.slice(firstLoadLimit)
            }
        }
        if (finalAnimeList?.length) return
        self.postMessage({ status: "Initializing Filters" })
        let activeTagFilters = data?.activeTagFilters || await retrieveJSON("activeTagFilters")

        activeTagFilters?.['Content Caution']?.forEach(({ selected, filterType, optionName, optionType }) => {
            // Included is Semi Caution and Excluded is Caution
            if (selected === "included") {
                if (filterType === 'dropdown') {
                    if (optionType === 'genre') {
                        semiCautionContents.genres[optionName.toLowerCase()] = true
                    } else if (optionType === 'tag') {
                        semiCautionContents.tags[optionName.toLowerCase()] = true
                    }
                }
            } else if (selected === 'excluded') {
                if (filterType === 'dropdown') {
                    if (optionType === 'genre') {
                        cautionContents.genres[optionName.toLowerCase()] = true
                    } else if (optionType === 'tag') {
                        cautionContents.tags[optionName.toLowerCase()] = true
                    }
                }
            }
        })
        // Init Anime Filter
        let flexibleInclusion = {},
            include = {
                genres: {},
                tags: {},
                season: {},
                format: {},
                status: {},
                userStatus: {},
                studios: {},
                year: {},
            },
            exclude = {
                genres: {},
                tags: {},
                season: {},
                format: {},
                status: {},
                userStatus: {},
                studios: {},
                year: {},
            },
            comparisonFilter = {
                weightedScore: null,
                score: null,
                averageScore: null,
                userScore: null,
                popularity: null
            }
        let hideMyAnime = false,
            hiddenList = false,
            hideWatched = false,
            showMyAnime = false,
            showAiring = false,
            showAllSequels = false;
        activeTagFilters?.['Anime Filter']?.forEach(({ selected, filterType, optionName, optionType, optionValue, CMPoperator, CMPNumber }) => {
            if (selected === "included") {
                if (filterType === 'dropdown') {
                    if (optionType === 'flexible inclusion') {
                        flexibleInclusion[optionName.replace('OR: ', '').toLowerCase()] = true
                    } else if (optionType === 'genre') {
                        include.genres[optionName.toLowerCase()] = true
                    } else if (optionType === 'tag') {
                        include.tags[optionName.toLowerCase()] = true
                    } else if (optionType === 'year') {
                        include.year[optionName] = true
                    } else if (optionType === 'season') {
                        include.season[optionName.toLowerCase()] = true
                    } else if (optionType === 'format') {
                        include.format[optionName.toLowerCase()] = true
                    } else if (optionType === 'airing status') {
                        include.status[optionName.toLowerCase()] = true
                    } else if (optionType === 'user status') {
                        include.userStatus[optionName.toLowerCase()] = true
                    } else if (optionType === 'studio') {
                        include.studios[optionName.toLowerCase()] = true
                    }
                } else if (filterType === 'checkbox') {
                    if (optionName.toLowerCase() === 'hidden anime') {
                        hiddenList = true
                    } else if (optionName.toLowerCase() === 'hide my anime') {
                        hideMyAnime = true
                    } else if (optionName.toLowerCase() === 'hide watched') {
                        hideWatched = true
                    } else if (optionName.toLowerCase() === 'show my anime') {
                        showMyAnime = true
                    } else if (optionName.toLowerCase() === 'show airing') {
                        showAiring = true
                    } else if (optionName.toLowerCase() === 'show all sequels') {
                        showAllSequels = true
                    }
                } else if (filterType === 'input number') {
                    if (optionName.toLowerCase() === "weighted score") {
                        comparisonFilter.weightedScore = {
                            operator: CMPoperator,
                            value: parseFloat(CMPNumber ?? optionValue)
                        }
                    } else if (optionName.toLowerCase() === "score") {
                        comparisonFilter.score = {
                            operator: CMPoperator,
                            value: parseFloat(CMPNumber ?? optionValue)
                        }
                    } else if (optionName.toLowerCase() === "average score") {
                        comparisonFilter.averageScore = {
                            operator: CMPoperator,
                            value: parseFloat(CMPNumber ?? optionValue)
                        }
                    } else if (optionName.toLowerCase() === "user score") {
                        comparisonFilter.userScore = {
                            operator: CMPoperator,
                            value: parseFloat(CMPNumber ?? optionValue)
                        }
                    } else if (optionName.toLowerCase() === "popularity") {
                        comparisonFilter.popularity = {
                            operator: CMPoperator,
                            value: parseFloat(CMPNumber ?? optionValue)
                        }
                    }
                }
            } else if (selected === 'excluded') {
                if (filterType === 'dropdown') {
                    if (optionType === 'genre') {
                        exclude.genres[optionName.toLowerCase()] = true
                    } else if (optionType === 'tag') {
                        exclude.tags[optionName.toLowerCase()] = true
                    } else if (optionType === 'year') {
                        exclude.year[optionName] = true
                    } else if (optionType === 'season') {
                        exclude.season[optionName.toLowerCase()] = true
                    } else if (optionType === 'format') {
                        exclude.format[optionName.toLowerCase()] = true
                    } else if (optionType === 'user status') {
                        exclude.userStatus[optionName.toLowerCase()] = true
                    } else if (optionType === 'studio') {
                        exclude.studios[optionName.toLowerCase()] = true
                    }
                }
            }
        })
        self.postMessage({ status: "Filtering Recommendation List" })


        let filterOptions = data?.filterOptions || await retrieveJSON("filterOptions") || []
        let sortFilter = filterOptions.sortFilter?.filter(({ sortType }) => sortType === "desc" || sortType === "asc")?.[0]
        sortName = sortFilter?.sortName || 'weighted score'
        sortType = sortFilter?.sortType || 'desc'
        sortFilter = null

        // Get Hidden Entries
        let hiddenEntries = (await retrieveJSON("hiddenEntries")) || {}
        // Filter and ADD Caution State below
        let recommendedAnimeList = await retrieveJSON("recommendedAnimeList") || []
        finalAnimeList = recommendedAnimeList.filter((anime, idx) => {
            self.postMessage({ progress: Math.min(((idx + 1) / recommendedAnimeList.length) * 100, 95) })
            if (showAiring) {
                if (!ncsCompare(anime?.status, 'releasing')) {
                    return false;
                }
            }

            if (hideMyAnime) {
                if (!ncsCompare(anime?.userStatus, 'unwatched')) {
                    return false;
                }
            }
            if (showMyAnime) {
                if (ncsCompare(anime?.userStatus, 'unwatched')) {
                    return false;
                }
            }

            if (hideWatched) {
                if (['completed', 'dropped'].some((e) => ncsCompare(e, anime?.userStatus))) {
                    return false
                }
            }

            if (hiddenList) {
                // do hidden
                if (hiddenEntries[anime.id] === undefined) {
                    return false
                }
            } else {


                if (hiddenEntries[anime.id] === true) {
                    return false
                }
            }

            // Comparison Filter >=, >, <, <=, number
            if (comparisonFilter.userScore) {
                let operator = comparisonFilter.userScore.operator?.trim?.(),
                    value = comparisonFilter.userScore.value
                if (typeof anime.userScore !== "number") {
                    return false
                } else if (typeof operator === "string" && typeof value === "number") {
                    switch (operator) {
                        case ">=": {
                            if (anime.userScore < value) return false
                            break
                        }
                        case "<=": {
                            if (anime.userScore > value) return false
                            break
                        }
                        case "<": {
                            if (anime.userScore >= value) return false
                            break
                        }
                        case ">": {
                            if (anime.userScore <= value) return false
                            break
                        }
                    }
                } else if (typeof value === "number") {
                    if (anime.userScore !== value) return false
                }
            }

            if (comparisonFilter.averageScore) {
                let operator = comparisonFilter.averageScore.operator?.trim?.(),
                    value = comparisonFilter.averageScore.value
                if (typeof anime.averageScore !== "number") {
                    return false
                } else if (typeof operator === "string" && typeof value === "number") {
                    switch (operator) {
                        case ">=": {
                            if (anime.averageScore < value) return false
                            break
                        }
                        case "<=": {
                            if (anime.averageScore > value) return false
                            break
                        }
                        case "<": {
                            if (anime.averageScore >= value) return false
                            break
                        }
                        case ">": {
                            if (anime.averageScore <= value) return false
                            break
                        }
                    }
                } else if (typeof value === "number") {
                    if (anime.averageScore !== value) return false
                }
            }

            if (comparisonFilter.popularity) {
                let operator = comparisonFilter.popularity.operator?.trim?.(),
                    value = comparisonFilter.popularity.value
                if (typeof anime.popularity !== "number") {
                    return false
                } else if (typeof operator === "string" && typeof value === "number") {
                    switch (operator) {
                        case ">=": {
                            if (anime.popularity < value) return false
                            break
                        }
                        case "<=": {
                            if (anime.popularity > value) return false
                            break
                        }
                        case "<": {
                            if (anime.popularity >= value) return false
                            break
                        }
                        case ">": {
                            if (anime.popularity <= value) return false
                            break
                        }
                    }
                } else if (typeof value === "number") {
                    if (anime.popularity !== value) return false
                }
            }

            if (comparisonFilter.weightedScore) {
                let operator = comparisonFilter.weightedScore.operator?.trim?.(),
                    value = comparisonFilter.weightedScore.value
                if (typeof anime.weightedScore !== "number") {
                    return false
                } else if (typeof operator === "string" && typeof value === "number") {
                    switch (operator) {
                        case ">=": {
                            if (anime.weightedScore < value) return false
                            break
                        }
                        case "<=": {
                            if (anime.weightedScore > value) return false
                            break
                        }
                        case "<": {
                            if (anime.weightedScore >= value) return false
                            break
                        }
                        case ">": {
                            if (anime.weightedScore <= value) return false
                            break
                        }
                    }
                } else if (typeof value === "number") {
                    if (anime.weightedScore !== value) return false
                }
            }

            if (comparisonFilter.score) {
                let operator = comparisonFilter.score.operator?.trim?.(),
                    value = comparisonFilter.score.value
                if (typeof anime.score !== "number") {
                    return false
                } else if (typeof operator === "string" && typeof value === "number") {
                    switch (operator) {
                        case ">=": {
                            if (anime.score < value) return false
                            break
                        }
                        case "<=": {
                            if (anime.score > value) return false
                            break
                        }
                        case "<": {
                            if (anime.score >= value) return false
                            break
                        }
                        case ">": {
                            if (anime.score <= value) return false
                            break
                        }
                    }
                } else if (typeof value === "number") {
                    if (anime.score !== value) return false
                }
            }

            // Should Exclude
            if (typeof anime?.season === 'string' && !jsonIsEmpty(exclude.season) && exclude.season[anime.season.toLowerCase()]) {
                return false
            }

            if (typeof anime?.format === 'string' && !jsonIsEmpty(exclude.format) && exclude.format[anime.format.toLowerCase()]) {
                return false
            }

            if (typeof anime?.userStatus === 'string' && !jsonIsEmpty(exclude.userStatus) && exclude.userStatus[anime.userStatus.toLowerCase()]) {
                return false
            }

            if (typeof anime?.status === 'string' && !jsonIsEmpty(exclude.status) && exclude.status[anime.status.toLowerCase()]) {
                return false
            }

            if (anime?.year && !jsonIsEmpty(exclude.year) && exclude.year[anime.year?.toString?.()?.toLowerCase?.()]) {
                return false
            }

            if (!jsonIsEmpty(exclude.genres)) {
                if (anime.genres.some(e => {
                    if (typeof e !== 'string') return false
                    return exclude.genres[e.toLowerCase()]
                })) return false
            }

            if (!jsonIsEmpty(exclude.tags)) {
                if (anime.tags.some(e => {
                    let tagName = e?.name || e
                    if (typeof tagName !== 'string') return false
                    return exclude.tags[tagName.toLowerCase()]
                })) return false
            }

            if (!jsonIsEmpty(exclude.studios)) {
                for (let studio in anime.studios) {
                    if (typeof studio === 'string' && exclude.studios[studio?.toLowerCase?.()]) {
                        return false
                    }
                }
            }

            // Should Include
            // Should Include OR
            if (!jsonIsEmpty(include.season)) {
                if (!include.season[anime?.season?.toLowerCase?.()]) {
                    return false
                }
            }

            // Should Include OR
            if (!jsonIsEmpty(include.format)) {
                if (!include.format[anime?.format?.toLowerCase?.()]) {
                    return false
                }
            }

            // Should Include OR
            if (!jsonIsEmpty(include.userStatus)) {
                if (!include.userStatus[anime?.userStatus?.toLowerCase?.()]) {
                    return false
                }
            }

            // Should Include OR
            if (!jsonIsEmpty(include.status)) {
                if (!include.status[anime?.status?.toLowerCase?.()]) {
                    return false
                }
            }

            // Should Include OR
            if (!jsonIsEmpty(include.year)) {
                if (!include.year[anime?.year?.toString?.()?.toLowerCase?.()]) {
                    return false
                }
            }

            // Should Include
            if (flexibleInclusion['genre']) {
                // Should Include OR
                if (!jsonIsEmpty(include.genres)) {
                    if (!anime.genres.some(genre => include.genres[genre.toLowerCase()])) {
                        return false
                    }
                }
            } else {
                // Should Include AND                
                for (let genre in include.genres) {
                    if (!anime.genres.some(e => {
                        return ncsCompare(e, genre)
                    })) return false
                }
            }

            if (flexibleInclusion['tag']) {
                // Should Include OR
                if (!jsonIsEmpty(include.tags)) {
                    if (!anime.tags.some(tag => {
                        let tagName = tag?.name || tag
                        include.tags[tagName.toLowerCase()]
                    })) {
                        return false
                    }
                }
            } else {
                // Should Include AND
                for (let tag in include.tags) {
                    if (!anime.tags.some(e => {
                        let tagName = e?.name || e
                        return ncsCompare(tagName, tag)
                    })) return false
                }
            }

            if (flexibleInclusion['studio']) {
                // Should Include OR                               
                if (!jsonIsEmpty(include.studios)) {
                    let isNotIncluded = true
                    for (let studio in anime.studios) {
                        if (include.studios[studio.toLowerCase()]) {
                            isNotIncluded = false
                            break
                        }
                    }
                    if (isNotIncluded) return false
                }
            } else {
                // Should Include AND
                let _studios = Object.keys(anime.studios)
                for (let studio in include.studios) {
                    if (!_studios.some(e => {
                        return ncsCompare(e, studio)
                    })) return false
                }
            }

            // Show All Sequels or Hide Next Sequels that have dropped or unwatched prequel
            let animeRelations = anime?.animeRelations
            if (!showAllSequels && animeRelations instanceof Array) {
                // Conditions
                let isUnwatchedSequel =
                    // Have No Prequel
                    !animeRelations.some((e) => {
                        let animeRelationType = e?.relationType?.trim?.()?.toLowerCase?.();
                        return (typeof animeRelationType === "string" && animeRelationType === "prequel")
                    }) ||
                    // or Have Prequel but...
                    animeRelations.some((e) => {
                        let animeRelationType = e?.relationType?.trim?.()?.toLowerCase?.();
                        let animeRelationID = e?.node?.id;
                        if (
                            typeof animeRelationType === "string" &&
                            animeRelationType === "prequel" &&
                            typeof animeRelationID === "number" &&
                            !isNaN(animeRelationID)
                        ) {
                            let relationAnime = recommendedAnimeList?.find?.((anime) => anime?.id === animeRelationID)
                            let relationStatus = relationAnime?.userStatus?.trim?.()?.toLowerCase?.()
                            // ...Prequel is in the User List and not Dropped
                            if (
                                relationStatus !== "unwatched" &&
                                relationStatus !== "dropped"
                            ) {
                                return true;
                            } else {
                                // ...Prequel is a Small/Unpopular Anime
                                let animePopularity = anime?.popularity
                                let animeRelationPopularity = e?.node?.popularity;
                                return (
                                    typeof animePopularity === "number" && !isNaN(animePopularity) &&
                                    typeof animeRelationPopularity === "number" && !isNaN(animeRelationPopularity) &&
                                    animeRelationPopularity <= animePopularity
                                );
                            }
                        }
                    });
                // Then Don't Include if Sequel 
                if (!isUnwatchedSequel) {
                    return false;
                }
            }
            // Add the recommended Anime
            return true;
        });
        recommendedAnimeList = null
        // Sort List
        if (sortType === "desc") {
            if (sortName === "weighted score") {
                finalAnimeList.sort((a, b) => {
                    let x = Number(a?.weightedScore),
                        y = Number(b?.weightedScore);
                    if (!x) return 1;
                    if (!y) return -1;
                    return y - x
                })
            } else if (sortName === "score") {
                finalAnimeList.sort((a, b) => {
                    let x = Number(a?.score),
                        y = Number(b?.score);
                    if (!x) return 1;
                    if (!y) return -1;
                    return y - x
                })
            } else if (sortName === "average score") {
                finalAnimeList.sort((a, b) => {
                    let x = Number(a?.averageScore),
                        y = Number(b?.averageScore);
                    if (!x) return 1;
                    if (!y) return -1;
                    return y - x
                })
            } else if (sortName === "user score") {
                finalAnimeList.sort((a, b) => {
                    let x = Number(a?.userScore),
                        y = Number(b?.userScore);
                    if (!x) return 1;
                    if (!y) return -1;
                    return y - x
                })
            } else if (sortName === "popularity") {
                finalAnimeList.sort((a, b) => {
                    let x = Number(a?.popularity),
                        y = Number(b?.popularity);
                    if (!x) return 1;
                    if (!y) return -1;
                    return y - x
                })
            } else if (sortName === "date") {
                finalAnimeList.sort((a, b) => {
                    // Sort by year (descending), place falsy values at last
                    let x = a.year ? a.year : Number.MIN_SAFE_INTEGER;
                    let y = b.year ? b.year : Number.MIN_SAFE_INTEGER;
                    if (x !== y) return y - x;
                    // Sort by season (descending), place falsy values at last
                    x = a.season ? a.season.toLowerCase() : "";
                    y = b.season ? b.season.toLowerCase() : "";
                    if (x !== y) return seasonOrder[y] - seasonOrder[x];
                    // Sort by weightedScore (descending), place falsy values at last
                    x = a.weightedScore ? a.weightedScore : Number.MIN_SAFE_INTEGER;
                    y = b.weightedScore ? b.weightedScore : Number.MIN_SAFE_INTEGER;
                    return y - x;
                })
            }
        } else if (sortType === "asc") {
            if (sortName === "weighted score") {
                finalAnimeList.sort((a, b) => {
                    let x = Number(a?.weightedScore),
                        y = Number(b?.weightedScore);
                    if (!x) return 1;
                    if (!y) return -1;
                    return x - y
                })
            } else if (sortName === "score") {
                finalAnimeList.sort((a, b) => {
                    let x = Number(a?.score),
                        y = Number(b?.score);
                    if (!x) return 1;
                    if (!y) return -1;
                    return x - y
                })
            } else if (sortName === "average score") {
                finalAnimeList.sort((a, b) => {
                    let x = Number(a?.averageScore),
                        y = Number(b?.averageScore);
                    if (!x) return 1;
                    if (!y) return -1;
                    return x - y
                })
            } else if (sortName === "user score") {
                finalAnimeList.sort((a, b) => {
                    let x = Number(a?.userScore),
                        y = Number(b?.userScore);
                    if (!x) return 1;
                    if (!y) return -1;
                    return x - y
                })
            } else if (sortName === "popularity") {
                finalAnimeList.sort((a, b) => {
                    let x = Number(a?.popularity),
                        y = Number(b?.popularity);
                    if (!x) return 1;
                    if (!y) return -1;
                    return x - y
                })
            } else if (sortName === "date") {
                finalAnimeList.sort((a, b) => {
                    // Sort by year (ascending), place falsy values at last
                    let x = a.year ? a.year : Number.MAX_SAFE_INTEGER;
                    let y = b.year ? b.year : Number.MAX_SAFE_INTEGER;
                    if (x !== y) return x - y;
                    // Sort by season (ascending), place falsy values at last
                    x = a.season ? a.season.toLowerCase() : "";
                    y = b.season ? b.season.toLowerCase() : "";
                    if (x !== y) return seasonOrder[x] - seasonOrder[y];
                    // Sort by weightedScore (descending), place falsy values at last
                    x = a.weightedScore ? a.weightedScore : Number.MIN_SAFE_INTEGER;
                    y = b.weightedScore ? b.weightedScore : Number.MIN_SAFE_INTEGER;
                    return x - y;
                })
            }
        }
        sortName = sortType = null
        await saveJSON(activeTagFilters, 'activeTagFilters')
        await saveJSON(filterOptions, "filterOptions")
        await saveJSON(finalAnimeList, "finalAnimeList")
        self.postMessage({ status: null })
        self.postMessage({ progress: 100 })
        self.postMessage({
            isNew: true,
            finalAnimeList: editAnimeToLoad(finalAnimeList.slice(0, firstLoadLimit)),
            hiddenEntries: hiddenEntries,
            hasPassedFilters: data?.hasPassedFilters
        });
        filteredList = finalAnimeList.slice(firstLoadLimit)
    }
};
function editAnimeToLoad(shownList = []) {
    return shownList.map((anime) => {
        if (shownIds[anime.id]) return anime
        shownIds[anime.id] = true;
        // Add Cautions
        anime.contentCaution = {
            caution: [],
            semiCaution: []
        }
        // Add Genre Caution
        anime.genres.forEach(genre => {
            if (cautionContents.genres[genre?.toLowerCase?.()]) {
                anime.contentCaution.caution.push(genre)
            } else if (semiCautionContents.genres[genre?.toLowerCase?.()]) {
                anime.contentCaution.semiCaution.push(genre)
            }
        })

        // Add Tag Caution
        anime.tags.forEach(tag => {
            let tagName = tag?.name || tag
            if (cautionContents.tags[tagName?.toLowerCase?.()]) {
                anime.contentCaution.caution.push(tagName)
            } else if (semiCautionContents.tags[tagName?.toLowerCase?.()]) {
                anime.contentCaution.semiCaution.push(tagName)
            }
        })

        // Limit Favorite Contents
        if (isJsonObject(anime.favoriteContents) && !jsonIsEmpty(anime.favoriteContents)) {
            let sortedFavoriteContents = Object.entries(anime.favoriteContents.genres)
                .concat(Object.entries(anime.favoriteContents.tags))
                .concat(Object.entries(anime.favoriteContents.studios))
                .sort((a, b) => {
                    return b[1] - a[1]
                })
                .map(([k, v]) => `${k}: (${formatNumber(v)})`)
            anime.sortedFavoriteContents = sortedFavoriteContents || []
        } else {
            anime.sortedFavoriteContents = []
        }

        // Last Edit Contents for Frontend
        // Edit Genres
        let genres = anime?.genres
        if (genres?.length) {
            let favouriteGenres = anime?.favoriteContents?.genres
            let contentCaution = anime?.contentCaution
            let haveFavorite =
                isJsonObject(favouriteGenres) && !jsonIsEmpty(favouriteGenres),
                haveCaution =
                    isJsonObject(contentCaution) && !jsonIsEmpty(contentCaution);
            let caution = {},
                semiCaution = {};
            if (haveCaution) {
                contentCaution?.caution.forEach((genre) => {
                    caution[genre.trim().toLowerCase()] = true;
                });
                contentCaution?.semiCaution.forEach((genre) => {
                    semiCaution[genre.trim().toLowerCase()] = true;
                });
            }
            let _favouriteGenres = [],
                genreCaution = [],
                genreSemiCaution = [],
                otherGenres = [];
            let genresRunnned = {};
            genres.forEach((genre) => {
                let trimmedGenre = genre?.trim?.().toLowerCase?.();
                if (haveCaution) {
                    if (caution[trimmedGenre]) {
                        genresRunnned[genre] = true;
                        genreCaution.push({ genre: genre, genreColor: "red" });
                    } else if (semiCaution[trimmedGenre]) {
                        genresRunnned[genre] = true;
                        genreSemiCaution.push({ genre: genre, genreColor: "teal" });
                    }
                }
                if (haveFavorite && !genresRunnned[genre]) {
                    if (favouriteGenres[trimmedGenre]) {
                        genresRunnned[genre] = true;
                        _favouriteGenres.push({
                            genre: genre,
                            score: favouriteGenres[trimmedGenre],
                        });
                    }
                }
                if (!genresRunnned[genre]) {
                    otherGenres.push({ genre: genre, genreColor: null });
                }
            });
            _favouriteGenres.sort((a, b) => {
                return b.score - a.score;
            });
            _favouriteGenres = _favouriteGenres.map((e) => {
                return {
                    genre: `${e.genre} (${formatNumber(e.score)})`,
                    genreColor: "green",
                };
            });

            anime.genres = _favouriteGenres.concat(genreCaution).concat(genreSemiCaution).concat(otherGenres);
        } else {
            anime.genres = []
        }

        // Edit Tags
        let tags = anime?.tags
        if (tags?.length) {
            let favouriteTags = anime?.favoriteContents?.tags;
            let contentCaution = anime?.contentCaution
            let haveFavorite =
                isJsonObject(favouriteTags) && !jsonIsEmpty(favouriteTags),
                haveCaution =
                    isJsonObject(contentCaution) && !jsonIsEmpty(contentCaution);
            let caution = {},
                semiCaution = {};
            if (haveCaution) {
                contentCaution?.caution.forEach((tag) => {
                    caution[tag.trim().toLowerCase()] = true;
                });
                contentCaution?.semiCaution.forEach((tag) => {
                    semiCaution[tag.trim().toLowerCase()] = true;
                });
            }
            let _favouriteTags = [],
                tagCaution = [],
                tagSemiCaution = [],
                otherTags = [];
            let tagsRunnned = {};
            tags.sort((a, b) => {
                return b?.rank - a?.rank;
            });
            tags.forEach((tag) => {
                let tagName = tag?.name || tag;
                let tagRank = tag?.rank;
                if (!tagName) return;
                let trimmedTag = tagName?.trim?.().toLowerCase?.();
                if (haveCaution) {
                    if (caution[trimmedTag]) {
                        tagsRunnned[tagName] = true;
                        tagCaution.push({
                            tag: `<span>${tagName}${tagRank ? "</span><span> " + tagRank + "%" : ""
                                }</span>`,
                            tagColor: "red",
                            copyValue: `${tagName}${tagRank ? " " + tagRank + "%" : ""}`
                        });
                    } else if (semiCaution[trimmedTag]) {
                        tagsRunnned[tagName] = true;
                        tagSemiCaution.push({
                            tag: `<span>${tagName}${tagRank ? "</span><span> " + tagRank + "%" : ""
                                }</span>`,
                            tagColor: "teal",
                            copyValue: `${tagName}${tagRank ? " " + tagRank + "%" : ""}`
                        });
                    }
                }
                if (haveFavorite && !tagsRunnned[tagName]) {
                    if (favouriteTags[trimmedTag]) {
                        tagsRunnned[tagName] = true;
                        _favouriteTags.push({
                            tag: tag,
                            score: favouriteTags[trimmedTag],
                        });
                    }
                }
                if (!tagsRunnned[tagName]) {
                    otherTags.push({
                        tag: `<span>${tagName}${tagRank ? "</span><span> " + tagRank + "%" : ""
                            }</span>`,
                        tagColor: null,
                        copyValue: `${tagName}${tagRank ? " " + tagRank + "%" : ""}`
                    });
                }
            });
            _favouriteTags.sort((a, b) => {
                return b.score - a.score;
            });
            _favouriteTags = _favouriteTags.map((e) => {
                let tagName = e?.tag?.name || e?.tag;
                let tagRank = e?.tag?.rank;
                return {
                    tag: `<span>${tagName} (${formatNumber(e.score)})${tagRank ? "</span><span> " + tagRank + "%" : ""
                        }</span>`,
                    tagColor: "green",
                    copyValue: `${tagName} (${formatNumber(e.score)})${tagRank ? " " + tagRank + "%" : ""}`
                };
            });

            anime.tags = tagCaution.concat(tagSemiCaution).concat(_favouriteTags).concat(otherTags);
        } else {
            anime.tags = []
        }

        // Edit Studio
        let studios = Object.entries(anime.studios || {})
        if (studios?.length) {
            let favouriteStudios = anime?.favoriteContents?.studios
            let haveFavoriteStudio = isJsonObject(favouriteStudios) && !jsonIsEmpty(favouriteStudios);
            let _favouriteStudios = [], otherStudios = [];
            studios.forEach(([studio, studioUrl]) => {
                if (haveFavoriteStudio) {
                    let trimmedStudio = studio?.trim?.().toLowerCase?.();
                    if (favouriteStudios[trimmedStudio]) {
                        _favouriteStudios.push({
                            studio: [studio, studioUrl],
                            score: favouriteStudios[trimmedStudio],
                        });
                    } else {
                        otherStudios.push({
                            studio: {
                                studioName: studio,
                                studioUrl: studioUrl,
                            },
                            studioColor: null,
                        });
                    }
                } else {
                    otherStudios.push({
                        studio: {
                            studioName: studio,
                            studioUrl: studioUrl,
                        },
                        studioColor: null,
                    });
                }
            });
            _favouriteStudios.sort((a, b) => {
                return b.score - a.score;
            });
            _favouriteStudios = _favouriteStudios.map((e) => {
                return {
                    studio: {
                        studioName: `${e.studio[0]} (${formatNumber(e.score)})`,
                        studioUrl: e.studio[1],
                    },
                    studioColor: "green",
                };
            });
            anime.studios = _favouriteStudios.concat(otherStudios)
        } else {
            anime.studios = []
        }

        // Shown Title
        let title = anime?.title
        anime.shownTitle = title?.english || title?.userPreferred || title?.romaji || title?.native || ""
        anime.copiedTitle = title?.romaji || title?.userPreferred || title?.english || title?.native || ""
        // Brief Info
        let score = anime?.score
        let meanScoreAll = anime?.meanScoreAll;
        let meanScoreAbove = anime?.meanScoreAbove
        let sortedFavoriteContents = anime?.sortedFavoriteContents
        let contentCaution = anime?.contentCaution
        let _sortedFavoriteContents = [];
        sortedFavoriteContents?.forEach((e) => {
            if (typeof e === "string") {
                _sortedFavoriteContents.push(e);
            }
        });
        let _contentCaution = [];
        if (score < meanScoreAll) {
            // Very Low Score
            _contentCaution.push(
                `Very Low Score (mean: ${formatNumber(meanScoreAll)})`
            );
        } else if (score < meanScoreAbove) {
            // Low Score
            _contentCaution.push(
                `Low Score (mean: ${formatNumber(meanScoreAbove)})`
            );
        }
        _contentCaution = _contentCaution
            .concat(contentCaution?.caution || [])
            .concat(contentCaution?.semiCaution || []);
        let briefInfo = "";
        if (_sortedFavoriteContents.length) {
            briefInfo +=
                "Favorite Contents: " + _sortedFavoriteContents.join(", ") ||
                "";
        }
        if (_contentCaution.length) {
            briefInfo += "\n\nContent Cautions: " + _contentCaution.join(", ");
        }
        anime.briefInfo = briefInfo;

        // User Status Color
        let userStatus = anime?.userStatus
        let userStatusColor;
        if (ncsCompare(userStatus, "completed")) {
            userStatusColor = "green";
        } else if (
            ncsCompare(userStatus, "current") ||
            ncsCompare(userStatus, "repeating")
        ) {
            userStatusColor = "blue";
        } else if (ncsCompare(userStatus, "planning")) {
            userStatusColor = "orange";
        } else if (ncsCompare(userStatus, "paused")) {
            userStatusColor = "peach";
        } else if (ncsCompare(userStatus, "dropped")) {
            userStatusColor = "red";
        } else {
            userStatusColor = "lightgrey"; // Default Unwatched Icon Color
        }
        anime.userStatusColor = userStatusColor

        // Caution Color
        let contentCautionColor;
        if (contentCaution?.caution?.length) {
            // Caution
            contentCautionColor = "red";
        } else if (contentCaution?.semiCaution?.length) {
            // Semi Caution
            contentCautionColor = "teal";
        } else if (score < meanScoreAll) {
            // Very Low Score
            contentCautionColor = "purple";
        } else if (score < meanScoreAbove) {
            // Low Score
            contentCautionColor = "orange";
        } else {
            contentCautionColor = "green";
        }
        anime.contentCautionColor = contentCautionColor;

        // Get Shown Score
        let shownScore;
        if (sortName === "score") {
            shownScore = formatNumber(score);
        } else if (sortName === "user score") {
            shownScore = anime?.userScore;
        } else if (sortName === "average score") {
            shownScore = anime?.averageScore;
        } else {
            shownScore = formatNumber(anime?.weightedScore);
        }
        anime.shownScore = shownScore

        //
        let recommendedRatingInfo;
        if (score < meanScoreAll) {
            // Very Low Score
            recommendedRatingInfo = `<i class="purple-color fa-solid fa-k"/>`;
        } else if (score < meanScoreAbove) {
            // Low Score
            recommendedRatingInfo = `<i class="purple-color fa-solid fa-k"/>`;
        } else {
            recommendedRatingInfo = `<i class="green-color fa-solid fa-k"/>`;
        }
        anime.recommendedRatingInfo = recommendedRatingInfo

        // Formatted Numbers
        let duration = anime?.duration
        if (duration > 0) {
            let time = msToTime(duration * 60 * 1000);
            anime.formattedDuration = ` · ${time ? time : ""}`;
        }
        anime.formattedWeightedScore = formatNumber(anime?.weightedScore)
        anime.formattedAverageScore = formatNumber(anime?.averageScore * 0.1, 1)
        anime.formattedPopularity = formatNumber(anime?.popularity, 1)
        return anime;
    })
}
// Functions
const formatNumber = (number, dec = 2) => {
    if (typeof number === "number") {
        const formatter = new Intl.NumberFormat("en-US", {
            maximumFractionDigits: dec, // display up to 2 decimal places
            minimumFractionDigits: 0, // display at least 0 decimal places
            notation: "compact", // use compact notation for large numbers
            compactDisplay: "short", // use short notation for large numbers (K, M, etc.)
        });
        if (Math.abs(number) >= 1000) {
            return formatter.format(number);
        } else if (Math.abs(number) < 0.01) {
            return number.toExponential(0);
        } else {
            return (
                number.toFixed(dec) ||
                number.toLocaleString("en-US", { maximumFractionDigits: dec })
            );
        }
    } else {
        return null;
    }
}
function msToTime(duration, limit) {
    try {
        let seconds = Math.floor((duration / 1000) % 60),
            minutes = Math.floor((duration / (1000 * 60)) % 60),
            hours = Math.floor((duration / (1000 * 60 * 60)) % 24),
            days = Math.floor((duration / (1000 * 60 * 60 * 24)) % 7),
            weeks = Math.floor((duration / (1000 * 60 * 60 * 24 * 7)) % 4),
            months = Math.floor((duration / (1000 * 60 * 60 * 24 * 7 * 4)) % 12),
            years = Math.floor((duration / (1000 * 60 * 60 * 24 * 7 * 4 * 12)) % 10),
            decades = Math.floor((duration / (1000 * 60 * 60 * 24 * 7 * 4 * 12 * 10)) % 10),
            century = Math.floor((duration / (1000 * 60 * 60 * 24 * 7 * 4 * 12 * 10 * 10)) % 10),
            millenium = Math.floor((duration / (1000 * 60 * 60 * 24 * 7 * 4 * 12 * 10 * 10 * 10)) % 10);
        let time = []
        if (millenium <= 0 && century <= 0 && decades <= 0 && years <= 0 && months <= 0 && weeks <= 0 && days <= 0 && hours <= 0 && minutes <= 0 && seconds <= 0) return "0s"
        if (millenium > 0) time.push(`${millenium}mil`)
        if (decades > 0) time.push(`${decades}dec`)
        if (years > 0) time.push(`${years}y`)
        if (months > 0) time.push(`${months}mon`)
        if (weeks > 0) time.push(`${weeks}w`)
        if (days > 0) time.push(`${days}d`)
        if (hours > 0) time.push(`${hours}h`)
        if (minutes > 0) time.push(`${minutes}m`)
        if (seconds > 0) time.push(`${seconds}s`)
        if (limit > 0) {
            time = time.slice(0, limit)
        }
        return time.join(" ")
    } catch (e) {
        return
    }
}
const ncsCompare = (str1, str2) => {
    if (typeof str1 !== "string" || typeof str2 !== "string") {
        return false;
    }
    return str1.toLowerCase() === str2.toLowerCase();
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
function jsonIsEmpty(obj) {
    for (const key in obj) {
        return false;
    }
    return true;
}
const isJsonObject = (obj) => {
    return Object.prototype.toString.call(obj) === "[object Object]"
}