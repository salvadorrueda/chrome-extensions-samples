// When the user clicks the extension icon, open the UI in a new tab and pass
// the source tab ID so the UI can inject scripts into the right page.
chrome.action.onClicked.addListener((tab) => {
  const url = chrome.runtime.getURL(`ui.html?sourceTabId=${tab.id}`);
  chrome.tabs.create({ url });
});
