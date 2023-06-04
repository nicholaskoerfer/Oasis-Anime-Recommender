const isJsonObject = (obj) => {
  return Object.prototype.toString.call(obj) === "[object Object]"
}

const jsonIsEmpty = (obj) => {
  for (const key in obj) {
    return false;
  }
  return true;
}

function msToTime(duration) {
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
  } catch (e) {
    return
  }
}

function getMostVisibleElement(parent, childSelector, intersectionRatioThreshold = 0.5) {
  try {
    if (typeof parent === "string") parent = document.querySelector(parentSelector);
    var childElements = parent.querySelectorAll(childSelector);
    var mostVisibleElement = null;
    var highestVisibleRatio = 0;
    childElements.forEach((childElement) => {
      var parentRect = parent.getBoundingClientRect();
      var childRect = childElement.getBoundingClientRect();
      var intersectionHeight = Math.min(childRect.bottom, parentRect.bottom) - Math.max(childRect.top, parentRect.top);
      var intersectionRatio = intersectionHeight / childRect.height;
      if (intersectionRatio >= intersectionRatioThreshold && intersectionRatio > highestVisibleRatio) {
        highestVisibleRatio = intersectionRatio;
        mostVisibleElement = childElement;
      }
    });
    return mostVisibleElement;
  } catch (ex) {
    console.error(ex)
    return
  }
}

const getChildIndex = (childElement) => {
  try {
    return Array.from(childElement.parentNode.children).indexOf(childElement);
  } catch (ex) {
    // console.error(ex)
    return
  }
}

const scrollToElement = (parent, target, position = 'top') => {
  try {
    if (typeof parent === "string") parent = document.querySelector(parent)
    if (typeof target === "string") target = document.querySelector(target)
    let scrollAmount;
    if (position === 'bottom') {
      scrollAmount = target.offsetTop + target.offsetHeight - parent.offsetHeight;
    } else {
      let targetRect = target.getBoundingClientRect();
      let parentRect = parent.getBoundingClientRect();
      scrollAmount = targetRect.top - parentRect.top + parent.scrollTop;
    }
    parent.scrollTop = scrollAmount;
  } catch (ex) {
    console.error(ex)
    return
  }
};

const scrollToElementAmount = (parent, target, position = 'top') => {
  try {
    if (typeof parent === "string") parent = document.querySelector(parent)
    if (typeof target === "string") target = document.querySelector(target)
    if (position === 'bottom') {
      return target.offsetTop + target.offsetHeight - parent.offsetHeight;
    } else {
      let targetRect = target.getBoundingClientRect();
      let parentRect = parent.getBoundingClientRect();
      return targetRect.top - parentRect.top + parent.scrollTop;
    }
  } catch (ex) {
    console.error(ex)
    return
  }
};


const makeFetchRequest = (url, options) => {
  return new Promise((resolve, reject) => {
    fetch(url, options).then(response => {
      if (!response.ok) reject(`Fetch error! Status: ${response.status}`);
      resolve(response.json());
    }).catch(err => reject(err));
  })
}

const fetchAniListData = (anilistGraphQLQuery) => {
  return new Promise(async (resolve, reject) => {
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cache-Control': 'max-age=31536000, immutable'
      },
      body: JSON.stringify({
        query: anilistGraphQLQuery
      })
    };
    await makeFetchRequest('https://graphql.anilist.co', requestOptions)
      .then(data => resolve(data))
      .catch(error => reject(error))
  })
}

function formatNumber(number, dec = 2) {
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

function ncsCompare(str1, str2) {
  if (typeof str1 !== "string" || typeof str2 !== "string") {
    return false;
  }
  return str1.toLowerCase() === str2.toLowerCase();
}

export {
  isJsonObject,
  jsonIsEmpty,
  getChildIndex,
  getMostVisibleElement,
  scrollToElement,
  scrollToElementAmount,
  makeFetchRequest,
  fetchAniListData,
  formatNumber,
  ncsCompare,
  msToTime
}