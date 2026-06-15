const panels = {
  summary: document.querySelector("#summary"),
  network: document.querySelector("#network"),
  device: document.querySelector("#device"),
  forms: document.querySelector("#forms")
};

document.querySelector(".tabs").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tab]");
  if (!button) {
    return;
  }

  document.querySelectorAll(".tabs button").forEach((tab) => tab.classList.remove("active"));
  document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
  button.classList.add("active");
  panels[button.dataset.tab].classList.add("active");
});

document.querySelector("#refreshButton").addEventListener("click", loadSnapshot);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function section(title, body) {
  return `<div class="section"><h2>${escapeHtml(title)}</h2>${body}</div>`;
}

function item(label, value, className = "") {
  return `<div class="item ${className}"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value || "None seen")}</span></div>`;
}

function chips(values) {
  if (!values?.length) {
    return `<div class="empty">None seen yet.</div>`;
  }

  return `<div class="chipRow">${values.map((value) => `<span class="chip">${escapeHtml(value)}</span>`).join("")}</div>`;
}

function sendToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      resolve(chrome.runtime.lastError ? null : response);
    });
  });
}

function sendRuntimeMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(chrome.runtime.lastError ? null : response);
    });
  });
}

function topEntries(object, limit = 10) {
  return Object.entries(object || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function calculateRisk(snapshot, network, cookies) {
  let score = 0;
  score += Math.min(35, (network.thirdPartyRequests || 0) * 2);
  score += Math.min(20, cookies.length * 2);
  score += Math.min(15, (snapshot.forms || []).flatMap((form) => form.fields).length);
  score += Math.min(20, (snapshot.apiCalls || []).length * 5);
  score += snapshot.storage.localStorageKeys.length || snapshot.storage.sessionStorageKeys.length ? 10 : 0;
  return Math.min(100, score);
}

function renderSummary(snapshot, network, cookies) {
  const apiCalls = snapshot.apiCalls || [];
  const storageKeys = [
    ...snapshot.storage.localStorageKeys.map((key) => `localStorage: ${key}`),
    ...snapshot.storage.sessionStorageKeys.map((key) => `sessionStorage: ${key}`)
  ];

  panels.summary.innerHTML = [
    section("What this page can read", [
      item("Browser", snapshot.navigator.userAgent),
      item("Language", snapshot.navigator.languages.join(", ")),
      item("Timezone", snapshot.screen.timezone),
      item("Screen", `${snapshot.screen.width} x ${snapshot.screen.height}, DPR ${snapshot.screen.devicePixelRatio}`),
      item("Referrer", snapshot.page.referrer || "No referrer visible")
    ].join("")),
    section("Sensitive activity observed", apiCalls.length
      ? apiCalls.map((call) => item(call.name, call.detail, "warn")).join("")
      : `<div class="empty">No sensitive API calls observed yet.</div>`),
    section("Storage keys", chips(storageKeys)),
    section("Cookies", chips(cookies.map((cookie) => `${cookie.name} (${cookie.domain})`)))
  ].join("");
}

function renderNetwork(network) {
  const domains = topEntries(network.domains, 12)
    .map(([host, count]) => item(host, `${count} request${count === 1 ? "" : "s"}`))
    .join("");

  const headers = Object.entries(network.headers || {})
    .slice(0, 8)
    .map(([host, values]) => item(host, Object.keys(values).join(", ")))
    .join("");

  const requests = (network.requests || [])
    .slice(0, 12)
    .map((request) => item(`${request.method} ${request.type}`, `${request.host}${request.thirdParty ? " - third party" : ""}`, request.thirdParty ? "warn" : ""))
    .join("");

  panels.network.innerHTML = [
    section("Request totals", [
      item("First party", network.firstPartyRequests || 0),
      item("Third party", network.thirdPartyRequests || 0, network.thirdPartyRequests ? "warn" : "")
    ].join("")),
    section("Top contacted domains", domains || `<div class="empty">No requests captured yet.</div>`),
    section("Metadata headers sent", headers || `<div class="empty">No metadata headers captured yet.</div>`),
    section("Recent requests", requests || `<div class="empty">No requests captured yet.</div>`)
  ].join("");
}

function renderDevice(snapshot) {
  panels.device.innerHTML = [
    section("Navigator", [
      item("Platform", snapshot.navigator.platform),
      item("Vendor", snapshot.navigator.vendor),
      item("Hardware threads", snapshot.navigator.hardwareConcurrency),
      item("Device memory", snapshot.navigator.deviceMemory),
      item("Touch points", snapshot.navigator.maxTouchPoints),
      item("Do Not Track", snapshot.navigator.doNotTrack),
      item("Cookies enabled", snapshot.navigator.cookieEnabled ? "Yes" : "No")
    ].join("")),
    section("Screen", [
      item("Window size", `${window.innerWidth} x ${window.innerHeight}`),
      item("Screen size", `${snapshot.screen.width} x ${snapshot.screen.height}`),
      item("Available screen", `${snapshot.screen.availableWidth} x ${snapshot.screen.availableHeight}`),
      item("Color depth", snapshot.screen.colorDepth)
    ].join("")),
    section("Page metadata", chips(snapshot.page.metaTags.map((tag) => `${tag.name}: ${tag.value}`).slice(0, 20)))
  ].join("");
}

function renderForms(snapshot) {
  if (!snapshot.forms.length) {
    panels.forms.innerHTML = section("Forms", `<div class="empty">No forms found on this page.</div>`);
    return;
  }

  panels.forms.innerHTML = snapshot.forms.map((form) => section(
    `Form ${form.index + 1}`,
    [
      item("Method", form.method),
      item("Destination", form.action),
      chips(form.fields.map((field) => `${field.name} (${field.type}${field.autocomplete ? `, ${field.autocomplete}` : ""})`))
    ].join("")
  )).join("");
}

async function loadSnapshot() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith("http")) {
    panels.summary.innerHTML = section("Unavailable", `<div class="empty">Open a normal web page to inspect its metadata surface.</div>`);
    return;
  }

  const pageHost = new URL(tab.url).hostname;
  document.querySelector("#pageHost").textContent = pageHost;

  const [snapshot, network, cookieResponse] = await Promise.all([
    sendToTab(tab.id, { type: "getPageSnapshot" }),
    sendRuntimeMessage({ type: "getNetworkStats", tabId: tab.id }),
    sendRuntimeMessage({ type: "getCookies", url: tab.url })
  ]);

  if (!snapshot) {
    panels.summary.innerHTML = section("Still loading", `<div class="empty">Refresh once the page finishes loading.</div>`);
    return;
  }

  const cookies = cookieResponse?.cookies || [];
  const riskScore = calculateRisk(snapshot, network || {}, cookies);

  document.querySelector("#riskScore").textContent = riskScore;
  document.querySelector("#riskScore").className = riskScore >= 70 ? "bad" : riskScore >= 35 ? "warn" : "";
  document.querySelector("#thirdPartyCount").textContent = network?.thirdPartyRequests || 0;
  document.querySelector("#cookieCount").textContent = cookies.length;

  renderSummary(snapshot, network || {}, cookies);
  renderNetwork(network || {});
  renderDevice(snapshot);
  renderForms(snapshot);
}

loadSnapshot();
