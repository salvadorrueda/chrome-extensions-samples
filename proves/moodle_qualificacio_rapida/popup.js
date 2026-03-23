const INPUT_TYPE_KEYS = [
  'text',
  'number',
  'textarea',
  'select',
  'contenteditable'
];

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab || !tab.id) {
    throw new Error("No s'ha pogut obtenir la pestanya activa.");
  }

  return tab;
}

async function queryInputAnalyzerState(tabId) {
  const DATA_ATTR = 'data-input-analyzer-type';

  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: (attr) => {
      function compactText(text) {
        return (text || '').replace(/\s+/g, ' ').trim();
      }

      function getDomPath(element) {
        const segments = [];
        let current = element;

        while (current && current.nodeType === Node.ELEMENT_NODE) {
          const tagName = current.tagName.toLowerCase();
          let segment = tagName;

          if (current.id) {
            segment += `#${current.id}`;
            segments.unshift(segment);
            break;
          }

          let index = 1;
          let sibling = current.previousElementSibling;

          while (sibling) {
            if (sibling.tagName === current.tagName) {
              index += 1;
            }
            sibling = sibling.previousElementSibling;
          }

          segment += `:nth-of-type(${index})`;
          segments.unshift(segment);
          current = current.parentElement;
        }

        return segments.join(' > ');
      }

      function describeInput(el, type) {
        const labelEl = el.labels && el.labels.length > 0 ? el.labels[0] : null;
        const labelText = labelEl
          ? compactText(labelEl.innerText || labelEl.textContent)
          : '';
        const text = compactText(el.innerText || el.textContent || '');

        return {
          kind: type,
          tag: el.tagName.toLowerCase(),
          inputType: el.getAttribute('type') || '',
          id: el.getAttribute('id') || '',
          class: el.getAttribute('class') || '',
          name: (el.getAttribute('name') || '').substring(0, 120),
          ariaLabel: (el.getAttribute('aria-label') || '').substring(0, 120),
          placeholder: (el.getAttribute('placeholder') || '').substring(0, 120),
          value: compactText(
            el.value || el.getAttribute('value') || ''
          ).substring(0, 120),
          label: labelText.substring(0, 120),
          text: text.substring(0, 120),
          domPath: getDomPath(el),
          frameUrl: window.location.href
        };
      }

      const highlighted = document.querySelectorAll(`[${attr}]`);
      const counts = {
        text: 0,
        number: 0,
        textarea: 0,
        select: 0,
        contenteditable: 0
      };
      const elements = [];

      highlighted.forEach((el) => {
        const type = el.getAttribute(attr);
        if (type in counts) {
          counts[type] += 1;
          elements.push(describeInput(el, type));
        }
      });

      return {
        active: window.__inputAnalyzerActive || false,
        count: highlighted.length,
        counts,
        elements
      };
    },
    args: [DATA_ATTR]
  });

  return aggregateInputAnalyzerResults(results);
}

function aggregateInputAnalyzerResults(results) {
  const totals = {
    text: 0,
    number: 0,
    textarea: 0,
    select: 0,
    contenteditable: 0
  };

  let active = false;
  let count = 0;
  const aggregatedElements = [];
  const seenKeys = new Set();

  results.forEach((entry) => {
    const result = entry?.result || entry;

    if (!result) {
      return;
    }

    const frameId = typeof entry?.frameId === 'number' ? entry.frameId : 0;
    active = active || Boolean(result.active);
    count += result.count || 0;

    INPUT_TYPE_KEYS.forEach((key) => {
      totals[key] += result.counts?.[key] || 0;
    });

    (result.elements || []).forEach((element) => {
      const normalizedElement = {
        ...element,
        frameId
      };
      const uniqueKey = [
        frameId,
        normalizedElement.kind,
        normalizedElement.tag,
        normalizedElement.inputType,
        normalizedElement.id,
        normalizedElement.name,
        normalizedElement.placeholder,
        normalizedElement.ariaLabel,
        normalizedElement.value,
        normalizedElement.label,
        normalizedElement.text,
        normalizedElement.domPath,
        normalizedElement.frameUrl
      ].join('|');

      if (!seenKeys.has(uniqueKey)) {
        seenKeys.add(uniqueKey);
        aggregatedElements.push(normalizedElement);
      }
    });
  });

  return { active, count, counts: totals, elements: aggregatedElements };
}

function renderInputElementsList(elements) {
  const inputResultsEl = document.getElementById('input-results');
  const inputCountEl = document.getElementById('input-element-count');
  const inputListEl = document.getElementById('input-elements-list');
  const inputValuesTextarea = document.getElementById('input-values-textarea');

  function getInputIdentifier(element) {
    if (element.id) {
      return `#${element.id}`;
    }

    if (element.name) {
      return `[name="${element.name}"]`;
    }

    if (element.domPath) {
      return element.domPath;
    }

    return element.tag || 'input';
  }

  function getInputLineValue(element) {
    return `${getInputIdentifier(element)}: ${element.value || element.text || ''}`;
  }

  if (!elements || elements.length === 0) {
    inputResultsEl.hidden = true;
    inputListEl.innerHTML = '';
    inputCountEl.textContent = '';
    inputValuesTextarea.value = '';
    return;
  }

  inputResultsEl.hidden = false;
  inputCountEl.textContent = `Total: ${elements.length} input field(s)`;
  inputListEl.innerHTML = '';
  inputValuesTextarea.value = elements.map(getInputLineValue).join('\n');

  elements.forEach((el) => {
    const itemEl = document.createElement('div');
    itemEl.className = 'element-item';

    let content = `<span class="element-tag">&lt;${escapeHtml(el.tag)}&gt;</span>`;
    content += `<span class="element-property"><span class="property-label">CATEGORY:</span> ${escapeHtml(el.kind || 'text')}</span>`;

    if (el.inputType) {
      content += `<span class="element-property"><span class="property-label">TYPE:</span> ${escapeHtml(el.inputType)}</span>`;
    }

    const mainText = el.label || el.placeholder || el.ariaLabel || el.text;
    if (mainText) {
      content += `<div class="element-text">${escapeHtml(mainText)}</div>`;
    }

    const properties = [];
    if (el.id)
      properties.push(
        `<span class="element-property"><span class="property-label">ID:</span> ${escapeHtml(el.id)}</span>`
      );
    if (el.name)
      properties.push(
        `<span class="element-property"><span class="property-label">NAME:</span> ${escapeHtml(el.name)}</span>`
      );
    if (el.value)
      properties.push(
        `<span class="element-property"><span class="property-label">VALUE:</span> ${escapeHtml(el.value)}</span>`
      );
    if (el.domPath)
      properties.push(
        `<span class="element-property"><span class="property-label">PATH:</span> ${escapeHtml(el.domPath.substring(0, 60))}</span>`
      );
    if (el.frameUrl)
      properties.push(
        `<span class="element-property"><span class="property-label">FRAME:</span> ${escapeHtml(el.frameUrl.substring(0, 60))}</span>`
      );

    if (properties.length > 0) {
      content += `<div class="element-properties">${properties.join('')}</div>`;
    }

    itemEl.innerHTML = content;
    inputListEl.appendChild(itemEl);
  });
}

function updateInputAnalyzerUi({ active, count, counts, elements }) {
  const toggleBtn = document.getElementById('toggle-input-btn');
  const statusEl = document.getElementById('input-status');
  const countsEl = document.getElementById('input-counts');
  const applyBtn = document.getElementById('apply-input-values-btn');

  if (active) {
    toggleBtn.textContent = 'Remove Highlights';
    toggleBtn.classList.add('active');

    const plural = count === 1 ? '' : 's';
    statusEl.textContent = `Found ${count} input field${plural}`;
    countsEl.hidden = false;

    INPUT_TYPE_KEYS.forEach((key) => {
      const row = document.getElementById(`row-${key}`);
      const num = document.getElementById(`cnt-${key}`);
      const total = counts[key] || 0;

      row.hidden = total === 0;
      num.textContent = total;
    });

    renderInputElementsList(elements || []);
    applyBtn.hidden = false;

    return;
  }

  toggleBtn.textContent = 'Highlight Input Fields';
  toggleBtn.classList.remove('active');
  statusEl.textContent = "Clica per ressaltar camps d'entrada";
  countsEl.hidden = true;
  applyBtn.hidden = true;
  renderInputElementsList([]);
}

function parseTextareaInputValues(textareaValue, elements) {
  const lines = textareaValue.split('\n');

  return elements.map((element, index) => {
    const rawLine = lines[index] || '';
    const separatorIndex = rawLine.indexOf(': ');
    const newValue =
      separatorIndex >= 0 ? rawLine.slice(separatorIndex + 2) : rawLine;

    return {
      ...element,
      value: newValue,
      text: newValue
    };
  });
}

async function applyInputValuesToPage(tabId, elements) {
  const elementsByFrame = new Map();

  elements.forEach((element) => {
    if (!elementsByFrame.has(element.frameId)) {
      elementsByFrame.set(element.frameId, []);
    }

    elementsByFrame.get(element.frameId).push(element);
  });

  await Promise.all(
    Array.from(elementsByFrame.entries()).map(([frameId, frameElements]) => {
      return chrome.scripting.executeScript({
        target: { tabId, frameIds: [frameId] },
        func: (descriptors) => {
          function getElementByDomPath(path) {
            if (!path) {
              return null;
            }

            try {
              return document.querySelector(path);
            } catch (_error) {
              return null;
            }
          }

          function findMatchingInput(descriptor) {
            const candidates = Array.from(
              document.querySelectorAll(
                'input, textarea, select, [contenteditable=""], [contenteditable="true"]'
              )
            );

            return (
              getElementByDomPath(descriptor.domPath) ||
              candidates.find((candidate) => {
                return (
                  candidate.tagName.toLowerCase() === descriptor.tag &&
                  (candidate.getAttribute('id') || '') ===
                    (descriptor.id || '') &&
                  (candidate.getAttribute('name') || '') ===
                    (descriptor.name || '') &&
                  (candidate.getAttribute('type') || '') ===
                    (descriptor.inputType || '')
                );
              }) ||
              null
            );
          }

          function updateElementValue(element, value) {
            if (
              element.isContentEditable &&
              element.tagName !== 'INPUT' &&
              element.tagName !== 'TEXTAREA' &&
              element.tagName !== 'SELECT'
            ) {
              element.textContent = value;
            } else if (element.tagName === 'SELECT') {
              const option = Array.from(element.options).find((item) => {
                return item.value === value || item.text === value;
              });

              if (option) {
                element.value = option.value;
              } else {
                element.value = value;
              }
            } else {
              element.value = value;
            }

            element.dispatchEvent(
              new Event('input', { bubbles: true, cancelable: true })
            );
            element.dispatchEvent(
              new Event('change', { bubbles: true, cancelable: true })
            );
          }

          return descriptors.map((descriptor) => {
            const target = findMatchingInput(descriptor);

            if (!target) {
              return {
                success: false,
                identifier:
                  descriptor.id ||
                  descriptor.name ||
                  descriptor.domPath ||
                  descriptor.tag
              };
            }

            updateElementValue(target, descriptor.value || '');
            return { success: true };
          });
        },
        args: [frameElements]
      });
    })
  );
}

async function initInputAnalyzer() {
  const toggleBtn = document.getElementById('toggle-input-btn');
  const applyBtn = document.getElementById('apply-input-values-btn');
  const inputValuesTextarea = document.getElementById('input-values-textarea');
  const statusEl = document.getElementById('input-status');
  const tab = await getActiveTab();

  let currentState = await queryInputAnalyzerState(tab.id);
  updateInputAnalyzerUi(currentState);

  toggleBtn.addEventListener('click', async () => {
    toggleBtn.disabled = true;

    try {
      const mode = currentState.active ? 'remove' : 'add';

      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: (inputMode) => {
          window.__inputAnalyzerMode = inputMode;
        },
        args: [mode]
      });

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['content.js']
      });

      currentState = aggregateInputAnalyzerResults(results);

      updateInputAnalyzerUi(currentState);
    } finally {
      toggleBtn.disabled = false;
    }
  });

  applyBtn.addEventListener('click', async () => {
    if (!currentState.active || !currentState.elements?.length) {
      return;
    }

    applyBtn.disabled = true;

    try {
      const updatedElements = parseTextareaInputValues(
        inputValuesTextarea.value,
        currentState.elements
      );

      await applyInputValuesToPage(tab.id, updatedElements);
      currentState = {
        ...currentState,
        elements: updatedElements
      };
      statusEl.textContent = `Actualitzats ${updatedElements.length} input field(s)`;
      renderInputElementsList(updatedElements);
    } finally {
      applyBtn.disabled = false;
    }
  });
}

// Funció per escapar HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  initInputAnalyzer().catch((error) => {
    const statusEl = document.getElementById('input-status');
    statusEl.textContent = `Error: ${error.message}`;
  });
});
