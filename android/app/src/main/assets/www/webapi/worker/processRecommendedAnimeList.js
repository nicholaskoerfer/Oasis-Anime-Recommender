
let db;
let mediaRelationTypes = ["adaptation", "prequel", "sequel", "parent", "side_story", "summary", "alternative", "spin_off"]
let minNumber = 1 - 6e-17 !== 1 ? 6e-17 : 1e-16;
self.onmessage = async ({ data }) => {
    if (!db) await IDBinit()
    // Retrieve Data
    self.postMessage({ status: "Initializing Filters" })
    let activeTagFilters = await retrieveJSON("activeTagFilters")
    let animeEntries = await retrieveJSON("animeEntries") || {}
    let userEntries = await retrieveJSON("userEntries") || []
    let animeFranchises = await retrieveJSON("animeFranchise") || []

    let includedUserEntryCount;
    // Filter Algorithm
    let includeUnknownVar = false,
        measure = "mean",
        includeYear = true,
        includeAverageScore = false,
        showAllSequels = false,
        minPopularity,
        minAverageScore,
        minSampleSize,
        sampleSize,
        customUserScoreBase,
        genresWithLowerCount = {};
    let include = {
        genres: {}, tags: {}, categories: {}, studios: {}, staffs: {}, roles: {}
    },
        exclude = {
            genres: {}, tags: {}, categories: {}, studios: {}, staffs: {}, roles: {}
        }
    let algorithmFilter = activeTagFilters?.['Algorithm Filter'] || []
    algorithmFilter.forEach(({ selected, filterType, optionName, optionType, optionValue }) => {
        if (selected === "included") {
            if (filterType === 'dropdown') {
                if (optionType === 'genre') {
                    include.genres["genre: " + optionName.toLowerCase()] = true
                } else if (optionType === 'tag') {
                    include.tags["tag: " + optionName.toLowerCase()] = true
                } else if (optionType === 'tag category') {
                    include.tags["tag category: " + optionName.toLowerCase()] = true
                } else if (optionType === 'studio') {
                    include.tags["studio: " + optionName.toLowerCase()] = true
                    // } else if (optionType === 'staff role') {
                    //     include.tags["staff role: " + optionName.toLowerCase()] = true
                } else if (optionType === 'measure') {
                    if (optionName.toLowerCase() === "mode") {
                        measure = "mode"
                    }
                }
            } else if (filterType === 'checkbox') {
                if (optionName.toLowerCase() === 'inc. all factors') {
                    includeUnknownVar = true
                } else if (optionName.toLowerCase() === "inc. average score") {
                    includeAverageScore = true
                } else if (optionName.toLowerCase() === "exclude year") {
                    includeYear = false
                } else if (optionName.toLowerCase() === 'show all sequels') {
                    showAllSequels = true
                }
            } else if (filterType === 'input number') {
                if (optionName.toLowerCase() === 'scoring system') {
                    customUserScoreBase = parseFloat(optionValue)
                } else if (optionName.toLowerCase() === 'sample size') {
                    sampleSize = parseFloat(optionValue)
                } else if (optionName.toLowerCase() === 'min sample size') {
                    minSampleSize = parseFloat(optionValue)
                } else if (optionName.toLowerCase() === 'min popularity') {
                    minPopularity = parseFloat(optionValue)
                } else if (optionName.toLowerCase() === 'min average score') {
                    minAverageScore = parseFloat(optionValue)
                }
            }
        } else if (selected === 'excluded') {
            if (filterType === 'dropdown') {
                if (optionType === 'genre') {
                    exclude.genres["genre: " + optionName.toLowerCase()] = true
                } else if (optionType === 'tag') {
                    exclude.tags["tag: " + optionName.toLowerCase()] = true
                } else if (optionType === 'tag category') {
                    exclude.tags["tag category: " + optionName.toLowerCase()] = true
                } else if (optionType === 'studio') {
                    exclude.tags["studio: " + optionName.toLowerCase()] = true
                    // } else if (optionType === 'staff role') {
                    //     exclude.tags["staff role: " + optionName.toLowerCase()] = true
                }
            } else if (filterType === 'checkbox') {
                if (optionName.toLowerCase() === 'inc. all factors') {
                    includeUnknownVar = false
                } else if (optionName.toLowerCase() === "inc. average score") {
                    includeAverageScore = false
                } else if (optionName.toLowerCase() === "exclude year") {
                    includeYear = true
                } else if (optionName.toLowerCase() === 'show all sequels') {
                    showAllSequels = false
                }
            }
        }
    })
    // Init User Entries and Information
    if (jsonIsEmpty(animeEntries)) {
        includedUserEntryCount = 1000 // Stop User Alert
        userEntries = []
    } else {
        includedUserEntryCount = 0 // Init
        userEntries = userEntries.reduce((result, { media, status, score }) => {
            let userAnimeID = media?.id
            let userEntry = {}
            if (userAnimeID && animeEntries[userAnimeID]) {
                userEntry.media = animeEntries[userAnimeID]
                userEntry.status = status
                userEntry.score = score
                result.push(userEntry)
            }
            return result
        }, [])
    }
    self.postMessage({ status: "Analyzing User List" })
    // Sort User Entries for Anomaly Removal
    if (userEntries.length >= 2) {
        if (typeof userEntries[0]?.score === "number"
            && typeof userEntries[1]?.score === "number"
            && typeof userEntries[0]?.media?.popularity === "number"
            && typeof userEntries[1]?.media?.popularity === "number") {
            // sort by user-score and popularity for unique anime in franchise
            userEntries.sort((a, b) => {
                return b.score - a.score
            })
            userEntries.sort((a, b) => {
                if (a.score === b.score) {
                    return b.media.popularity - a.media.popularity
                }
            })
        }
    }
    // Calculate Recommendation Map
    let varScheme = {
        genres: {},
        tags: {},
        studios: {},
        staff: {}
    }
    let userEntriesStatus = {
        userScore: {},
        userStatus: {}
    }
    let averageScore = []
    let year = []
    let genresMeanCount = {}
    let tagsMeanCount = {}
    let studiosMeanCount = {}
    let staffMeanCount = {}
    let includedAnimeRelations = {}
    self.postMessage({ status: "Processing User Schema" })
    for (let i = 0; i < userEntries.length; i++) {
        let anime = userEntries[i].media
        let animeID = anime?.id
        let status = userEntries[i].status
        let userScore = userEntries[i]?.score
        // Get Important Info in User Entries
        if (animeID) {
            if (status) {
                userEntriesStatus.userStatus[animeID] = status
            }
            if (userScore) {
                userEntriesStatus.userScore[animeID] = userScore
            }
        }
        // Init Variables
        let genres = anime?.genres || []
        let tags = anime?.tags || []
        let studios = anime?.studios?.nodes || []
        let staffs = anime?.staff?.edges || []
        if (userScore > 0) {// Filter Scored Anime
            // Check if a related anime is already analyzed
            if (includedAnimeRelations[animeID]) continue
            includedAnimeRelations[animeID] = true
            let animeFranchise = animeFranchises.find((e) => {
                if (e instanceof Array) {
                    return e.includes(animeID)
                }
            })
            // First Check
            if (animeFranchise instanceof Array) {
                if (animeFranchise.length > 0) {
                    animeFranchise.forEach((relatedID) => {
                        if (typeof relatedID === "number") {
                            includedAnimeRelations[relatedID] = true
                        }
                    })
                }
            }
            // Second Check for Recent Anime
            if (anime?.relations instanceof Array) {
                anime?.relations?.forEach?.(({ edges }) => {
                    let animeRelationNode = edges?.[j]?.node
                    let animeRelationType = edges?.[j]?.relationType
                    if (animeRelationNode && animeRelationType && typeof animeRelationType === "string") {
                        // Other characters may cast at a completely different anime
                        if (typeof animeRelationNode?.id === "number" && mediaRelationTypes.includes(animeRelationType.trim().toLowerCase())) {
                            includedAnimeRelations[animeRelationNode.id] = true
                        }
                    }
                })
            }
            // Exclude Similar Anime
            if (anime?.relations) {
                let animeRelations = anime?.relations?.edges || []
                for (let j = 0; j < animeRelations.length; j++) {
                    let animeRelationNode = animeRelations?.[j]?.node
                    let animeRelationType = animeRelations?.[j]?.relationType
                    if (animeRelationNode && animeRelationType && typeof animeRelationType === "string") {
                        // Other characters may cast at a completely different anime
                        if (typeof animeRelationNode?.id === "number" && mediaRelationTypes.includes(animeRelationType.trim().toLowerCase())) {
                            includedAnimeRelations[animeRelationNode.id] = true
                        }
                    }
                }
            }
            // Add as Included Entry in Recommendation Scheme
            ++includedUserEntryCount
            // Calculate the Variable Scheme
            for (let j = 0; j < genres.length; j++) {
                let genre = genres[j]
                if (typeof genre === "string") {
                    let fullGenre = "genre: " + genre.trim().toLowerCase()
                    if (!jsonIsEmpty(include.genres)) {
                        if (((include.genres[fullGenre] && !exclude.genres[fullGenre])
                            || include.genres["genre: all"])
                            && !exclude.genres["genre: all"]) {
                            if (varScheme.genres[fullGenre]) {
                                varScheme.genres[fullGenre].userScore.push(userScore)
                                ++varScheme.genres[fullGenre].count
                            } else {
                                varScheme.genres[fullGenre] = { userScore: [userScore], count: 1 }
                            }
                            if (genresMeanCount[fullGenre]) {
                                ++genresMeanCount[fullGenre]
                            } else {
                                genresMeanCount[fullGenre] = 1
                            }
                        }
                    } else {
                        if ((!exclude.genres[fullGenre] || include.genres["genre: all"])
                            && !exclude.genres["genre: all"]) {
                            if (varScheme.genres[fullGenre]) {
                                varScheme.genres[fullGenre].userScore.push(userScore)
                                ++varScheme.genres[fullGenre].count
                            } else {
                                varScheme.genres[fullGenre] = { userScore: [userScore], count: 1 }
                            }
                            if (genresMeanCount[fullGenre]) {
                                ++genresMeanCount[fullGenre]
                            } else {
                                genresMeanCount[fullGenre] = 1
                            }
                        }
                    }
                }
            }
            // Tags
            for (let j = 0; j < tags.length; j++) {
                let tag = tags[j]?.name
                let tagCategory = tags[j]?.category
                if (typeof tag === "string" && typeof tagCategory === "string") {
                    let fullTag = "tag: " + tag.trim().toLowerCase()
                    let fullTagCategory = "tag category: " + tagCategory.trim().toLowerCase()
                    if (!jsonIsEmpty(include.categories)) {
                        if (((include.categories[fullTagCategory] && !exclude.categories[fullTagCategory])
                            || include.categories["tag category: all"])
                            && !exclude.categories["tag category: all"]) {
                            if (!jsonIsEmpty(include.tags)) {
                                if (((include.tags[fullTag] && !exclude.tags[fullTag])
                                    || include.tags["tag: all"])
                                    && !exclude.tags["tag: all"]) {
                                    if (varScheme.tags[fullTag]) {
                                        varScheme.tags[fullTag].userScore.push(userScore)
                                        ++varScheme.tags[fullTag].count
                                    } else {
                                        varScheme.tags[fullTag] = { userScore: [userScore], count: 1 }
                                    }
                                    if (tagsMeanCount[fullTag]) {
                                        ++tagsMeanCount[fullTag]
                                    } else {
                                        tagsMeanCount[fullTag] = 1
                                    }
                                }
                            } else {
                                if ((!exclude.tags[fullTag] || include.tags["tag: all"])
                                    && !exclude.tags["tag: all"]) {
                                    if (varScheme.tags[fullTag]) {
                                        varScheme.tags[fullTag].userScore.push(userScore)
                                        ++varScheme.tags[fullTag].count
                                    } else {
                                        varScheme.tags[fullTag] = { userScore: [userScore], count: 1 }
                                    }
                                    if (tagsMeanCount[fullTag]) {
                                        ++tagsMeanCount[fullTag]
                                    } else {
                                        tagsMeanCount[fullTag] = 1
                                    }
                                }
                            }
                        }
                    } else {
                        if ((!exclude.categories[fullTagCategory] || include.categories["tag category: all"])
                            && !exclude.categories["tag category: all"]) {
                            if (!jsonIsEmpty(include.tags)) {
                                if (((include.tags[fullTag] && !exclude.tags[fullTag])
                                    || include.tags["tag: all"])
                                    && !exclude.tags["tag: all"]) {
                                    if (varScheme.tags[fullTag]) {
                                        varScheme.tags[fullTag].userScore.push(userScore)
                                        ++varScheme.tags[fullTag].count
                                    } else {
                                        varScheme.tags[fullTag] = { userScore: [userScore], count: 1 }
                                    }
                                    if (tagsMeanCount[fullTag]) {
                                        ++tagsMeanCount[fullTag]
                                    } else {
                                        tagsMeanCount[fullTag] = 1
                                    }
                                }
                            } else {
                                if ((!exclude.tags[fullTag] || include.tags["tag: all"])
                                    && !exclude.tags["tag: all"]) {
                                    if (varScheme.tags[fullTag]) {
                                        varScheme.tags[fullTag].userScore.push(userScore)
                                        ++varScheme.tags[fullTag].count
                                    } else {
                                        varScheme.tags[fullTag] = { userScore: [userScore], count: 1 }
                                    }
                                    if (tagsMeanCount[fullTag]) {
                                        ++tagsMeanCount[fullTag]
                                    } else {
                                        tagsMeanCount[fullTag] = 1
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // Studios
            let includedStudios = {}
            for (let j = 0; j < studios.length; j++) {
                if (!studios[j]?.isAnimationStudio) continue
                let studio = studios[j]?.name
                if (typeof studio === "string") {
                    if (includedStudios[studio]) continue
                    includedStudios[studio] = true
                    let fullStudio = "studio: " + studio.trim().toLowerCase()
                    if (!jsonIsEmpty(include.studios)) {
                        if (((include.studios[fullStudio] && !exclude.studios[fullStudio])
                            || include.studios["studio: all"])
                            && !exclude.studios["studio: all"]) {
                            if (varScheme.studios[fullStudio]) {
                                varScheme.studios[fullStudio].userScore.push(userScore)
                                ++varScheme.studios[fullStudio].count
                            } else {
                                varScheme.studios[fullStudio] = { userScore: [userScore], count: 1 }
                            }
                            if (studiosMeanCount[fullStudio]) {
                                ++studiosMeanCount[fullStudio]
                            } else {
                                studiosMeanCount[fullStudio] = 1
                            }
                        }
                    } else {
                        if ((!exclude.studios[fullStudio] || include.studios["studio: all"])
                            && !exclude.studios["studio: all"]) {
                            if (varScheme.studios[fullStudio]) {
                                varScheme.studios[fullStudio].userScore.push(userScore)
                                ++varScheme.studios[fullStudio].count
                            } else {
                                varScheme.studios[fullStudio] = { userScore: [userScore], count: 1 }
                            }
                            if (studiosMeanCount[fullStudio]) {
                                ++studiosMeanCount[fullStudio]
                            } else {
                                studiosMeanCount[fullStudio] = 1
                            }
                        }
                    }
                }
            }
            // Staffs
            let includedStaff = {}
            for (let j = 0; j < staffs.length; j++) {
                let staff = staffs[j]?.node?.name?.userPreferred
                if (typeof staff === "string" && typeof staffs[j]?.role === "string") {
                    if (includedStaff[staff]) continue
                    includedStaff[staff] = true
                    let staffRole = staffs[j].role.split("(")[0].trim()
                    let fullStaff = "staff: " + staff.trim().toLowerCase()
                    let fullStaffRole = "staff role: " + staffRole.trim().toLowerCase()
                    if (!jsonIsEmpty(include.roles)) {
                        if (((include.roles[fullStaffRole] && !exclude.roles[fullStaffRole])
                            || include.roles["staff role: all"])
                            && !exclude.roles["staff role: all"]) {
                            if (!jsonIsEmpty(include.staffs)) {
                                if (((include.staffs[fullStaff] && !exclude.staffs[fullStaff])
                                    || include.staffs["staff: all"])
                                    && !exclude.staffs["staff: all"]) {
                                    if (varScheme.staff[fullStaff]) {
                                        varScheme.staff[fullStaff].userScore.push(userScore)
                                        ++varScheme.staff[fullStaff].count
                                    } else {
                                        varScheme.staff[fullStaff] = { userScore: [userScore], count: 1 }
                                    }
                                    if (staffMeanCount[fullStaff]) {
                                        ++staffMeanCount[fullStaff]
                                    } else {
                                        staffMeanCount[fullStaff] = 1
                                    }
                                }
                            } else {
                                if ((!exclude.staffs[fullStaff] || include.staffs["staff: all"])
                                    && !exclude.staffs["staff: all"]) {
                                    if (varScheme.staff[fullStaff]) {
                                        varScheme.staff[fullStaff].userScore.push(userScore)
                                        ++varScheme.staff[fullStaff].count
                                    } else {
                                        varScheme.staff[fullStaff] = { userScore: [userScore], count: 1 }
                                    }
                                    if (staffMeanCount[fullStaff]) {
                                        ++staffMeanCount[fullStaff]
                                    } else {
                                        staffMeanCount[fullStaff] = 1
                                    }
                                }
                            }
                        }
                    } else {
                        if ((!exclude.roles[fullStaffRole] || include.roles["staff role: all"])
                            && !exclude.roles["staff role: all"]) {
                            if (!jsonIsEmpty(include.staffs)) {
                                if (((include.staffs[fullStaff] && !exclude.staffs[fullStaff])
                                    || include.staffs["staff: all"])
                                    && !exclude.staffs["staff: all"]) {
                                    if (varScheme.staff[fullStaff]) {
                                        varScheme.staff[fullStaff].userScore.push(userScore)
                                        ++varScheme.staff[fullStaff].count
                                    } else {
                                        varScheme.staff[fullStaff] = { userScore: [userScore], count: 1 }
                                    }
                                    if (staffMeanCount[fullStaff]) {
                                        ++staffMeanCount[fullStaff]
                                    } else {
                                        staffMeanCount[fullStaff] = 1
                                    }
                                }
                            } else {
                                if ((!exclude.staffs[fullStaff] || include.staffs["staff: all"])
                                    && !exclude.staffs["staff: all"]) {
                                    if (varScheme.staff[fullStaff]) {
                                        varScheme.staff[fullStaff].userScore.push(userScore)
                                        ++varScheme.staff[fullStaff].count
                                    } else {
                                        varScheme.staff[fullStaff] = { userScore: [userScore], count: 1 }
                                    }
                                    if (staffMeanCount[fullStaff]) {
                                        ++staffMeanCount[fullStaff]
                                    } else {
                                        staffMeanCount[fullStaff] = 1
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Init Linear Models Training Data
            if (isaN(anime?.averageScore) && includeAverageScore) {
                averageScore.push({ userScore: userScore, averageScore: anime.averageScore })
            }
            if (isaN(parseFloat(anime?.seasonYear)) && includeYear) {
                year.push({ userScore: userScore, year: parseFloat(anime.seasonYear) })
            }
        }
    }
    if (includedUserEntryCount < 1) {
        varScheme = {}
    } else {
        // Clean Data
        let genreMeanCountLower;
        if (typeof sampleSize === "number" && sampleSize >= 1) {
            genresMeanCount = sampleSize
        } else if (!jsonIsEmpty(genresMeanCount)) {
            let genresCountValues = Object.values(genresMeanCount)
            genresCountValues = filterArrayByMeanPercentages(genresCountValues)
            genresMeanCount = arrayMean(genresCountValues)
            genreMeanCountLower = Math.min(genresMeanCount, arrayMedian(genresCountValues), arrayMode(genresCountValues))
        } else {
            genresMeanCount = 10
        }
        if (minSampleSize >= 0) {
            genresMeanCount = Math.max(minSampleSize, genresMeanCount)
        }

        let tagMeanCountLower;
        if (typeof sampleSize === "number" && sampleSize >= 1) {
            tagsMeanCount = sampleSize
        } else if (!jsonIsEmpty(tagsMeanCount)) {
            let tagsCountValues = Object.values(tagsMeanCount)
            tagsCountValues = filterArrayByMeanPercentages(tagsCountValues)
            tagsMeanCount = arrayMean(tagsCountValues)
            tagMeanCountLower = Math.min(tagsMeanCount, arrayMedian(tagsCountValues), arrayMode(tagsCountValues))
        } else {
            tagsMeanCount = 10
        }
        if (minSampleSize >= 0) {
            tagsMeanCount = Math.max(minSampleSize, tagsMeanCount)
        }

        if (typeof sampleSize === "number" && sampleSize >= 1) {
            studiosMeanCount = sampleSize
        } else if (!jsonIsEmpty(studiosMeanCount)) {
            let studiosCountValues = Object.values(studiosMeanCount)
            studiosMeanCount = arrayMode(studiosCountValues) // Appears Little so Set Minimum
        } else {
            studiosMeanCount = 10
        }
        if (minSampleSize >= 0) {
            studiosMeanCount = Math.max(minSampleSize, studiosMeanCount)
        }

        if (typeof sampleSize === "number" && sampleSize >= 1) {
            staffMeanCount = sampleSize
        } else if (!jsonIsEmpty(staffMeanCount)) {
            let staffCountValues = Object.values(staffMeanCount)
            staffMeanCount = arrayMode(staffCountValues) // Appears Little so Set Minimum
        } else {
            staffMeanCount = 10
        }
        if (minSampleSize >= 0) {
            staffMeanCount = Math.max(minSampleSize, staffMeanCount)
        }

        // Add other Parameters
        varScheme.includeUnknownVar = includeUnknownVar
        varScheme.minPopularity = minPopularity
        varScheme.minAverageScore = minAverageScore

        // Calculate Variable Scores
        // Genres
        let genresKey = Object.keys(varScheme.genres)
        let genresMean = []
        for (let i = 0; i < genresKey.length; i++) {
            if (measure === "mode") {
                let tempModeScore = arrayMode(varScheme.genres[genresKey[i]].userScore)
                genresMean.push(tempModeScore)
            } else {
                let tempMeanScore = arrayMean(varScheme.genres[genresKey[i]].userScore)
                genresMean.push(tempMeanScore)
            }
        }
        genresMean = arrayMean(genresMean)
        for (let i = 0; i < genresKey.length; i++) {
            let tempScore = 0
            if (measure === "mode") {
                tempScore = arrayMode(varScheme.genres[genresKey[i]].userScore)
            } else {
                tempScore = arrayMean(varScheme.genres[genresKey[i]].userScore)
            }
            // Include High Weight or Low scored Variables to avoid High-scored Variables without enough sample
            let count = varScheme.genres[genresKey[i]].count
            if (count >= genresMeanCount || (count <= genreMeanCountLower && tempScore < genresMean)) {
                if ((count <= genreMeanCountLower && tempScore < genresMean)) {
                    genresWithLowerCount[genresKey[i]] = true
                }
                varScheme.genres[genresKey[i]] = tempScore
            } else {
                delete varScheme.genres[genresKey[i]]
            }
        }

        // Tags
        let tagsKey = Object.keys(varScheme.tags)
        let tagsMean = []
        for (let i = 0; i < tagsKey.length; i++) {
            if (measure === "mode") {
                let tempModeScore = arrayMode(varScheme.tags[tagsKey[i]].userScore)
                tagsMean.push(tempModeScore)
            } else {
                let tempMeanScore = arrayMean(varScheme.tags[tagsKey[i]].userScore)
                tagsMean.push(tempMeanScore)
            }
        }
        tagsMean = arrayMean(tagsMean)
        for (let i = 0; i < tagsKey.length; i++) {
            let tempScore = 0
            if (measure === "mode") {
                tempScore = arrayMode(varScheme.tags[tagsKey[i]].userScore)
            } else {
                tempScore = arrayMean(varScheme.tags[tagsKey[i]].userScore)
            }
            // Include High Weight or Low scored Variables to avoid High-scored Variables without enough sample
            let count = varScheme.tags[tagsKey[i]].count
            if (count >= tagsMeanCount || (count <= tagMeanCountLower && tempScore < tagsMean)) {
                varScheme.tags[tagsKey[i]] = tempScore
            } else {
                delete varScheme.tags[tagsKey[i]]
            }
        }

        // Studios
        let studiosKey = Object.keys(varScheme.studios)
        let studiosMean = []
        // let filteredStudiosMean = []
        for (let i = 0; i < studiosKey.length; i++) {
            if (measure === "mode") {
                let tempModeScore = arrayMode(varScheme.studios[studiosKey[i]].userScore)
                studiosMean.push(tempModeScore)
            } else {
                let tempMeanScore = arrayMean(varScheme.studios[studiosKey[i]].userScore)
                studiosMean.push(tempMeanScore)
            }
        }
        studiosMean = arrayMean(studiosMean)

        // Staffs
        let staffKey = Object.keys(varScheme.staff)
        let staffMean = []
        // let filteredStaffMean = []
        for (let i = 0; i < staffKey.length; i++) {
            if (measure === "mode") {
                let tempModeScore = arrayMode(varScheme.staff[staffKey[i]].userScore)
                staffMean.push(tempModeScore)
            } else {
                let tempMeanScore = arrayMean(varScheme.staff[staffKey[i]].userScore)
                staffMean.push(tempMeanScore)
            }
        }
        staffMean = arrayMean(staffMean)

        // Join Data
        varScheme.meanGenres = genresMean
        varScheme.meanTags = tagsMean
        varScheme.includeCategories = include.categories
        varScheme.excludeCategories = exclude.categories

        // Linear Model Building | y is Predicted so its Userscore
        // Year Model
        if (includeYear) {
            let yearXY = []
            for (let i = 0; i < year.length; i++) {
                yearXY.push([year[i].year, year[i].userScore])
            }
            if (yearXY.length >= (minSampleSize || 33)) {
                varScheme.yearModel = linearRegression(yearXY)
            }
        }
        // Average Score Model
        if (includeAverageScore) {
            let averageScoreXY = []
            for (let i = 0; i < averageScore.length; i++) {
                averageScoreXY.push([averageScore[i].averageScore, averageScore[i].userScore])
            }
            if (averageScoreXY.length >= (minSampleSize || 33)) {
                varScheme.averageScoreModel = linearRegression(averageScoreXY)
            }
        }
    }
    // Calculate Anime Recommendation List
    self.postMessage({ status: "Processing Recommendation List" })
    // Init Data
    let filters = await retrieveJSON("filters")
    animeEntries = Object.values(animeEntries ?? {});
    let recommendedAnimeList = {};
    let maxScore;
    // let averageScoresArray = animeEntries.filter(({ averageScore }) => averageScore >= 1)
    //     .map(({ averageScore }) => averageScore);
    let popularityArray = animeEntries.filter(({ popularity }) => popularity >= 1)
        .map(({ popularity }) => popularity);
    let popularitySum = popularityArray.length
        ? arraySum(popularityArray)
        : 3000000;
    let popularityMode = varScheme?.minPopularity
        ? varScheme.minPopularity
        : Math.min(arrayMean(popularityArray), arrayMode(popularityArray));
    let averageScoreMode = varScheme?.minAverageScore
        ? varScheme.minAverageScore
        : 49.67
    // let averageScoreMean = arrayMean(averageScoresArray)
    if (!jsonIsEmpty(varScheme)) {
        animeFranchises = []
        let maxScoreTest = 0
        let userScoreBase = 100
        let userScores = Object.values(userEntriesStatus.userScore);
        let meanUserScore, meanScoreAll, meanScoreAbove;
        if (userScores?.length) {
            let max = Math.max(...userScores);
            userScoreBase = max <= 3
                ? 3
                : max <= 5
                    ? 5
                    : max <= 10
                        ? 10
                        : 100;
            meanUserScore = arrayMean(userScores);
        }
        for (let i = 0; i < animeEntries.length; i++) {
            let anime = animeEntries[i];
            let title = anime?.title?.userPreferred;
            let animeID = anime?.id;
            let animeUrl = anime?.siteUrl;
            let format = anime?.format;
            let year = anime?.seasonYear;
            let season = anime?.season;
            let genres = anime?.genres || [];
            let tags = anime?.tags || [];
            let studios =
                anime?.studios?.nodes?.filter(
                    (studio) => studio?.isAnimationStudio
                ) || [];
            let staffs = anime?.staff?.edges || [];
            let status = anime?.status;
            let popularity = anime?.popularity;
            // Update Anime Franchise
            let afIdxs = animeFranchises.reduce((result, e, idx) => {
                if (e instanceof Array) {
                    if (e.includes(animeID)) {
                        result.push(idx);
                    }
                }
                return result;
            }, []);
            let afIdx;
            if (afIdxs.length > 1 || afIdxs.length < 1) {
                // Union if there are duplicate franchise
                if (afIdxs.length > 1) {
                    let newFranchise = animeFranchises[afIdxs[0]];
                    for (let j = 1; j < afIdxs.length; j++) {
                        newFranchise = Array.from(new Set(newFranchise.concat(animeFranchises[afIdxs[j]])));
                    }
                    // Remove Old Duplicates
                    afIdxs.sort((a, b) => b - a);
                    for (let j = 0; j < afIdxs.length; j++) {
                        animeFranchises.splice(afIdxs[j], 1);
                    }
                    // Add New Unioned Franchise
                    animeFranchises.push(newFranchise);
                } else { // If its a New Franchise
                    animeFranchises.push([animeID]);
                }
                // Get the index of the New Franchise
                afIdx = animeFranchises.length - 1;
            } else { // else if there is only one
                // Index of Franchise
                afIdx = animeFranchises.findIndex((e) => {
                    if (e instanceof Array) {
                        return e.includes(animeID);
                    }
                });
            }
            // Add each Anime relations to its Franchise
            let animeRelations = anime?.relations?.edges || [];
            animeRelations.forEach((e) => {
                let animeRelationType = e?.relationType;
                let relationID = e?.node?.id;
                if (
                    typeof animeRelationType === "string" &&
                    typeof relationID === "number" &&
                    animeRelationType
                ) {
                    if (
                        mediaRelationTypes.includes(
                            animeRelationType.trim().toLowerCase()
                        )
                    ) {
                        if (animeFranchises[afIdx] instanceof Array) {
                            if (!animeFranchises[afIdx].includes(relationID)) {
                                animeFranchises[afIdx].push(relationID);
                            }
                        }
                    }
                }
            });
            // Show All Sequels or Hide Next Sequels
            if (!showAllSequels) {
                let animeRelations = anime?.relations?.edges || [];
                // Conditions
                let isUnwatchedSequel =
                    // No Prequel
                    !animeRelations.some((e) => {
                        let animeRelationType = e?.relationType;
                        if (typeof animeRelationType === "string") {
                            if (animeRelationType.trim().toLowerCase() === "prequel") {
                                return true;
                            }
                        }
                    }) ||
                    // or Have Prequel but...
                    animeRelations.some((e) => {
                        let animeRelationType = e?.relationType;
                        let animeRelationPopularity = e?.node?.popularity;
                        let animeRelationID = e?.node?.id;
                        if (
                            typeof animeRelationType === "string" &&
                            typeof animeRelationID === "number" &&
                            typeof animeRelationPopularity === "number"
                        ) {
                            if (animeRelationType.trim().toLowerCase() === "prequel") {
                                // ...Prequel is Watched
                                if (
                                    typeof userEntriesStatus?.userStatus?.[animeRelationID] === "string"
                                ) {
                                    if (
                                        userEntriesStatus?.userStatus?.[animeRelationID].trim().toLowerCase() === "completed" ||
                                        userEntriesStatus?.userStatus?.[animeRelationID].trim().toLowerCase() === "repeating"
                                    ) {
                                        return true;
                                    }
                                    // ...Prequel is a Small/Unpopular Anime
                                } else if (
                                    !userEntriesStatus?.userStatus?.[animeRelationID] &&
                                    typeof popularity === "number"
                                ) {
                                    if (animeRelationPopularity <= popularity) {
                                        return true;
                                    }
                                }
                            }
                        }
                    });
                // Don't Include if Anime Entry
                if (!isUnwatchedSequel) {
                    delete recommendedAnimeList[animeID];
                    continue;
                }
            }
            // Update Non Iterative Filters
            let userStatus = "UNWATCHED";
            if (typeof userEntriesStatus?.userStatus?.[animeID] === "string") {
                userStatus = userEntriesStatus.userStatus[animeID];
                let tmpUserStatus = userStatus.trim().toLowerCase();
                if (filters['user status'][tmpUserStatus] === undefined) {
                    filters['user status'][tmpUserStatus] = true
                }
            }
            if (typeof season === "string") {
                let tempSeason = season.trim().toLowerCase();
                if (filters['season'][tempSeason] === undefined) {
                    filters['season'][tempSeason] = true
                }
            }
            if (typeof status === "string") {
                let tempStatus = status.trim().toLowerCase();
                if (filters['airing status'][tempStatus] === undefined) {
                    filters['airing status'][tempStatus] = true
                }
            }
            if (typeof format === "string") {
                let tempFormat = format.trim().toLowerCase();
                if (filters['format'][tempFormat] === undefined) {
                    filters['format'][tempFormat] = true
                }
            }
            if (year) {
                let tempYear = year?.toString?.().trim().toLowerCase();
                if (filters['year'][tempYear] === undefined) {
                    filters['year'][tempYear] = true
                }
            }
            let genresIncluded = {};
            let tagsIncluded = {};
            let studiosIncluded = {};
            // Calculate Recommendation Scores and Update Iterative Filters
            let zgenres = [];
            for (let j = 0; j < genres.length; j++) {
                let genre = genres[j];
                if (typeof genre !== "string") continue;
                genre = genre.trim().toLowerCase();
                let fullGenre = "genre: " + genre;
                if (typeof varScheme.genres[fullGenre] === "number") {
                    zgenres.push({ genre: fullGenre, score: varScheme.genres[fullGenre] });
                    // Top Similarities
                    if (typeof varScheme.meanGenres === "number") {
                        if (varScheme.genres[fullGenre] >= varScheme.meanGenres &&
                            !genresIncluded[fullGenre]) {
                            let tmpscore = varScheme.genres[fullGenre];
                            genresIncluded[fullGenre] = [
                                genre + " (" + tmpscore.toFixed(2) + ")",
                                tmpscore,
                            ];
                        }
                    }
                } else if (typeof varScheme.meanGenres === "number" && includeUnknownVar) {
                    zgenres.push({ genre: fullGenre, score: varScheme.meanGenres });
                }
                // Filters
                if (filters['genre'][genre] === undefined) {
                    filters['genre'][genre] = true
                }
            }
            let ztags = [];
            for (let j = 0; j < tags.length; j++) {
                let tag = tags[j]?.name;
                if (typeof tag !== "string") continue;
                let tagCategory = tags[j]?.category;
                if (typeof tagCategory !== "string") continue;
                let tagRank = tags[j]?.rank;
                tag = tag.trim().toLowerCase();
                let fullTag = "tag: " + tag;
                tagCategory = tagCategory.trim().toLowerCase();
                let fullTagCategory = "tag category: " + tagCategory;
                if (!jsonIsEmpty(varScheme.includeCategories)) {
                    if (varScheme.includeCategories[fullTagCategory]) {
                        if (typeof varScheme.tags[fullTag] === "number") {
                            ztags.push(varScheme.tags[fullTag]);
                            // Top Similarities
                            if (typeof varScheme.meanTags === "number" && typeof tagRank === "number") {
                                if (tagRank >= 50
                                    && varScheme.tags[fullTag] >= varScheme.meanTags &&
                                    !tagsIncluded[fullTag]) {
                                    let tmpscore = varScheme.tags[fullTag];
                                    tagsIncluded[fullTag] = [
                                        tag + " (" + tmpscore.toFixed(2) + ")",
                                        tmpscore,
                                    ];
                                }
                            }
                        } else if (typeof varScheme.meanTags === "number" && includeUnknownVar) {
                            ztags.push(varScheme.meanTags);
                        }
                    }
                } else {
                    if (!varScheme.excludeCategories[fullTagCategory]) {
                        if (typeof varScheme.tags[fullTag] === "number") {
                            ztags.push(varScheme.tags[fullTag]);
                            // Top Similarities
                            if (typeof varScheme.meanTags === "number" && typeof tagRank === "number") {
                                if (tagRank >= 50 &&
                                    varScheme.tags[fullTag] >= varScheme.meanTags &&
                                    !tagsIncluded[fullTag]) {
                                    let tmpscore = varScheme.tags[fullTag];
                                    tagsIncluded[fullTag] = [
                                        tag + " (" + tmpscore.toFixed(2) + ")",
                                        tmpscore,
                                    ];
                                }
                            }
                        } else if (typeof varScheme.meanTags === "number" && includeUnknownVar) {
                            ztags.push(varScheme.meanTags);
                        }
                    }
                }
                // Filters
                if (filters['tag'][tag] === undefined) {
                    filters['tag'][tag] = true
                }
                if (filters['tag category'][tagCategory] === undefined) {
                    filters['tag category'][tagCategory] = true
                }
            }
            // let zstudios = [];
            let includedStudios = {};
            for (let j = 0; j < studios.length; j++) {
                let studio = studios[j]?.name;
                if (typeof studio !== "string") continue;
                if (includedStudios[studio]) continue;
                includedStudios[studio] = true;
                studio = studio.trim().toLowerCase();
                // Filters
                if (filters['studio'][studio] === undefined) {
                    filters['studio'][studio] = true
                }
            }
            // let zstaff = {};
            let includedStaff = {};
            for (let j = 0; j < staffs.length; j++) {
                let staff = staffs[j]?.node?.name?.userPreferred;
                if (typeof staff !== "string") continue;
                if (includedStaff[staff]) continue;
                includedStaff[staff] = true;
                let staffRole = staffs[j]?.role;
                if (typeof staffRole !== "string") continue;
                staff = staff.trim().toLowerCase();
                staffRole = staffRole.split("(")[0].trim().toLowerCase();
                // filters
                if (filters['staff role'][staffRole] === undefined) {
                    filters['staff role'][staffRole] = true
                }
            }
            // Include Linear Model Prediction from Earlier
            // Anime Quality
            let animeQuality = [];
            let seasonYear = anime?.seasonYear;
            let yearModel = varScheme.yearModel ?? {};
            if (isaN(seasonYear) && !jsonIsEmpty(yearModel) && includeYear) {
                if (typeof seasonYear === "string") {
                    seasonYear = parseFloat(seasonYear);
                }
                let modelScore = LRpredict(yearModel, seasonYear)
                if (modelScore >= 1) {
                    animeQuality.push(modelScore);
                } else {
                    animeQuality.push(1)
                }
            } else {
                animeQuality.push(1)
            }
            let averageScore = anime?.averageScore;
            let averageScoreModel = varScheme.averageScoreModel ?? {};
            if (isaN(averageScore) && !jsonIsEmpty(averageScoreModel) && includeAverageScore) {
                if (typeof averageScore === "string") {
                    averageScore = parseFloat(averageScore);
                }
                let modelScore = LRpredict(averageScoreModel, averageScore)
                if (modelScore >= 1) {
                    animeQuality.push(modelScore);
                } else {
                    animeQuality.push(1)
                }
            } else {
                animeQuality.push(1)
            }
            let episodes = anime?.episodes
            let duration = anime?.duration

            // Combine Scores
            // Anime Content
            let animeContent = [];
            if (zgenres.length) {
                let genreValues = zgenres.reduce((acc, _genre) => {
                    acc.push(_genre.score)
                    return acc
                }, [])
                if (zgenres.some((e) => genresWithLowerCount[e.genre])) {
                    if (measure === "mode") {
                        animeContent.push(arrayMode(genreValues));
                    } else {
                        animeContent.push(arrayMean(genreValues));
                    }
                } else {
                    animeContent.push(Math.max(...genreValues));
                }
            } else {
                animeContent.push(1)
            }
            if (ztags.length) {
                if (measure === "mode") {
                    animeContent.push(arrayMode(ztags));
                } else {
                    animeContent.push(arrayMean(ztags));
                }
            } else {
                animeContent.push(1)
            }

            // Calculate Recommendation Scores
            let finalAnimeQuality =
                animeQuality.length
                    ? measure === "mode"
                        ? arrayMode(animeQuality)
                        : arrayMean(animeQuality)
                    : 1
            let finalAnimeContent =
                animeContent.length
                    ? measure === "mode"
                        ? arrayMode(animeContent)
                        : arrayMean(animeContent)
                    : 1
            let score = finalAnimeContent * finalAnimeQuality
            maxScore = Math.pow(userScoreBase, 2)
            // Process other Anime Info
            genres = genres.length ? genres : [];
            tags = tags.length ? tags.map((e) => e?.name || "") : [];
            studios = studios.reduce(
                (result, e) => Object.assign(result, { [formatCustomString(e?.name)]: e?.siteUrl }),
                {}
            );
            staffs = staffs.reduce((result, e) =>
                Object.assign(result, {
                    [e?.node?.name?.userPreferred]: e?.node?.siteUrl,
                }),
                {});
            // Sort all Top Similarities
            let favoriteContents = Object.values(genresIncluded)
                .concat(Object.values(tagsIncluded))
                .concat(Object.values(studiosIncluded))
                .sort((a, b) => {
                    return b?.[1] - a?.[1];
                })
                .map((e) => {
                    return e?.[0] || "";
                });
            favoriteContents = favoriteContents.length ? favoriteContents : [];
            // Add To Processed Recommendation List
            maxScoreTest = Math.max(score, maxScoreTest)
            recommendedAnimeList[animeID] = {
                id: animeID,
                title: title,
                animeUrl: animeUrl,
                userScore: userEntriesStatus?.userScore?.[animeID],
                averageScore: averageScore,
                popularity: popularity,
                score: score,
                favoriteContents: favoriteContents,
                userStatus: formatCustomString(userStatus),
                status: formatCustomString(status),
                // Others
                genres: genres.map(e => formatCustomString(e)),
                tags: tags.map(e => formatCustomString(e)),
                year: year,
                season: formatCustomString(season),
                format: formatCustomString(format),
                studios: studios,
                staffs: staffs,
                episodes: episodes,
                duration: duration,
                coverImageUrl: anime?.coverImage?.large,
                trailerID: anime?.trailer?.id,
                bannerImageUrl: anime?.bannerImage,
            };
        }
        // After Loop
        let recommendedAnimeListEntries = Object.values(recommendedAnimeList);
        // Calculate WeightedScore
        recommendedAnimeListEntries = recommendedAnimeListEntries.map((anime) => {
            let weightedScore;
            // Low Average
            if (anime.averageScore >= 1) {
                if (anime.averageScore < averageScoreMode) {
                    let ASweight = anime.averageScore * 0.01;
                    weightedScore = anime.score * ASweight >= 0.01 ? Math.min(ASweight, 1) : 0.01
                } else {
                    weightedScore = anime.score
                }
            }
            // Low Popularity
            if (anime.popularity >= 1 && popularityMode >= 1 && popularitySum >= 1 && anime.score >= 1) {
                if (anime.popularity < popularityMode) {
                    weightedScore = Math.min(weightedScore, ((anime.popularity || 1) / popularitySum) * anime.score)
                } else {
                    weightedScore = anime.score
                }
            }
            anime.weightedScore = weightedScore
            // Handle Exceptions
            if (!anime.weightedScore || !isFinite(anime.weightedScore)) {
                anime.weightedScore = 1;
            }
            if (!anime.score || !isFinite(anime.score)) {
                anime.score = 1;
            }
            return anime
        })
        // Map Value to Score Basis
        recommendedAnimeListEntries = recommendedAnimeListEntries.map((anime) => {
            let newHighestRange = customUserScoreBase >= 0 ? customUserScoreBase : userScoreBase
            anime.score = newHighestRange > 1 ? mapValue(anime.score, 1, maxScore, 1, newHighestRange) : anime.score
            anime.weightedScore = newHighestRange > 1 ? mapValue(anime.weightedScore, 1, maxScore, 1, newHighestRange) : anime.weightedScore
            return anime
        })
        // Get Mean Scores
        let userScoresAnimes = recommendedAnimeListEntries?.filter(({ userScore }) => userScore >= 1) || []
        let scoresArray = userScoresAnimes?.map(({ score }) => score) || []
        let scoreAboveMeanArray = userScoresAnimes?.filter(({ userScore }) => userScore >= meanUserScore)?.map(({ score }) => score) || []
        if (scoresArray?.length) {
            meanScoreAll = arrayMean(scoresArray)
        }
        if (scoreAboveMeanArray?.length) {
            meanScoreAbove = arrayMean(scoreAboveMeanArray)
        }
        // Update List
        recommendedAnimeListEntries.forEach((anime) => {
            let animeID = anime.id
            if (animeID !== null && animeID !== undefined) {
                anime.meanScoreAll = meanScoreAll >= 1 ? meanScoreAll : 1;
                anime.meanScoreAbove = meanScoreAbove >= 1 ? meanScoreAbove : 1;
                recommendedAnimeList[animeID] = anime
            }
        })
    } else {
        let scoreBase = 100 // 0 causes problem so it should be > 0
        let maxScore
        for (let i = 0; i < animeEntries.length; i++) {
            let anime = animeEntries[i];
            let title = anime?.title?.userPreferred;
            let animeID = anime?.id;
            let animeUrl = anime?.siteUrl;
            let format = anime?.format;
            let year = anime?.seasonYear;
            let season = anime?.season;
            let genres = anime?.genres || [];
            let tags = anime?.tags || [];
            let studios =
                anime?.studios?.nodes?.filter(
                    (studio) => studio?.isAnimationStudio
                ) || [];
            let staffs = anime?.staff?.edges || [];
            let status = anime?.status;
            let episodes = anime?.episodes
            let duration = anime?.duration
            // Update Anime Franchise
            let afIdxs = animeFranchises.reduce((result, e, idx) => {
                if (e instanceof Array) {
                    if (e.includes(animeID)) {
                        result.push(idx);
                    }
                }
                return result;
            }, []);
            let afIdx;
            if (afIdxs.length > 1 || afIdxs.length < 1) {
                // Union if there are duplicate franchise
                if (afIdxs.length > 1) {
                    let newFranchise = animeFranchises[afIdxs[0]];
                    for (let j = 1; j < afIdxs.length; j++) {
                        newFranchise = Array.from(new Set(newFranchise.concat(animeFranchises[afIdxs[j]])));
                    }
                    // Remove Old Duplicates
                    afIdxs.sort((a, b) => b - a);
                    for (let j = 0; j < afIdxs.length; j++) {
                        animeFranchises.splice(afIdxs[j], 1);
                    }
                    // Add New Unioned Franchise
                    animeFranchises.push(newFranchise);
                } else { // If its a New Franchise
                    animeFranchises.push([animeID]);
                }
                // Get the index of the New Franchise
                afIdx = animeFranchises.length - 1;
            } else { // else if there is only one
                // Index of Franchise
                afIdx = animeFranchises.findIndex((e) => {
                    if (e instanceof Array) {
                        return e.includes(animeID);
                    }
                });
            }
            // Add each Anime relations to its Franchise
            let animeRelations = anime?.relations?.edges || [];
            animeRelations.forEach((e) => {
                let animeRelationType = e?.relationType;
                let relationID = e?.node?.id;
                if (
                    typeof animeRelationType === "string" &&
                    typeof relationID === "number" &&
                    animeRelationType
                ) {
                    if (
                        mediaRelationTypes.includes(
                            animeRelationType.trim().toLowerCase()
                        )
                    ) {
                        if (animeFranchises[afIdx] instanceof Array) {
                            if (!animeFranchises[afIdx].includes(relationID)) {
                                animeFranchises[afIdx].push(relationID);
                            }
                        }
                    }
                }
            });
            if (typeof season === "string") {
                let tempSeason = season.trim().toLowerCase();
                if (filters['season'][tempSeason] === undefined) {
                    filters['season'][tempSeason] = true
                }
            }
            if (typeof status === "string") {
                let tempStatus = status.trim().toLowerCase();
                if (filters['airing status'][tempStatus] === undefined) {
                    filters['airing status'][tempStatus] = true
                }
            }
            if (typeof format === "string") {
                let tempFormat = format.trim().toLowerCase();
                if (filters['format'][tempFormat] === undefined) {
                    filters['format'][tempFormat] = true
                }
            }
            if (year) {
                let tempYear = year?.toString?.().trim().toLowerCase();
                if (filters['year'][tempYear] === undefined) {
                    filters['year'][tempYear] = true
                }
            }
            // Arrange
            for (let j = 0; j < genres.length; j++) {
                let genre = genres[j];
                if (typeof genre !== "string") continue;
                genre = genre.trim().toLowerCase();
                if (filters['genre'][genre] === undefined) {
                    filters['genre'][genre] = true
                }
            }
            for (let j = 0; j < tags.length; j++) {
                let tag = tags[j]?.name;
                if (typeof tag !== "string") continue;
                tag = tag.trim().toLowerCase();
                if (filters['tag'][tag] === undefined) {
                    filters['tag'][tag] = true
                }
                let tagCategory = tags[j]?.category;
                if (typeof tagCategory !== "string") continue;
                tagCategory = tagCategory.trim().toLowerCase();
                if (filters['tag category'][tagCategory] === undefined) {
                    filters['tag category'][tagCategory] = true
                }
            }
            for (let j = 0; j < studios.length; j++) {
                let studio = studios[j]?.name
                if (typeof studio !== "string") continue
                studio = studio.trim().toLowerCase()
                if (filters['studio'][studio] === undefined) {
                    filters['studio'][studio] = true
                }
            }
            for (let j = 0; j < staffs.length; j++) {
                let staffRole = staffs[j].role;
                if (typeof staffRole !== "string") continue;
                staffRole = staffRole.split("(")[0].trim().toLowerCase();
                if (filters['staff role'][staffRole] === undefined) {
                    filters['staff role'][staffRole] = true
                }
            }
            let score = 1;
            let averageScore = anime?.averageScore;
            if (isaN(averageScore)) {
                if (typeof averageScore === "string") {
                    averageScore = parseFloat(averageScore);
                }
            }
            let favourites = anime?.favourites;
            if (isaN(favourites)) {
                if (typeof favourites === "string") {
                    favourites = parseFloat(favourites);
                }
            }
            let popularity = anime?.popularity;
            if (isaN(popularity)) {
                if (typeof popularity === "string") {
                    popularity = parseFloat(popularity);
                }
            }
            if (
                isaN(averageScore) &&
                isaN(favourites) &&
                isaN(popularity) &&
                popularity
            ) {
                let favPopRatio = 1;
                if (anime.favourites < anime.popularity) {
                    favPopRatio = anime.favourites / anime.popularity;
                }
                score = favPopRatio * averageScore;
            }
            maxScore = 100 // favepopupRatio * averageScore = 1 * 100 = 100 max score
            // Other Anime Recommendation Info
            genres = genres.length ? genres : [];
            tags = tags.length ? tags.map((e) => e?.name || "") : [];
            studios = studios.reduce((result, e) =>
                Object.assign(result, { [formatCustomString(e?.name)]: e?.siteUrl })
                , {});
            staffs = staffs.reduce((result, e) =>
                Object.assign(result, {
                    [e?.node?.name?.userPreferred]: e?.node?.siteUrl,
                })
                , {});
            recommendedAnimeList[animeID] = {
                id: animeID,
                title: title,
                animeUrl: animeUrl,
                userScore: userEntriesStatus?.userScore?.[animeID],
                averageScore: averageScore,
                popularity: popularity,
                score: score,
                favoriteContents: [],
                userStatus: "UNWATCHED",
                status: formatCustomString(status),
                // Others
                genres: genres.map(e => formatCustomString(e)),
                tags: tags.map(e => formatCustomString(e)),
                year: year,
                season: formatCustomString(season),
                format: formatCustomString(format),
                studios: studios,
                staffs: staffs,
                episodes: episodes,
                duration: duration,
                coverImageUrl: anime?.coverImage?.large,
                trailerID: anime?.trailer?.id,
                bannerImageUrl: anime?.bannerImage,
            };
        }
        // After Loop
        let recommendedAnimeListEntries = Object.values(recommendedAnimeList);
        // Calculate WeightedScore
        recommendedAnimeListEntries = recommendedAnimeListEntries.map((anime) => {
            let weightedScore;
            // Low Average
            if (anime.averageScore >= 1) {
                if (anime.averageScore < averageScoreMode) {
                    let ASweight = anime.averageScore * 0.01;
                    weightedScore = anime.score * ASweight >= 0.01 ? Math.min(ASweight, 1) : 0.01
                } else {
                    weightedScore = anime.score
                }
            }
            // Low Popularity
            if (anime.popularity >= 1 && popularityMode >= 1 && popularitySum >= 1 && anime.score >= 1) {
                if (anime.popularity < popularityMode) {
                    weightedScore = Math.min(weightedScore, ((anime.popularity || 1) / popularitySum) * anime.score)
                } else {
                    weightedScore = anime.score
                }
            }
            anime.weightedScore = weightedScore
            // Handle Exceptions
            if (!anime.weightedScore || !isFinite(anime.weightedScore)) {
                anime.weightedScore = 1;
            }
            if (!anime.score || !isFinite(anime.score)) {
                anime.score = 1;
            }
            return anime
        })
        // Map Value to Score Basis
        recommendedAnimeListEntries = recommendedAnimeListEntries.map((anime) => {
            let newHighestRange = customUserScoreBase >= 0 ? customUserScoreBase : scoreBase
            anime.score = newHighestRange > 1 ? mapValue(anime.score, 1, maxScore, 1, newHighestRange) : anime.score
            anime.weightedScore = newHighestRange > 1 ? mapValue(anime.weightedScore, 1, maxScore, 1, newHighestRange) : anime.weightedScore
            return anime
        })
        // Get Mean Scores
        let scoresArray = recommendedAnimeListEntries?.map(({ score }) => score) || []
        let scoreAboveMeanArray;
        if (scoresArray?.length) {
            meanScoreAll = arrayMean(scoresArray)
            scoreAboveMeanArray = scoresArray.filter((score) => score >= meanScoreAll)
        }
        if (scoreAboveMeanArray?.length) {
            meanScoreAbove = arrayMean(scoreAboveMeanArray)
        }
        // Update List
        recommendedAnimeListEntries.forEach((anime) => {
            let animeID = anime.id
            if (animeID !== null && animeID !== undefined) {
                anime.meanScoreAll = meanScoreAll >= 1 ? meanScoreAll : 1;
                anime.meanScoreAbove = meanScoreAbove >= 1 ? meanScoreAbove : 1;
                recommendedAnimeList[animeID] = anime
            }
        })
    }
    // Save Processed Recommendation List and other Data
    await saveJSON(userEntries, 'userEntries')
    await saveJSON(animeFranchises, 'animeFranchises')
    await saveJSON(filters, 'filters')
    await saveJSON(activeTagFilters, 'activeTagFilters')
    await saveJSON(Object.values(recommendedAnimeList), 'recommendedAnimeList')
    self.postMessage({ status: null })
    self.postMessage({ message: 'success' })
}
function formatCustomString(str) {
    if (typeof str === 'string') {
        str = str !== "_" ? str.replace(/\_/g, ' ') : str
        str = str !== '\\"' ? str.replace(/\\"/g, '"') : str
        str = str.replace(/\b(tv|ona|ova)\b/gi, (match) => match.toUpperCase());
    }
    return str
}
function jsonIsEmpty(obj) {
    for (const key in obj) {
        return false;
    }
    return true;
}
function equalsNCS(str1, str2) {
    let s1 = str1
    let s2 = str2
    if (typeof s1 === "number") s1 = s1.toString()
    if (typeof s2 === "number") s2 = s2.toString()
    if (typeof s1 === "string") s1 = s1.trim().toLowerCase()
    if (typeof s2 === "string") s2 = s2.trim().toLowerCase()
    return s1 === s2
}
function isaN(num) {
    if (!num && num !== 0) { return false }
    else if (typeof num === 'boolean') { return false }
    else if (typeof num === 'string' && !num) { return false }
    return !isNaN(num)
}
function isJson(j) {
    try { return (j?.constructor.name === 'Object' && `${j}` === '[object Object]') }
    catch (e) { return false }
}
function mapValue(originalValue, lowestValue, highestValue, newLowestRange, newHighestRange) {
    var mappedValue = ((originalValue - lowestValue) * (newHighestRange - newLowestRange) / (highestValue - lowestValue)) + newLowestRange;
    return mappedValue;
}

function arrayMean(obj) {
    return (arraySum(obj) / obj.length) || 0
}
function arraySum(obj) {
    return obj.reduce((a, b) => a + b, 0)
}
function arrayMedian(arr) {
    const sortedArr = arr.slice().sort((a, b) => a - b);
    const n = sortedArr.length;
    if (n % 2 === 0) {
        const middleRight = n / 2;
        const middleLeft = middleRight - 1;
        return (sortedArr[middleLeft] + sortedArr[middleRight]) / 2;
    } else {
        const middle = Math.floor(n / 2);
        return sortedArr[middle];
    }
}

function arrayMode(obj) {
    if (obj.length === 0) { return }
    else if (obj.length === 1) { return obj[0] }
    else if (obj.length === 2) { return (obj[0] + obj[1]) / 2 }
    let max = parseFloat(Math.max(...obj))
    let min = parseFloat(Math.min(...obj))
    const boundary = 1 - 6e-17 !== 1 ? 6e-17 : 1e-16 // Min Value Javascript
    let classW = parseFloat(((max - min) / (1.0 + (3.322 * Math.log(obj.length)))))
    let classIs = []
    if (max === min || classW < boundary) { // To avoid Inf loop if classWidth is very small
        classIs = [{ low: min, high: max, freq: 0 }]
    } else {
        let high = min + classW - boundary, low = min
        classIs = [{ low: low, high: high, freq: 0 }]
        while (classIs.slice(-1)[0].high < max) {
            low = high + boundary
            high = low + classW - boundary
            classIs.push({ low: low, high: high, freq: 0 })
        }
    }
    for (let i = 0; i < obj.length; i++) {
        for (let j = 0; j < classIs.length; j++) {
            let num = obj[i]
            if (num >= classIs[j].low && num <= classIs[j].high) {
                ++classIs[j].freq
                continue
            }
        }
    }
    let modeClass = classIs[0]
    let modeIdx = 0
    for (let i = 1; i < classIs.length; i++) {
        if (classIs[i].freq > modeClass.freq) {
            modeClass = classIs[i]
            modeIdx = i
        }
    }
    let modLowLim = modeClass.low
    let modFreq = modeClass.freq
    let modPreFreq = !classIs[modeIdx - 1] ? 0 : classIs[modeIdx - 1].freq
    let modSucFreq = !classIs[modeIdx + 1] ? 0 : classIs[modeIdx + 1].freq
    return modLowLim + (((modFreq - modPreFreq) / ((2 * modFreq) - modPreFreq - modSucFreq)) * classW)
}
function arrayProbability(obj) {
    if (!obj?.length) return 0;
    return obj.reduce((a, b) => a * b, 1);
}
function filterArrayByMeanPercentages(numbers) {
    const counts = {};
    numbers.forEach((num) => {
        counts[num] = counts[num] ? counts[num] + 1 : 1;
    });
    const percentages = {};
    const totalCount = numbers.length;
    Object.keys(counts).forEach((key) => {
        percentages[key] = (counts[key] / totalCount) * 100;
    });
    const meanPercentage =
        Object.values(percentages).reduce((sum, val) => sum + val, 0) /
        Object.keys(percentages).length;
    const filteredArray = numbers.filter((num) => {
        return percentages[num] < meanPercentage;
    });
    return filteredArray;
}

function linearRegression(XY) {
    let lr = {};
    let n = XY.length;
    let sum_x = 0;
    let sum_y = 0;
    let sum_xy = 0;
    let sum_xx = 0;
    let sum_yy = 0;
    for (let i = 0; i < XY.length; i++) {
        sum_x += XY[i][0];
        sum_y += XY[i][1];
        sum_xy += (XY[i][0] * XY[i][1]);
        sum_xx += (XY[i][0] * XY[i][0]);
        sum_yy += (XY[i][1] * XY[i][1]);
    }
    lr['slope'] = (n * sum_xy - sum_x * sum_y) / (n * sum_xx - sum_x * sum_x);
    lr['intercept'] = (sum_y - lr.slope * sum_x) / n;
    lr['r2'] = Math.pow((n * sum_xy - sum_x * sum_y) / Math.sqrt((n * sum_xx - sum_x * sum_x) * (n * sum_yy - sum_y * sum_y)), 2);
    return lr;
}
function LRpredict(modelObj, x) {
    if (!modelObj) return null;
    if (!modelObj.slope || !modelObj.intercept) return null;
    if (isNaN(modelObj.slope) || isNaN(modelObj.intercept)) return null;
    return parseFloat(modelObj.slope) * x + parseFloat(modelObj.intercept);
}
function LRpredictInverse(modelObj, y) {
    if (!modelObj) return null;
    if (!modelObj.slope || !modelObj.intercept) return null;
    if (isNaN(modelObj.slope) || isNaN(modelObj.intercept)) return null;
    if (parseFloat(modelObj.slope) === 0) return null;
    return (parseFloat(y) - parseFloat(modelObj.intercept)) / parseFloat(modelObj.slope);
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