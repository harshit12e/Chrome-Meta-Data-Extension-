(function installMetadataWatchProbe() {
  if (window.__metadataWatchProbeInstalled) {
    return;
  }

  window.__metadataWatchProbeInstalled = true;

  function report(name, detail) {
    window.postMessage({
      source: "metadata-watch",
      name,
      detail
    }, "*");
  }

  function wrap(object, methodName, label, detail) {
    const original = object?.[methodName];
    if (typeof original !== "function") {
      return;
    }

    object[methodName] = function wrappedMethod(...args) {
      report(label, typeof detail === "function" ? detail(args) : detail);
      return original.apply(this, args);
    };
  }

  wrap(navigator.geolocation, "getCurrentPosition", "Geolocation requested", "Precise location");
  wrap(navigator.geolocation, "watchPosition", "Geolocation watch requested", "Precise location over time");
  wrap(navigator.mediaDevices, "getUserMedia", "Camera or microphone requested", "Media device access");
  wrap(navigator.clipboard, "readText", "Clipboard read requested", "Clipboard text");
  wrap(navigator.clipboard, "writeText", "Clipboard write requested", "Clipboard text write");

  if (navigator.permissions?.query) {
    wrap(navigator.permissions, "query", "Permission status checked", (args) => args[0]?.name || "Unknown permission");
  }

  if (window.Notification?.requestPermission) {
    const originalRequestPermission = window.Notification.requestPermission.bind(window.Notification);
    window.Notification.requestPermission = function wrappedRequestPermission(...args) {
      report("Notification permission requested", "Browser notification access");
      return originalRequestPermission(...args);
    };
  }
})();
