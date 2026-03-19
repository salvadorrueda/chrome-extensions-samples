# Input Fields Analyzer

Highlights and analyzes all text boxes and interactive input elements on any web page.

## Overview

This extension uses the [`chrome.scripting`](https://developer.chrome.com/docs/extensions/reference/api/scripting) and [`activeTab`](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) APIs to inject a content script that scans the active page for input elements and highlights them with colored outlines.

Each input type gets a distinct color:

| Color            | Element types                                                      |
| ---------------- | ------------------------------------------------------------------ |
| Blue `#4285f4`   | `<input>` — text, email, password, URL, search, tel                |
| Green `#34a853`  | `<input>` — number, range, date, time, datetime-local, month, week |
| Purple `#9c27b0` | `<textarea>`                                                       |
| Orange `#ff9800` | `<select>`                                                         |
| Red `#ea4335`    | Elements with `contenteditable`                                    |

The popup shows a breakdown by type and a **toggle button** to show or remove the highlights without reloading the page.

## Running this extension

1. Clone this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `functional-samples/cookbook.input-fields-analyzer` directory.
5. Navigate to any web page (e.g. a login form, a checkout page, or Google's homepage).
6. Click the extension icon in the toolbar.
7. Click **Highlight Input Fields** to highlight all input elements on the page.
8. Click **Remove Highlights** to clear the outlines.
