let db,
    finalAnimeList,
    filteredList,
    shownIds = {},
    isHiddenList,
    loadLimit = 1;
// Init Content Caution
let semiCautionContents = {
    genres: {},
    tags: {},
},
    cautionContents = {
        genres: {},
        tags: {},
    };
let sortName, customSortName;
// K Icon
const createKSVG = (classes = "") => `<svg class="general-rating-icon ${classes}" viewBox="0 0 320 512"><path d="M311 86a32 32 0 1 0-46-44L110 202l-46 47V64a32 32 0 1 0-64 0v384a32 32 0 1 0 64 0V341l65-67 133 192c10 15 30 18 44 8s18-30 8-44L174 227 311 86z"/></svg>`
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
        let keyword = data?.reloadedFilterKeyword
        if (!keyword) {
            filteredList = finalAnimeList.slice()
        } else {
            filteredList = finalAnimeList.slice().filter(({ title }) => {
                if (isJsonObject(title)) {
                    let titles = Object.values(title)
                    return titles.some((_title) => _title?.toLowerCase?.().includes(keyword?.trim()?.toLowerCase?.()))
                } else {
                    return title?.toLowerCase?.().includes(keyword?.trim()?.toLowerCase?.())
                }
            })
        }
        self.postMessage({
            reload: data?.reload,
            finalAnimeList: editAnimeToLoad(filteredList.slice(0, loadLimit)),
        });
        filteredList = filteredList.slice(loadLimit)
    } else if (data?.filterKeyword !== undefined) {
        let keyword = data?.filterKeyword
        if (!keyword) {
            filteredList = finalAnimeList.slice()
        } else {
            filteredList = finalAnimeList.slice().filter(({ title }) => {
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
            finalAnimeList: editAnimeToLoad(filteredList.slice(0, loadLimit)),
        });
        filteredList = filteredList.slice(loadLimit)
    } else if (data?.removeID !== undefined && isJsonObject(data?.hiddenEntries)) {
        finalAnimeList = finalAnimeList.filter(({ id }) => id !== data.removeID)
        filteredList = filteredList.filter(({ id }) => id !== data.removeID)
        await saveJSON(true, "shouldLoadAnime");
        self.postMessage({
            isRemoved: true,
            removedID: data.removeID,
        });
        await saveJSON({
            sortName: customSortName || sortName,
            semiCautionContents: semiCautionContents,
            cautionContents: cautionContents
        }, "savedFinalAnimeFilters")
        await saveJSON(finalAnimeList, "finalAnimeList")
        await saveJSON(data.hiddenEntries, "hiddenEntries");
        await saveJSON(false, "shouldLoadAnime");
    } else if (data?.loadMore !== undefined) {
        self.postMessage({
            isNew: false,
            isLast: filteredList.length <= loadLimit,
            finalAnimeList: editAnimeToLoad(filteredList.slice(0, loadLimit)),
        });
        filteredList = filteredList.slice(loadLimit)
    } else if (data?.loadInit !== undefined) {
        finalAnimeList = await retrieveJSON("finalAnimeList") || []
        let keyword = data?.reloadedFilterKeyword
        if (!keyword) {
            filteredList = finalAnimeList.slice()
        } else {
            filteredList = finalAnimeList.slice().filter(({ title }) => {
                if (isJsonObject(title)) {
                    let titles = Object.values(title)
                    return titles.some((_title) => _title?.toLowerCase?.().includes(keyword?.trim()?.toLowerCase?.()))
                } else {
                    return title?.toLowerCase?.().includes(keyword?.trim()?.toLowerCase?.())
                }
            })
        }
        let savedFinalAnimeFilters = await retrieveJSON("savedFinalAnimeFilters") || {}
        semiCautionContents = savedFinalAnimeFilters?.semiCautionContents || semiCautionContents
        cautionContents = savedFinalAnimeFilters?.cautionContents || cautionContents
        sortName = customSortName = savedFinalAnimeFilters?.sortName || customSortName || sortName
        shownIds = {}
        self.postMessage({
            isNew: true,
            finalAnimeList: editAnimeToLoad(filteredList.slice(0, loadLimit)),
            hasPassedFilters: false
        });
        filteredList = filteredList.slice(loadLimit)
    } else {
        finalAnimeList = filteredList = []
        shownIds = {}

        self.postMessage({ status: "Initializing Filters" })

        let savedSelectedCustomFilter = await retrieveJSON("selectedCustomFilter") || "Custom Filter"
        let changedCustomFilter = data?.selectedCustomFilter && savedSelectedCustomFilter !== data?.selectedCustomFilter
        let selectedCustomFilter = data?.selectedCustomFilter || savedSelectedCustomFilter

        let activeTagFilters = data?.activeTagFilters || await retrieveJSON("activeTagFilters")

        activeTagFilters?.[selectedCustomFilter]?.['Content Caution']?.forEach(({ selected, filterType, optionName, optionType }) => {
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
                popularity: null,
                year: null,
            },
            shownAnime = {
                include: {},
                exclude: {}
            }
        let hiddenList = false,
            hideMyAnime = false,
            hideWatched = false,
            showMyAnime = false,
            showAiring = false,
            showAllSequels = false,
            showUserUnwatchedSequel = false;

        activeTagFilters?.[selectedCustomFilter]?.['Anime Filter']?.forEach(({ selected, filterType, optionName, optionType, optionValue, CMPoperator, CMPNumber }) => {
            if (selected === "included") {
                if (filterType === 'dropdown') {
                    if (optionType === 'shown score') {
                        customSortName = optionName.toLowerCase()
                    } else if (optionType === 'flexible inclusion') {
                        flexibleInclusion[optionName.replace('OR: ', '').toLowerCase()] = true
                    } else if (optionType === 'shown anime') {
                        shownAnime.include[optionName.toLowerCase()] = true
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
                    } else if (optionName.toLowerCase() === 'show next sequel') {
                        showUserUnwatchedSequel = true
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
                    } else if (optionName.toLowerCase() === "year") {
                        comparisonFilter.year = {
                            operator: CMPoperator,
                            value: parseFloat(CMPNumber ?? optionValue)
                        }
                    }
                }
            } else if (selected === 'excluded') {
                if (filterType === 'dropdown') {
                    if (optionType === 'shown anime') {
                        shownAnime.exclude[optionName.toLowerCase()] = true
                    } else if (optionType === 'genre') {
                        exclude.genres[optionName.toLowerCase()] = true
                    } else if (optionType === 'tag') {
                        exclude.tags[optionName.toLowerCase()] = true
                    } else if (optionType === 'year') {
                        exclude.year[optionName] = true
                    } else if (optionType === 'season') {
                        exclude.season[optionName.toLowerCase()] = true
                    } else if (optionType === 'format') {
                        exclude.format[optionName.toLowerCase()] = true
                    } else if (optionType === 'airing status') {
                        exclude.status[optionName.toLowerCase()] = true
                    } else if (optionType === 'user status') {
                        exclude.userStatus[optionName.toLowerCase()] = true
                    } else if (optionType === 'studio') {
                        exclude.studios[optionName.toLowerCase()] = true
                    }
                }
            }
        })

        let filterOptions = data?.filterOptions || await retrieveJSON("filterOptions") || []
        if (filterOptions && (!isJsonObject(filterOptions?.sortFilter) || !(filterOptions?.sortFilter?.[selectedCustomFilter] instanceof Array))) {
            if (!isJsonObject(filterOptions?.sortFilter)) {
                filterOptions.sortFilter = {}
            }
            filterOptions.sortFilter[selectedCustomFilter] = [
                {
                    "sortName": "weighted score",
                    "sortType": "desc"
                },
                {
                    "sortName": "date",
                    "sortType": "none"
                },
                {
                    "sortName": "user score",
                    "sortType": "none"
                },
                {
                    "sortName": "average score",
                    "sortType": "none"
                },
                {
                    "sortName": "score",
                    "sortType": "none"
                },
                {
                    "sortName": "popularity",
                    "sortType": "none"
                },
                {
                    "sortName": "trending",
                    "sortType": "none"
                },
                {
                    "sortName": "favorites",
                    "sortType": "none"
                },
                {
                    "sortName": "date added",
                    "sortType": "none"
                },
            ]
        }

        let sortFilter = filterOptions.sortFilter?.[selectedCustomFilter]?.filter(({ sortType }) => sortType === "desc" || sortType === "asc")?.[0]
        let sortType = sortFilter?.sortType || 'desc'
        sortName = sortFilter?.sortName || 'weighted score'
        sortFilter = null

        self.postMessage({ status: "Filtering Recommendation List" })

        // Get Hidden Entries
        let hiddenEntries
        if (isJsonObject(data?.hiddenEntries)) {
            hiddenEntries = data?.hiddenEntries
            await saveJSON(true, "shouldLoadAnime");
            await saveJSON(hiddenEntries, "hiddenEntries")
        } else {
            hiddenEntries = (await retrieveJSON("hiddenEntries")) || {}
        }

        // Filter and ADD Caution State below
        let recommendedAnimeList = await retrieveJSON("recommendedAnimeList") || []
        finalAnimeList = recommendedAnimeList.filter((anime, idx) => {
            self.postMessage({ progress: Math.min(((idx + 1) / recommendedAnimeList.length) * 100, 95) })

            if (typeof anime?.nextAiringEpisode?.episode === "number"
                && !isNaN(anime?.nextAiringEpisode?.episode)
                && anime?.nextAiringEpisode?.episode === anime.episodes
                && typeof anime?.nextAiringEpisode?.airingAt === "number"
                && !isNaN(anime?.nextAiringEpisode?.airingAt)
                && new Date(anime?.nextAiringEpisode?.airingAt * 1000) <= new Date()
            ) {
                anime.nextAiringEpisode = null
                anime.status = "FINISHED"
            }

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

            if (!jsonIsEmpty(shownAnime.exclude)) {
                if (typeof anime.score !== "number") {
                    return false
                }
                if (shownAnime.exclude['recommended']) {
                    if (typeof anime.meanScoreAbove !== "number") return false
                    if (anime.score >= anime.meanScoreAbove) return false
                }
                if (shownAnime.exclude['semi-recommended']) {
                    if (
                        typeof anime.meanScoreAll !== "number"
                        || typeof anime.meanScoreAbove !== "number"
                    ) return false
                    if (
                        anime.score < anime.meanScoreAbove
                        && anime.score >= anime.meanScoreAll
                    ) return false
                }
                if (shownAnime.exclude['other']) {
                    if (typeof anime.meanScoreAll !== "number") return false
                    if (anime.score < anime.meanScoreAll) return false
                }
            }

            if (!jsonIsEmpty(shownAnime.include)) {
                if (typeof anime.score !== "number") {
                    return false
                }
                if (
                    !(shownAnime.include['recommended']
                        && shownAnime.include['semi-recommended']
                        && shownAnime.include['other'])
                ) {
                    if (
                        shownAnime.include['recommended']
                        && shownAnime.include['semi-recommended']
                    ) {
                        if (typeof anime.meanScoreAll !== "number") return false
                        if (anime.score < anime.meanScoreAll) return false
                    } else if (
                        shownAnime.include['recommended']
                        && shownAnime.include['other']
                    ) {
                        if (
                            typeof anime.meanScoreAll !== "number"
                            || typeof anime.meanScoreAbove !== "number"
                        ) return false
                        if (
                            anime.score < anime.meanScoreAbove
                            && anime.score >= anime.meanScoreAll
                        ) return false
                    } else if (
                        shownAnime.include['semi-recommended']
                        && shownAnime.include['other']
                    ) {
                        if (typeof anime.meanScoreAbove !== "number") return false
                        if (anime.score >= anime.meanScoreAbove) return false
                    } else if (shownAnime.include['recommended']) {
                        if (typeof anime.meanScoreAbove !== "number") return false
                        if (anime.score < anime.meanScoreAbove) return false
                    } else if (shownAnime.include['semi-recommended']) {
                        if (
                            typeof anime.meanScoreAll !== "number"
                            || typeof anime.meanScoreAbove !== "number"
                        ) return false
                        if (
                            anime.score >= anime.meanScoreAbove
                            || anime.score < anime.meanScoreAll
                        ) return false
                    } else if (shownAnime.include['other']) {
                        if (typeof anime.meanScoreAll !== "number") return false
                        if (anime.score >= anime.meanScoreAll) return false
                    }
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

            if (comparisonFilter.year) {
                if (anime.year == null) return false
                let year = parseInt(anime.year)
                let operator = comparisonFilter.year.operator?.trim?.(),
                    value = comparisonFilter.year.value
                if (typeof year !== "number") {
                    return false
                } else if (typeof operator === "string" && typeof value === "number") {
                    switch (operator) {
                        case ">=": {
                            if (year < value) return false
                            break
                        }
                        case "<=": {
                            if (year > value) return false
                            break
                        }
                        case "<": {
                            if (year >= value) return false
                            break
                        }
                        case ">": {
                            if (year <= value) return false
                            break
                        }
                    }
                } else if (typeof value === "number") {
                    if (year !== value) return false
                }
            }

            // Should Exclude
            if (exclude.season["current season"]) {
                let year = anime?.year;
                if (!isNaN(parseInt(year))) {
                    let season = anime?.season?.toLowerCase?.();
                    let currentSeasonYear = getCurrentSeasonYear() || {}
                    if (typeof season === 'string') {
                        // is Current Season
                        if (season === currentSeasonYear?.season && parseInt(year) === currentSeasonYear?.year) {
                            return false
                        }
                    }
                    if (typeof anime?.status === 'string') {
                        let { month, day } = anime?.startDate || {}
                        if (parseInt(month) > 0) { month = parseInt(month) - 1 }
                        let startDate = getJapaneseStartDate({ season, year, month, day })
                        // is an Ongoing Anime in Previous Season
                        if (["releasing", "not yet released"].some((status) => status === anime.status.toLowerCase())
                            && startDate < currentSeasonYear.date
                        ) {
                            return false
                        }
                    }
                }
            }

            if (exclude.season["upcoming season"]) {
                let year = anime?.year;
                // invalid Start Date
                if (!isNaN(parseInt(year))) {
                    let season = anime?.season?.toLowerCase?.();
                    let { month, day } = anime?.startDate || {}
                    if (parseInt(month) > 0) { month = parseInt(month) - 1 }
                    let startDate = getJapaneseStartDate({ season, year, month, day })
                    let { nextSeasonDate } = getCurrentSeasonYear() || {}
                    if (startDate >= nextSeasonDate) {
                        return false
                    }
                }
            }

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
                if (include.season["current season"] && include.season["upcoming season"]) {
                    let year = anime?.year;
                    // Still include if Invalid Start Date for Upcoming
                    if (!isNaN(parseInt(year))) {
                        let currentSeasonYear = getCurrentSeasonYear() || {}
                        // Anime is Not in Current Season
                        let season = anime?.season?.toLowerCase?.()
                        if (typeof season !== "string" || season !== currentSeasonYear?.season || parseInt(year) !== currentSeasonYear?.year) {
                            // Get Season Dates
                            let { month, day } = anime?.startDate || {}
                            if (parseInt(month) > 0) { month = parseInt(month) - 1 }
                            let startDate = getJapaneseStartDate({ season, year, month, day })
                            // is Not an Upcoming Anime
                            if (startDate < currentSeasonYear.nextSeasonDate) {
                                // is Not an Ongoing Anime in Previous Season
                                if (typeof anime?.status !== "string" || startDate >= currentSeasonYear.date || ["releasing", "not yet released"].every((status) => status !== anime.status.toLowerCase())) {
                                    return false
                                }
                            }
                        }
                    }
                } else if (include.season["current season"]) {
                    let year = anime?.year;
                    // is Invalid Start Date
                    if (isNaN(parseInt(year))) return false
                    let currentSeasonYear = getCurrentSeasonYear() || {}
                    // is Not Current Season
                    let season = anime?.season?.toLowerCase?.()
                    if (typeof season !== "string" || season !== currentSeasonYear?.season || parseInt(year) !== currentSeasonYear?.year) {
                        // invalid Anime Status
                        if (typeof anime?.status !== "string") return false
                        // Get Season Dates
                        let { month, day } = anime?.startDate || {}
                        if (parseInt(month) > 0) { month = parseInt(month) - 1 }
                        let startDate = getJapaneseStartDate({ season, year, month, day })
                        // is Not an Ongoing Anime in Previous Season
                        if (startDate >= currentSeasonYear.nextSeasonDate || ["releasing", "not yet released"].every((status) => status !== anime.status.toLowerCase())) {
                            return false
                        }
                    }
                } else if (include.season["upcoming season"]) {
                    let year = anime?.year;
                    // Still include if Invalid Start Date for Upcoming
                    if (!isNaN(parseInt(year))) {
                        // Get Next Season Date
                        let season = anime?.season?.toLowerCase?.();
                        let { month, day } = anime?.startDate || {}
                        if (parseInt(month) > 0) { month = parseInt(month) - 1 }
                        let startDate = getJapaneseStartDate({ season, year, month, day })
                        let { nextSeasonDate } = getCurrentSeasonYear() || {}
                        if (startDate < nextSeasonDate) {
                            return false
                        }
                    }
                }
                let nonSeasonCount = (include.season["current season"] ? 1 : 0) + (include.season["upcoming season"] ? 1 : 0)
                if (Object.keys(include.season).length > nonSeasonCount) {
                    if (!include.season[anime?.season?.toLowerCase?.()]) {
                        return false
                    }
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

            let inclusions = {}
            // Should Include Genre / Tag / Studio
            if (flexibleInclusion['genre / tag / studio']) {
                inclusions.genre = inclusions.tag = inclusions.studio = true
                let isIncluded = jsonIsEmpty(include.genres) && jsonIsEmpty(include.tags) && jsonIsEmpty(include.studios)
                // Should Include OR Genre / Tag / Studio
                if (!isIncluded && !jsonIsEmpty(include.genres)) {
                    isIncluded = anime.genres.some(genre => include.genres[genre.toLowerCase()])
                }
                if (!isIncluded && !jsonIsEmpty(include.tags)) {
                    isIncluded = anime.tags.some(tag => {
                        let tagName = tag?.name || tag
                        return include.tags[tagName.toLowerCase()]
                    })
                }
                if (!isIncluded && !jsonIsEmpty(include.studios)) {
                    for (let studio in anime.studios) {
                        if (include.studios[studio.toLowerCase()]) {
                            isIncluded = true
                            break
                        }
                    }
                }
                if (!isIncluded) return false
            } else if (flexibleInclusion['genre / tag']) {
                inclusions.genre = inclusions.tag = true
                let isIncluded = jsonIsEmpty(include.genres) && jsonIsEmpty(include.tags)
                // Should Include OR Genre / Tag / Studio
                if (!isIncluded && !jsonIsEmpty(include.genres)) {
                    isIncluded = anime.genres.some(genre => include.genres[genre.toLowerCase()])
                }
                if (!isIncluded && !jsonIsEmpty(include.tags)) {
                    isIncluded = anime.tags.some(tag => {
                        let tagName = tag?.name || tag
                        return include.tags[tagName.toLowerCase()]
                    })
                }
                if (!isIncluded) return false
            } else if (flexibleInclusion['genre / studio']) {
                inclusions.genre = inclusions.studio = true
                let isIncluded = jsonIsEmpty(include.genres) && jsonIsEmpty(include.studios)
                // Should Include OR Genre / Tag / Studio
                if (!isIncluded && !jsonIsEmpty(include.genres)) {
                    isIncluded = anime.genres.some(genre => include.genres[genre.toLowerCase()])
                }
                if (!isIncluded && !jsonIsEmpty(include.studios)) {
                    for (let studio in anime.studios) {
                        if (include.studios[studio.toLowerCase()]) {
                            isIncluded = true
                            break
                        }
                    }
                }
                if (!isIncluded) return false
            } else if (flexibleInclusion['tag / studio']) {
                inclusions.tag = inclusions.studio = true
                let isIncluded = jsonIsEmpty(include.tags) && jsonIsEmpty(include.studios)
                // Should Include OR Genre / Tag / Studio
                if (!isIncluded && !jsonIsEmpty(include.tags)) {
                    isIncluded = anime.tags.some(tag => {
                        let tagName = tag?.name || tag
                        return include.tags[tagName.toLowerCase()]
                    })
                }
                if (!isIncluded && !jsonIsEmpty(include.studios)) {
                    for (let studio in anime.studios) {
                        if (include.studios[studio.toLowerCase()]) {
                            isIncluded = true
                            break
                        }
                    }
                }
                if (!isIncluded) return false
            }

            // Should Include
            if (!inclusions.genre) {
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
            }

            if (!inclusions.tag) {
                if (flexibleInclusion['tag']) {
                    // Should Include OR
                    if (!jsonIsEmpty(include.tags)) {
                        if (!anime.tags.some(tag => {
                            let tagName = tag?.name || tag
                            return include.tags[tagName.toLowerCase()]
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
            }

            if (!inclusions.studio) {
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
            }

            let animeRelations = anime?.animeRelations
            if (
                showUserUnwatchedSequel
                && animeRelations instanceof Array
            ) {
                let userStatus = anime?.userStatus?.trim?.()?.toLowerCase?.()
                // Is Unwatched and Prequel is in User List
                let isNotUserAnimeUnwatchedSequel =
                    // If anime is watched
                    ["completed", "repeating", "dropped"].some(e => e === userStatus)
                    // if prequel is not watched
                    || !animeRelations.some((e) => {
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
                            return ["completed", "repeating"].some(e => e === relationStatus)
                        }
                    });
                // if anime is in franchise and unwatched
                if (isNotUserAnimeUnwatchedSequel) {
                    return false
                }
            }
            if (
                !showAllSequels
                && animeRelations instanceof Array
            ) {
                // Show All Sequels or Hide Next Sequels that have dropped or unwatched prequel
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
                // If only show next sequel, Then Don't Include if Sequel 
                if (!isUnwatchedSequel) {
                    return false;
                }
            }
            // Add the recommended Anime
            return true;
        });
        // Sort List
        if (sortType === "desc") {
            if (sortName === "weighted score") {
                finalAnimeList.sort((a, b) => {
                    let x = a?.weightedScore != null ? a.weightedScore : -Infinity,
                        y = b?.weightedScore != null ? b.weightedScore : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by user score (descending), place falsy values at last
                    x = a?.userScore != null ? a.userScore : -Infinity;
                    y = b?.userScore != null ? b.userScore : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by score (descending), place falsy values at last
                    x = a?.score != null ? a.score : -Infinity;
                    y = b?.score != null ? b.score : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by trending (descending), place falsy values at last
                    x = a?.trending != null ? a.trending : -Infinity;
                    y = b?.trending != null ? b.trending : -Infinity;
                    return y - x
                })
            } else if (sortName === "score") {
                finalAnimeList.sort((a, b) => {
                    let x = a?.score != null ? a.score : -Infinity,
                        y = b?.score != null ? b.score : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by user score (descending), place falsy values at last
                    x = a?.userScore != null ? a.userScore : -Infinity;
                    y = b?.userScore != null ? b.userScore : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by trending (descending), place falsy values at last
                    x = a?.trending != null ? a.trending : -Infinity;
                    y = b?.trending != null ? b.trending : -Infinity;
                    return y - x
                })
            } else if (sortName === "average score") {
                finalAnimeList.sort((a, b) => {
                    let x = a?.averageScore != null ? a.averageScore : -Infinity,
                        y = b?.averageScore != null ? b.averageScore : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by user score (descending), place falsy values at last
                    x = a?.userScore != null ? a.userScore : -Infinity;
                    y = b?.userScore != null ? b.userScore : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by score (descending), place falsy values at last
                    x = a?.score != null ? a.score : -Infinity;
                    y = b?.score != null ? b.score : -Infinity;
                    return y - x
                })
            } else if (sortName === "user score") {
                finalAnimeList.sort((a, b) => {
                    let x = a?.userScore != null ? a.userScore : -Infinity,
                        y = b?.userScore != null ? b.userScore : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by score (descending), place falsy values at last
                    x = a?.score != null ? a.score : -Infinity;
                    y = b?.score != null ? b.score : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by average score (descending), place falsy values at last
                    x = a?.averageScore != null ? a.averageScore : -Infinity;
                    y = b?.averageScore != null ? b.averageScore : -Infinity;
                    return y - x
                })
            } else if (sortName === "popularity") {
                finalAnimeList.sort((a, b) => {
                    let x = a?.popularity != null ? a.popularity : -Infinity,
                        y = b?.popularity != null ? b.popularity : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by user score (descending), place falsy values at last
                    x = a?.userScore != null ? a.userScore : -Infinity;
                    y = b?.userScore != null ? b.userScore : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by favorites (descending), place falsy values at last
                    x = a?.favorites != null ? a.favorites : -Infinity;
                    y = b?.favorites != null ? b.favorites : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by trend (descending), place falsy values at last
                    x = a?.trending != null ? a.trending : -Infinity;
                    y = b?.trending != null ? b.trending : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by score (descending), place falsy values at last
                    x = a?.score != null ? a.score : -Infinity;
                    y = b?.score != null ? b.score : -Infinity;
                    return y - x
                })
            } else if (sortName === "trending") {
                finalAnimeList.sort((a, b) => {
                    let x = a?.trending != null ? a.trending : -Infinity,
                        y = b?.trending != null ? b.trending : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by user score (descending), place falsy values at last
                    x = a?.userScore != null ? a.userScore : -Infinity;
                    y = b?.userScore != null ? b.userScore : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by popularity (descending), place falsy values at last
                    x = a?.popularity != null ? a.popularity : -Infinity;
                    y = b?.popularity != null ? b.popularity : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by favorites (descending), place falsy values at last
                    x = a?.favorites != null ? a.favorites : -Infinity;
                    y = b?.favorites != null ? b.favorites : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by score (descending), place falsy values at last
                    x = a?.score != null ? a.score : -Infinity;
                    y = b?.score != null ? b.score : -Infinity;
                    return y - x
                })
            } else if (sortName === "favorites") {
                finalAnimeList.sort((a, b) => {
                    let x = a?.favorites != null ? a.favorites : -Infinity,
                        y = b?.favorites != null ? b.favorites : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by user score (descending), place falsy values at last
                    x = a?.userScore != null ? a.userScore : -Infinity;
                    y = b?.userScore != null ? b.userScore : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by average score (descending), place falsy values at last
                    x = a?.averageScore != null ? a.averageScore : -Infinity;
                    y = b?.averageScore != null ? b.averageScore : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by score (descending), place falsy values at last
                    x = a?.score != null ? a.score : -Infinity;
                    y = b?.score != null ? b.score : -Infinity;
                    return y - x
                })
            } else if (sortName === "date added") {
                finalAnimeList.sort((a, b) => {
                    // Get Date A
                    let dateA = a?.dateAdded
                    if (typeof dateA !== "number") {
                        let year = a?.year
                        let season = a?.season?.toLowerCase?.();
                        let startDate = a?.startDate || {}
                        let month = startDate?.month
                        if (parseInt(month) > 0) { month = parseInt(month) - 1 }
                        let day = startDate?.day
                        dateA = getJapaneseStartDate({ season, year, month, day })?.getTime?.()
                    }
                    // Get Date B
                    let dateB = b?.dateAdded
                    if (typeof dateB !== "number") {
                        year = b?.year
                        season = b?.season?.toLowerCase?.();
                        startDate = b?.startDate || {}
                        month = startDate?.month
                        if (parseInt(month) > 0) { month = parseInt(month) - 1 }
                        day = startDate?.day
                        dateB = getJapaneseStartDate({ season, year, month, day })?.getTime?.()
                    }
                    // Sort by date (descending), place falsy values at last
                    let x = dateA != null ? dateA : -Infinity;
                    let y = dateB != null ? dateB : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by user score (descending), place falsy values at last
                    x = a?.userScore != null ? a.userScore : -Infinity;
                    y = b?.userScore != null ? b.userScore : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by trend (descending), place falsy values at last
                    x = a?.trending != null ? a.trending : -Infinity;
                    y = b?.trending != null ? b.trending : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by popularity (descending), place falsy values at last
                    x = a?.popularity != null ? a.popularity : -Infinity;
                    y = b?.popularity != null ? b.popularity : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by score (descending), place falsy values at last
                    x = a?.score != null ? a.score : -Infinity;
                    y = b?.score != null ? b.score : -Infinity;
                    return y - x;
                })
            } else if (sortName === "date") {
                finalAnimeList.sort((a, b) => {
                    // Get Date A
                    let year = a?.year
                    let season = a?.season?.toLowerCase?.();
                    let startDate = a?.startDate || {}
                    let month = startDate?.month
                    if (parseInt(month) > 0) { month = parseInt(month) - 1 }
                    let day = startDate?.day
                    let dateA = getJapaneseStartDate({ season, year, month, day })?.getTime?.()
                    // Get Date B
                    year = b?.year
                    season = b?.season?.toLowerCase?.();
                    startDate = b?.startDate || {}
                    month = startDate?.month
                    if (parseInt(month) > 0) { month = parseInt(month) - 1 }
                    day = startDate?.day
                    let dateB = getJapaneseStartDate({ season, year, month, day })?.getTime?.()
                    // Sort by date (descending), place falsy values at last
                    let x = dateA != null ? dateA : -Infinity;
                    let y = dateB != null ? dateB : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by user score (descending), place falsy values at last
                    x = a?.userScore != null ? a.userScore : -Infinity;
                    y = b?.userScore != null ? b.userScore : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by trend (descending), place falsy values at last
                    x = a?.trending != null ? a.trending : -Infinity;
                    y = b?.trending != null ? b.trending : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by popularity (descending), place falsy values at last
                    x = a?.popularity != null ? a.popularity : -Infinity;
                    y = b?.popularity != null ? b.popularity : -Infinity;
                    if (x !== y) return y - x;
                    // Sort by score (descending), place falsy values at last
                    x = a?.score != null ? a.score : -Infinity;
                    y = b?.score != null ? b.score : -Infinity;
                    return y - x;
                })
            }
        } else if (sortType === "asc") {
            if (sortName === "weighted score") {
                finalAnimeList.sort((a, b) => {
                    let x = a?.weightedScore != null ? a?.weightedScore : Infinity,
                        y = b?.weightedScore != null ? b?.weightedScore : Infinity;
                    return x - y
                })
            } else if (sortName === "score") {
                finalAnimeList.sort((a, b) => {
                    let x = a?.score != null ? a?.score : Infinity,
                        y = b?.score != null ? b?.score : Infinity;
                    return x - y
                })
            } else if (sortName === "average score") {
                finalAnimeList.sort((a, b) => {
                    let x = a?.averageScore != null ? a?.averageScore : Infinity,
                        y = b?.averageScore != null ? b?.averageScore : Infinity;
                    return x - y
                })
            } else if (sortName === "user score") {
                finalAnimeList.sort((a, b) => {
                    let x = a?.userScore != null ? a?.userScore : Infinity,
                        y = b?.userScore != null ? b?.userScore : Infinity;
                    return x - y
                })
            } else if (sortName === "popularity") {
                finalAnimeList.sort((a, b) => {
                    let x = a?.popularity != null ? a?.popularity : Infinity,
                        y = b?.popularity != null ? b?.popularity : Infinity;
                    return x - y
                })
            } else if (sortName === "trending") {
                finalAnimeList.sort((a, b) => {
                    let x = a?.trending != null ? a?.trending : Infinity,
                        y = b?.trending != null ? b?.trending : Infinity;
                    if (x !== y) return x - y;
                    // Sort by popularity (descending), place falsy values at last
                    x = a?.popularity != null ? a.popularity : Infinity;
                    y = b?.popularity != null ? b.popularity : Infinity;
                    return x - y
                })
            } else if (sortName === "favorites") {
                finalAnimeList.sort((a, b) => {
                    let x = a?.favorites != null ? a?.favorites : Infinity,
                        y = b?.favorites != null ? b?.favorites : Infinity;
                    if (x !== y) return x - y;
                    // Sort by popularity (descending), place falsy values at last
                    x = a?.popularity != null ? a.popularity : Infinity;
                    y = b?.popularity != null ? b.popularity : Infinity;
                    return x - y
                })
            } else if (sortName === "date added") {
                finalAnimeList.sort((a, b) => {
                    // Get Date A
                    let dateA = a?.dateAdded
                    if (typeof dateA !== "number") {
                        let year = a?.year
                        let season = a?.season?.toLowerCase?.();
                        let startDate = a?.startDate || {}
                        let month = startDate?.month
                        if (parseInt(month) > 0) { month = parseInt(month) - 1 }
                        let day = startDate?.day
                        dateA = getJapaneseStartDate({ season, year, month, day })?.getTime?.()
                    }
                    // Get Date B
                    let dateB = b?.dateAdded
                    if (typeof dateB !== "number") {
                        year = b?.year
                        season = b?.season?.toLowerCase?.();
                        startDate = b?.startDate || {}
                        month = startDate?.month
                        if (parseInt(month) > 0) { month = parseInt(month) - 1 }
                        day = startDate?.day
                        dateB = getJapaneseStartDate({ season, year, month, day })?.getTime?.()
                    }
                    // Sort by date (ascending), place falsy values at last
                    let x = dateA != null ? dateA : Infinity;
                    let y = dateB != null ? dateB : Infinity;
                    return x - y;
                })
            } else if (sortName === "date") {
                finalAnimeList.sort((a, b) => {
                    // Get Date A
                    let year = a?.year
                    let season = a?.season?.toLowerCase?.();
                    let startDate = a?.startDate || {}
                    let month = startDate?.month
                    if (parseInt(month) > 0) { month = parseInt(month) - 1 }
                    let day = startDate?.day
                    let dateA = getJapaneseStartDate({ season, year, month, day })?.getTime?.()
                    // Get Date B
                    year = b?.year
                    season = b?.season?.toLowerCase?.();
                    startDate = b?.startDate || {}
                    month = startDate?.month
                    if (parseInt(month) > 0) { month = parseInt(month) - 1 }
                    day = startDate?.day
                    let dateB = getJapaneseStartDate({ season, year, month, day })?.getTime?.()
                    // Sort by date (ascending), place falsy values at last
                    let x = dateA != null ? dateA : Infinity;
                    let y = dateB != null ? dateB : Infinity;
                    return x - y;
                })
            }
        }
        sortType = null
        // Fix Filter Options on Change
        let newFilterOptionsIsSaved = false
        if (changedCustomFilter) {
            if (filterOptions.filterSelection instanceof Array && selectedCustomFilter && activeTagFilters[selectedCustomFilter]) {
                filterOptions.filterSelection = filterOptions.filterSelection.map((filterType) => {
                    let filterSelectionName = filterType.filterSelectionName
                    filterType.filters.Checkbox = filterType.filters.Checkbox.map((cbFilter, optionIdx) => {
                        let activeTag = activeTagFilters[selectedCustomFilter][filterSelectionName].find((e) => {
                            return e?.filterType === "checkbox" && e?.optionIdx === optionIdx
                        })
                        cbFilter.isSelected = activeTag?.selected === "included"
                        return cbFilter
                    })
                    filterType.filters.Dropdown = filterType.filters.Dropdown.map((dpFilter, categIdx) => {
                        dpFilter.options = dpFilter.options.map((optFilter, optionIdx) => {
                            let activeTag = activeTagFilters[selectedCustomFilter][filterSelectionName].find((e) => {
                                return e?.filterType === "dropdown" && e?.categIdx === categIdx && e?.optionIdx === optionIdx
                            })
                            optFilter.selected = activeTag?.selected || "none"
                            return optFilter
                        })
                        return dpFilter
                    })
                    filterType.filters["Input Number"] = filterType.filters["Input Number"].map((inFilter, optionIdx) => {
                        let activeTag = activeTagFilters[selectedCustomFilter][filterSelectionName].find((e) => {
                            return e?.filterType === "input number" && e?.optionIdx === optionIdx
                        })
                        inFilter.numberValue = activeTag?.optionValue || ""
                        return inFilter
                    })
                    return filterType
                })
                await saveJSON(filterOptions, "filterOptions")
                await saveJSON(selectedCustomFilter, "selectedCustomFilter")
                self.postMessage({ filterOptions: filterOptions, selectedCustomFilter: selectedCustomFilter })
                newFilterOptionsIsSaved = true
            } else {
                for (let key in activeTagFilters) {
                    if (activeTagFilters?.[key]?.["Anime Filter"]) {
                        self.postMessage({ changedCustomFilter: key })
                        break
                    }
                }
            }
        }
        recommendedAnimeList = null
        await saveJSON(activeTagFilters, 'activeTagFilters')
        if (!newFilterOptionsIsSaved) {
            await saveJSON(filterOptions, "filterOptions")
            await saveJSON(selectedCustomFilter, 'selectedCustomFilter')
        }
        await saveJSON({
            sortName: customSortName || sortName,
            semiCautionContents,
            cautionContents
        }, "savedFinalAnimeFilters")
        await saveJSON(finalAnimeList, "finalAnimeList")
        await saveJSON(false, "shouldLoadAnime");
        //
        let keyword = data?.reloadedFilterKeyword
        if (!keyword) {
            filteredList = finalAnimeList.slice()
        } else {
            filteredList = finalAnimeList.slice().filter(({ title }) => {
                if (isJsonObject(title)) {
                    let titles = Object.values(title)
                    return titles.some((_title) => _title?.toLowerCase?.().includes(keyword?.trim()?.toLowerCase?.()))
                } else {
                    return title?.toLowerCase?.().includes(keyword?.trim()?.toLowerCase?.())
                }
            })
        }
        self.postMessage({ status: null })
        self.postMessage({ progress: 100 })
        isHiddenList = hiddenList
        self.postMessage({
            isNew: true,
            finalAnimeList: editAnimeToLoad(filteredList.slice(0, loadLimit)),
            hiddenEntries: hiddenEntries,
            hasPassedFilters: data?.hasPassedFilters,
        });
        filteredList = filteredList.slice(loadLimit)
    }
};
function editAnimeToLoad(shownList = []) {
    return shownList.map((anime) => {
        if (shownIds[anime.id]) return anime
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
        if (typeof genres?.[0] === "string") {
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
        }

        // Edit Tags
        let tags = anime?.tags
        if (tags?.[0]?.hasOwnProperty?.("name")) {
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
                                tagName: tagName,
                                tag: `<span>${tagName}${tagRank ? "</span><span> " + tagRank + "%" : ""
                                    }</span>`,
                                tagColor: "red",
                                copyValue: `${tagName}${tagRank ? " " + tagRank + "%" : ""}`
                            });
                        } else if (semiCaution[trimmedTag]) {
                            tagsRunnned[tagName] = true;
                            tagSemiCaution.push({
                                tagName: tagName,
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
                            tagName: tagName,
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
                        tagName: tagName,
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
        }

        // Edit Studio
        let studios = Object.entries(anime.studios || {})
        if (studios?.[0] instanceof Array) {
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

        anime.formattedWeightedScore = formatNumber(anime?.weightedScore)
        anime.formattedAverageScore = formatNumber(anime?.averageScore * 0.1, 1)
        anime.formattedPopularity = formatNumber(anime?.popularity, anime?.popularity >= 1000 ? 1 : 0)

        // Get Shown Score
        let currentSortName = customSortName || sortName
        if (currentSortName === "score" || currentSortName === "date" || currentSortName === "date added") {
            anime.shownScore = formatNumber(score) ?? "N/A";
        } else if (currentSortName === "user score") {
            anime.shownScore = anime?.userScore ?? "N/A";
        } else if (currentSortName === "average score") {
            anime.shownScore = anime?.averageScore ?? "N/A";
        } else if (currentSortName === "popularity") {
            anime.shownCount = anime.formattedPopularity ?? "N/A";
        } else if (currentSortName === "trending") {
            anime.shownActivity = formatNumber(anime?.trending, anime?.trending >= 1000 ? 1 : 0) ?? "N/A";
        } else if (currentSortName === "favorites") {
            anime.shownFavorites = formatNumber(anime?.favorites, anime?.favorites >= 1000 ? 1 : 0) ?? "N/A";
        } else {
            anime.shownScore = anime.formattedWeightedScore ?? "N/A"
        }

        let recommendedRatingInfo;
        if (score < meanScoreAll) {
            // Very Low Score
            recommendedRatingInfo = createKSVG("purple-fill");
        } else if (score < meanScoreAbove) {
            // Low Score
            recommendedRatingInfo = createKSVG("orange-fill");
        } else {
            recommendedRatingInfo = createKSVG("green-fill");
        }
        anime.recommendedRatingInfo = recommendedRatingInfo

        // Formatted Numbers
        let duration = anime?.duration
        if (duration > 0) {
            let time = msToTime(duration * 60 * 1000);
            anime.formattedDuration = ` · ${time ? time : ""}`;
        }

        shownIds[anime.id] = true;
        return anime;
    })
}
// Functions
function getCurrentSeasonYear() {
    let currentDate = new Date()
    let year = currentDate.getFullYear()
    let seasons = {
        nextWinter: new Date(parseInt(year + 1), 0, 1),  // January 1
        winter: new Date(parseInt(year), 0, 1),  // January 1
        spring: new Date(parseInt(year), 3, 1),  // April 1
        summer: new Date(parseInt(year), 6, 1),  // July 1
        fall: new Date(parseInt(year), 9, 1),    // October 1
    };
    if (currentDate >= seasons.winter && currentDate < seasons.spring) {
        return { season: "winter", year, date: seasons.winter, nextSeasonDate: seasons.spring }
    } else if (currentDate >= seasons.spring && currentDate < seasons.summer) {
        return { season: "spring", year, date: seasons.spring, nextSeasonDate: seasons.summer }
    } else if (currentDate >= seasons.summer && currentDate < seasons.fall) {
        return { season: "summer", year, date: seasons.summer, nextSeasonDate: seasons.fall }
    } else {
        return { season: "fall", year, date: seasons.fall, nextSeasonDate: seasons.nextWinter }
    }
}
function getJapaneseStartDate({ season, year, month, day }) {
    if (parseInt(year) >= 0) {
        if (parseInt(month) >= 0) {
            return new Date(parseInt(year), parseInt(month), parseInt(day || 1) || 1)
        }
        const seasonKey = season?.trim()?.toLowerCase?.();
        if (["winter", "spring", "summer", "fall"].includes(seasonKey) && !isNaN(year)) {
            let seasons = {
                winter: new Date(parseInt(year), 0, 1),  // January 1
                spring: new Date(parseInt(year), 3, 1),  // April 1
                summer: new Date(parseInt(year), 6, 1),  // July 1
                fall: new Date(parseInt(year), 9, 1),    // October 1
            };
            return seasons[seasonKey];
        }
        return new Date(parseInt(year), 0, 1);
    } else {
        return null;
    }
}
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
        } else if (Math.abs(number) < 0.01 && Math.abs(number) > 0) {
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
function isJsonObject(obj) {
    return Object.prototype.toString.call(obj) === "[object Object]"
}