# Metadata Watch

A Chrome Manifest V3 extension that shows what metadata the current website can see, stores, requests, and sends while you browse.

<img width="358" height="538" alt="Meta Data Screenshhot" src="https://github.com/user-attachments/assets/39ca0b3b-c154-44b5-b81a-85fdf1d521f1" />



## What it can show

- Browser and device metadata exposed to websites, such as user agent, language, timezone, screen size, hardware threads, and touch support.
- Page metadata, including visible `<meta>` tags and referrer.
- Forms and field types that may collect personal data.
- Local/session storage keys.
- Cookies for the current page, with sensitive values hidden.
- Network domains contacted by the tab, third-party request counts, recent requests, and common metadata headers.
- Sensitive browser API attempts observed after the extension loads, including geolocation, camera/microphone, clipboard, notifications, and permission checks.

## Install locally

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `d:\MetaData Google Extention`.
5. Visit a website and click the Metadata Watch extension icon.

## Important limitation

No extension can perfectly prove every piece of data a website extracts. This extension reports what Chrome exposes, what the page appears structured to collect, what requests and headers are visible to the extension, and sensitive browser API calls it can observe.



