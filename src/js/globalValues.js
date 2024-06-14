import { writable } from "svelte/store";
import { getLocalStorage } from "../js/others/helper.js"

const appID = writable(null)
const android = writable(null)
const uniqueKey = "Kanshi.Anime.Recommendations.Anilist.W~uPtWCq=vG$TR:Zl^#t<vdS]I~N70"
const isBackgroundUpdateKey = writable(uniqueKey + ".isBackgroundUpdate")
const visitedKey = writable(uniqueKey + ".visited")
const mobile = writable(null)
const appInstallationAsked = writable(getLocalStorage('appInstallationAsked') ?? null)
const inApp = writable(true)
const progress = writable(0)
// const anilistAccessToken = writable(null)
const hasWheel = writable(false)

const username = writable(getLocalStorage('username') || '')
const loadedAnimeLists = writable({})
const aniLoaderWorker = writable(null)
const loadNewAnime = writable({})
const searchedWord = writable("")
const categories = writable(null)
const categoriesKeys = writable(null)
const selectedCategory = writable(null)
const orderedFilters = writable(null)
const nonOrderedFilters = writable(null)
const filterConfig = writable(null)
const animeCautions = writable(null)
const algorithmFilters = writable(null)
const selectedAnimeGridEl = writable(null)
const hiddenEntries = writable(null)

const tagInfo = writable({})
const dataStatus = writable(null)
const loadingDataStatus = writable(null)

const showLoadingAnime = writable(false)
const isLoadingAnime = writable(false)
const isProcessingList = writable(false)
const userRequestIsRunning = writable(null)
const autoUpdate = writable(getLocalStorage('autoUpdate') ?? null)
const autoUpdateInterval = writable(null)
const runnedAutoUpdateAt = writable(null)

const exportPathIsAvailable = writable(getLocalStorage('exportPathIsAvailable') ?? null)
const autoExport = writable(getLocalStorage('autoExport') ?? null)
const autoExportInterval = writable(null)
const runnedAutoExportAt = writable(null)

const ytPlayers = writable([])
const autoPlay = writable(getLocalStorage('autoPlay') ?? null)

const initData = writable(true)
const gridFullView = writable(getLocalStorage('gridFullView') ?? null)
const showStatus = writable(getLocalStorage('showStatus') ?? true)
const extraInfo = writable(null)
const currentExtraInfo = writable(null)
const mostRecentAiringDateTimeout = writable(null)
const earlisetReleaseDate = writable(null)
const animeIdxRemoved = writable(null)
const shownAllInList = writable({})
const confirmPromise = writable(null)
const menuVisible = writable(false)
const animeOptionVisible = writable(false)
const openedAnimeOptionIdx = writable(null)
const popupVisible = writable(false)
const openedAnimePopupIdx = writable(null)
const shouldGoBack = writable(true)
const listUpdateAvailable = writable(false)
const popupIsGoingBack = writable(false)
const isScrolling = writable(null)
const scrollingTimeout = writable(null)
const showFilterOptions = writable(getLocalStorage('showFilterOptions') ?? null)
const dropdownIsVisible = writable(null)
const confirmIsVisible = writable(null)
const keepAppRunningInBackground = writable(null)
// Reactive Functions
const runUpdate = writable(null)
const runExport = writable(null)
const importantUpdate = writable(null)
const importantLoad = writable(null)
const updateRecommendationList = writable(null)
const loadAnime = writable(null)
const runIsScrolling = writable(null)

export {
    appID,
    mobile,
    android,
    isBackgroundUpdateKey,
    visitedKey,
    inApp,
    appInstallationAsked,
    hasWheel,
    progress,
    // anilistAccessToken,
    username,
    loadedAnimeLists,
    aniLoaderWorker,
    loadNewAnime,
    searchedWord,
    categories,
    categoriesKeys,
    selectedCategory,
    orderedFilters,
    nonOrderedFilters,
    filterConfig,
    animeCautions,
    algorithmFilters,
    selectedAnimeGridEl,
    hiddenEntries,
    tagInfo,
    dataStatus,
    loadingDataStatus,
    userRequestIsRunning,
    showLoadingAnime,
    isLoadingAnime,
    isProcessingList,
    autoUpdate,
    autoUpdateInterval,
    runnedAutoUpdateAt,
    exportPathIsAvailable,
    autoExport,
    autoExportInterval,
    runnedAutoExportAt,
    ytPlayers,
    autoPlay,
    initData,
    gridFullView,
    showStatus,
    extraInfo,
    currentExtraInfo,
    mostRecentAiringDateTimeout,
    earlisetReleaseDate,
    shownAllInList,
    animeIdxRemoved,
    confirmPromise,
    menuVisible,
    animeOptionVisible,
    openedAnimeOptionIdx,
    popupVisible,
    openedAnimePopupIdx,
    shouldGoBack,
    listUpdateAvailable,
    popupIsGoingBack,
    isScrolling,
    scrollingTimeout,
    showFilterOptions,
    dropdownIsVisible,
    confirmIsVisible,
    keepAppRunningInBackground,
    // Reactive Functions
    runUpdate,
    runExport,
    importantLoad,
    importantUpdate,
    updateRecommendationList,
    loadAnime,
    runIsScrolling
}