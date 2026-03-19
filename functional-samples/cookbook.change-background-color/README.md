# Change Background Color

## Overview

This extension adds a popup with a color palette that changes the background color of the active tab's page. It demonstrates use of the [`activeTab`](https://developer.chrome.com/docs/extensions/reference/permissions-list/#activeTab) permission and the [`scripting`](https://developer.chrome.com/docs/extensions/reference/api/scripting) API to inject code into a page without a persistent content script.

## Implementation Notes

- Uses `chrome.scripting.executeScript` to apply `document.body.style.backgroundColor` on the active tab.
- No content script is declared in the manifest; the script is injected on demand via the popup.
- The "Restablir original" (Reset) button removes the inline style, restoring the page's original background.
- A native `<input type="color">` picker lets users pick any custom color.

## Running this extension

1. Clone this repository or download the source.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select this folder (`cookbook.change-background-color/`).
5. Click the extension icon in the toolbar to open the color picker popup.
6. Click any color swatch or choose a custom color and click **Aplicar color**.
