const observedApiCalls = [];

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== "metadata-watch") {
    return;
  }

  observedApiCalls.unshift({
    name: event.data.name,
    detail: event.data.detail || "",
    time: Date.now()
  });

  observedApiCalls.splice(40);
});

function collectNavigatorMetadata() {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: navigator.languages || [],
    platform: navigator.platform,
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack || "unspecified",
    hardwareConcurrency: navigator.hardwareConcurrency || "unknown",
    deviceMemory: navigator.deviceMemory || "unknown",
    maxTouchPoints: navigator.maxTouchPoints || 0,
    webdriver: navigator.webdriver || false,
    online: navigator.onLine,
    vendor: navigator.vendor || "unknown"
  };
}

function collectScreenMetadata() {
  return {
    width: screen.width,
    height: screen.height,
    availableWidth: screen.availWidth,
    availableHeight: screen.availHeight,
    colorDepth: screen.colorDepth,
    pixelDepth: screen.pixelDepth,
    devicePixelRatio: window.devicePixelRatio,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
}

function collectPageMetadata() {
  return {
    title: document.title,
    url: location.href,
    referrer: document.referrer || "",
    canonical: document.querySelector("link[rel='canonical']")?.href || "",
    metaTags: [...document.querySelectorAll("meta")]
      .map((tag) => ({
        name: tag.getAttribute("name") || tag.getAttribute("property") || tag.getAttribute("http-equiv") || "",
        value: tag.getAttribute("content") || ""
      }))
      .filter((tag) => tag.name || tag.value)
      .slice(0, 60)
  };
}

function collectForms() {
  return [...document.forms].map((form, index) => ({
    index,
    action: form.action || location.href,
    method: (form.method || "get").toUpperCase(),
    fields: [...form.elements]
      .filter((element) => element.name || element.id || element.type)
      .map((element) => ({
        name: element.name || element.id || "(unnamed)",
        type: element.type || element.tagName.toLowerCase(),
        autocomplete: element.getAttribute("autocomplete") || ""
      }))
  }));
}

function storageKeys(storage) {
  try {
    return Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(Boolean);
  } catch {
    return [];
  }
}

function collectStorage() {
  return {
    localStorageKeys: storageKeys(localStorage),
    sessionStorageKeys: storageKeys(sessionStorage)
  };
}

function collectScripts() {
  return [...document.scripts]
    .map((script) => script.src)
    .filter(Boolean)
    .map((src) => {
      try {
        return new URL(src).hostname;
      } catch {
        return src;
      }
    })
    .reduce((domains, host) => {
      domains[host] = (domains[host] || 0) + 1;
      return domains;
    }, {});
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "getPageSnapshot") {
    return false;
  }

  sendResponse({
    navigator: collectNavigatorMetadata(),
    screen: collectScreenMetadata(),
    page: collectPageMetadata(),
    forms: collectForms(),
    storage: collectStorage(),
    scripts: collectScripts(),
    apiCalls: observedApiCalls
  });

  return true;
});
