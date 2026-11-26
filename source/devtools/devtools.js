/**
 * PhotoShow developer tools page.
 * Registers the inspected tab with the background page so developer-mode
 * behaviors can be enabled for it (port name: DEVTOOLS_PAGE_<tabId>).
 */
chrome.runtime.connect({ name: `DEVTOOLS_PAGE_${chrome.devtools.inspectedWindow.tabId}` });
