// Copyright 2024 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const toggleBtn = document.getElementById('toggle-btn');
const statusEl = document.getElementById('status');
const countsEl = document.getElementById('counts');

const TYPE_KEYS = ['text', 'number', 'textarea', 'select', 'contenteditable'];

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Queries the current state from the page without toggling anything.
async function queryCurrentState(tabId) {
  const DATA_ATTR = 'data-input-analyzer-type';
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (attr) => {
      const highlighted = document.querySelectorAll(`[${attr}]`);
      const counts = {
        text: 0,
        number: 0,
        textarea: 0,
        select: 0,
        contenteditable: 0
      };
      highlighted.forEach((el) => {
        const type = el.getAttribute(attr);
        if (type in counts) counts[type]++;
      });
      return {
        active: window.__inputAnalyzerActive || false,
        count: highlighted.length,
        counts
      };
    },
    args: [DATA_ATTR]
  });
  return result.result;
}

function updateUI({ active, count, counts }) {
  if (active) {
    toggleBtn.textContent = 'Remove Highlights';
    toggleBtn.classList.add('active');
    const plural = count !== 1 ? 's' : '';
    statusEl.textContent = `Found ${count} input field${plural}`;

    countsEl.hidden = false;
    TYPE_KEYS.forEach((key) => {
      const row = document.getElementById(`row-${key}`);
      const num = document.getElementById(`cnt-${key}`);
      const n = counts[key] || 0;
      row.hidden = n === 0;
      num.textContent = n;
    });
  } else {
    toggleBtn.textContent = 'Highlight Input Fields';
    toggleBtn.classList.remove('active');
    statusEl.textContent = 'Click to highlight all input fields';
    countsEl.hidden = true;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const tab = await getActiveTab();

  // Show initial state (highlights may already be active from a previous click).
  const initialState = await queryCurrentState(tab.id);
  updateUI(initialState);

  toggleBtn.addEventListener('click', async () => {
    toggleBtn.disabled = true;
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    toggleBtn.disabled = false;
    updateUI(result.result);
  });
});
