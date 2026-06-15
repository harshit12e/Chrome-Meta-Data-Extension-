const tabStats = new Map();

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "proxy-authorization"
]);

function getTabStats(tabId) {
  if (!tabStats.has(tabId)) {
    tabStats.set(tabId, {
      requests: [],
      domains: {},
      headers: {},
      firstPartyRequests: 0,
      thirdPartyRequests: 0,
      lastUpdated: Date.now()
    });
  }

  return tabStats.get(tabId);
}

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function baseDomain(hostname) {
  const parts = hostname.split(".").filter(Boolean);
  return parts.slice(-2).join(".");
}

function isThirdParty(requestUrl, initiator) {
  const requestHost = hostnameFromUrl(requestUrl);
  const initiatorHost = initiator ? hostnameFromUrl(initiator) : "";

  if (!requestHost || !initiatorHost) {
    return false;
  }

  return baseDomain(requestHost) !== baseDomain(initiatorHost);
}

function summarizeHeaders(headers = []) {
  const summary = {};

  for (const header of headers) {
    const name = header.name.toLowerCase();
    if (SENSITIVE_HEADERS.has(name)) {
      summary[name] = "[redacted]";
      continue;
    }

    if ([
      "accept",
      "accept-language",
      "content-type",
      "dnt",
      "referer",
      "sec-ch-ua",
      "sec-ch-ua-mobile",
      "sec-ch-ua-platform",
      "user-agent"
    ].includes(name)) {
      summary[name] = header.value || "";
    }
  }

  return summary;
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) {
      return;
    }

    const stats = getTabStats(details.tabId);
    const host = hostnameFromUrl(details.url);
    const thirdParty = isThirdParty(details.url, details.initiator);

    stats.domains[host] = (stats.domains[host] || 0) + 1;
    stats.lastUpdated = Date.now();

    if (thirdParty) {
      stats.thirdPartyRequests += 1;
    } else {
      stats.firstPartyRequests += 1;
    }

    stats.requests.unshift({
      url: details.url,
      host,
      method: details.method,
      type: details.type,
      thirdParty,
      time: Date.now()
    });

    stats.requests = stats.requests.slice(0, 80);
  },
  { urls: ["<all_urls>"] }
);

chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (details.tabId < 0) {
      return;
    }

    const stats = getTabStats(details.tabId);
    const host = hostnameFromUrl(details.url);
    const headers = summarizeHeaders(details.requestHeaders);

    if (Object.keys(headers).length) {
      stats.headers[host] = {
        ...stats.headers[host],
        ...headers
      };
    }

    stats.lastUpdated = Date.now();
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders"]
);

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStats.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    tabStats.delete(tabId);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "getNetworkStats") {
    sendResponse(getTabStats(message.tabId));
    return true;
  }

  if (message.type === "getCookies") {
    chrome.cookies.getAll({ url: message.url }, (cookies) => {
      sendResponse({
        cookies: cookies.map((cookie) => ({
          name: cookie.name,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite,
          session: cookie.session,
          expirationDate: cookie.expirationDate || null
        }))
      });
    });
    return true;
  }

  return false;
});
