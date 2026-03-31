// Runs inside the page. Must be fully self-contained (no outer scope references).
function collectFormElements() {
  const SELECTOR = [
    'input:not([type="hidden"]):not([type="submit"]):not([type="reset"]):not([type="button"]):not([type="image"])',
    'textarea',
    'select',
    '[contenteditable=""]',
    '[contenteditable="true"]'
  ].join(',');

  function getDomPath(el) {
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === Node.ELEMENT_NODE) {
      const tag = cur.tagName.toLowerCase();
      if (cur.id) {
        parts.unshift(`${tag}#${cur.id}`);
        break;
      }
      let idx = 1;
      let sib = cur.previousElementSibling;
      while (sib) {
        if (sib.tagName === cur.tagName) {
          idx += 1;
        }
        sib = sib.previousElementSibling;
      }
      parts.unshift(`${tag}:nth-of-type(${idx})`);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  // Build a human-readable identifier. Must not contain ' = ' (the line separator).
  function getIdentifier(el) {
    function clean(s) {
      return (s || '')
        .replace(/\s+/g, ' ')
        .replace(/ = /g, ' - ')
        .trim()
        .substring(0, 60);
    }

    const labelEl = el.labels && el.labels.length > 0 ? el.labels[0] : null;
    if (labelEl) {
      const text = clean(labelEl.innerText || labelEl.textContent);
      if (text) {
        return text;
      }
    }

    const aria = el.getAttribute('aria-label');
    if (aria && aria.trim()) {
      return clean(aria);
    }

    const placeholder = el.getAttribute('placeholder');
    if (placeholder && placeholder.trim()) {
      return clean(placeholder);
    }

    const id = el.getAttribute('id');
    if (id) {
      return `#${id}`;
    }

    const name = el.getAttribute('name');
    if (name) {
      return `[name="${name}"]`;
    }

    return getDomPath(el).substring(0, 80);
  }

  function getValue(el) {
    const type = (el.getAttribute('type') || '').toLowerCase();

    if (type === 'checkbox' || type === 'radio') {
      return el.checked ? 'true' : 'false';
    }

    const tag = el.tagName.toUpperCase();
    const isEditable =
      el.isContentEditable &&
      tag !== 'INPUT' &&
      tag !== 'TEXTAREA' &&
      tag !== 'SELECT';

    if (isEditable) {
      return (el.textContent || '').replace(/\n/g, '\\n');
    }

    return (el.value || '').replace(/\n/g, '\\n');
  }

  const elements = [];
  document.querySelectorAll(SELECTOR).forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const inputType = (el.getAttribute('type') || '').toLowerCase();
    const isContentEditable =
      el.isContentEditable &&
      tag !== 'input' &&
      tag !== 'textarea' &&
      tag !== 'select';

    elements.push({
      tag,
      inputType,
      id: el.getAttribute('id') || '',
      name: el.getAttribute('name') || '',
      identifier: getIdentifier(el),
      value: getValue(el),
      domPath: getDomPath(el),
      isContentEditable,
      frameUrl: window.location.href
    });
  });

  return elements;
}

function aggregateResults(results) {
  const elements = [];
  results.forEach((entry) => {
    const frameId = typeof entry.frameId === 'number' ? entry.frameId : 0;
    (entry.result || []).forEach((el) => {
      elements.push({ ...el, frameId });
    });
  });
  return elements;
}

// Format: one line per element — "identifier = value"
// Newlines inside values are escaped as \n.
function formatElementsAsText(elements) {
  return elements.map((el) => `${el.identifier} = ${el.value}`).join('\n');
}

// Parse textarea back to updated element list. Matched by line index.
function parseTextValues(textareaContent, elements) {
  const lines = textareaContent.split('\n');
  return elements.map((el, i) => {
    const line = lines[i] || '';
    const sep = line.indexOf(' = ');
    const raw = sep >= 0 ? line.slice(sep + 3) : line;
    return { ...el, value: raw.replace(/\\n/g, '\n') };
  });
}

async function applyElementsToPage(tabId, elements) {
  const byFrame = new Map();
  elements.forEach((el) => {
    if (!byFrame.has(el.frameId)) {
      byFrame.set(el.frameId, []);
    }
    byFrame.get(el.frameId).push(el);
  });

  await Promise.all(
    Array.from(byFrame.entries()).map(([frameId, frameEls]) =>
      chrome.scripting.executeScript({
        target: { tabId, frameIds: [frameId] },
        func: (descriptors) => {
          function findElement(desc) {
            if (desc.domPath) {
              try {
                const el = document.querySelector(desc.domPath);
                if (el) {
                  return el;
                }
              } catch {
                // Ignore invalid selectors and fall back to heuristic matching.
              }
            }

            return (
              Array.from(
                document.querySelectorAll(
                  'input, textarea, select, [contenteditable=""], [contenteditable="true"]'
                )
              ).find((el) => {
                return (
                  el.tagName.toLowerCase() === desc.tag &&
                  (el.getAttribute('id') || '') === desc.id &&
                  (el.getAttribute('name') || '') === desc.name &&
                  (el.getAttribute('type') || '').toLowerCase() ===
                    desc.inputType
                );
              }) || null
            );
          }

          function applyValue(el, value) {
            const type = (el.getAttribute('type') || '').toLowerCase();
            const tag = el.tagName.toUpperCase();
            const isEditable =
              el.isContentEditable &&
              tag !== 'INPUT' &&
              tag !== 'TEXTAREA' &&
              tag !== 'SELECT';

            if (type === 'checkbox' || type === 'radio') {
              el.checked = value === 'true';
            } else if (isEditable) {
              el.textContent = value;
            } else if (tag === 'SELECT') {
              const opt = Array.from(el.options).find(
                (o) => o.value === value || o.text === value
              );
              el.value = opt ? opt.value : value;
            } else {
              el.value = value;
            }

            el.dispatchEvent(
              new Event('input', { bubbles: true, cancelable: true })
            );
            el.dispatchEvent(
              new Event('change', { bubbles: true, cancelable: true })
            );
          }

          descriptors.forEach((desc) => {
            const target = findElement(desc);
            if (target) {
              applyValue(target, desc.value);
            }
          });
        },
        args: [frameEls]
      })
    )
  );
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    throw new Error("No s'ha pogut obtenir la pestanya activa.");
  }
  return tab;
}

async function init() {
  const textarea = document.getElementById('form-textarea');
  const statusEl = document.getElementById('status');
  const refreshBtn = document.getElementById('refresh-btn');
  const applyBtn = document.getElementById('apply-btn');
  const errorEl = document.getElementById('error');
  const lineCountEl = document.getElementById('line-count');

  let currentElements = [];
  let currentTab = null;

  function setStatus(text, type) {
    statusEl.textContent = text;
    statusEl.className = `status${type ? ` ${type}` : ''}`;
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  function hideError() {
    errorEl.hidden = true;
  }

  function updateLineCountWarning() {
    if (!currentElements.length) {
      lineCountEl.hidden = true;
      return;
    }
    const lines = textarea.value.split('\n').length;
    if (lines !== currentElements.length) {
      lineCountEl.textContent = `⚠ ${lines} línies vs ${currentElements.length} camps — torna a escanejar si has canviat l'estructura del formulari.`;
      lineCountEl.hidden = false;
    } else {
      lineCountEl.hidden = true;
    }
  }

  async function scan() {
    hideError();
    lineCountEl.hidden = true;
    setStatus('Escanejant...', 'scanning');
    textarea.value = '';
    textarea.disabled = true;
    applyBtn.disabled = true;
    refreshBtn.disabled = true;

    try {
      currentTab = await getActiveTab();
      const results = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id, allFrames: true },
        func: collectFormElements
      });
      currentElements = aggregateResults(results);

      if (currentElements.length === 0) {
        setStatus('Cap camp de formulari trobat.');
        textarea.value = '';
      } else {
        const n = currentElements.length;
        setStatus(
          `${n} camp${n !== 1 ? 's' : ''} trobat${n !== 1 ? 's' : ''}`,
          'ok'
        );
        textarea.value = formatElementsAsText(currentElements);
        applyBtn.disabled = false;
      }
    } catch (err) {
      setStatus('Error en escanejar');
      showError(err.message);
    } finally {
      textarea.disabled = false;
      refreshBtn.disabled = false;
    }
  }

  textarea.addEventListener('input', updateLineCountWarning);

  refreshBtn.addEventListener('click', scan);

  applyBtn.addEventListener('click', async () => {
    if (!currentElements.length || !currentTab) {
      return;
    }

    hideError();

    const lines = textarea.value.split('\n');
    if (lines.length !== currentElements.length) {
      showError(
        `El nombre de línies (${lines.length}) no coincideix amb els camps (${currentElements.length}). ` +
          `Fes clic a Actualitzar per tornar a escanejar.`
      );
      return;
    }

    applyBtn.disabled = true;
    refreshBtn.disabled = true;

    try {
      const updated = parseTextValues(textarea.value, currentElements);
      await applyElementsToPage(currentTab.id, updated);
      currentElements = updated;
      const n = updated.length;
      setStatus(
        `${n} camp${n !== 1 ? 's' : ''} actualitzat${n !== 1 ? 's' : ''}`,
        'ok'
      );
    } catch (err) {
      showError(err.message);
    } finally {
      applyBtn.disabled = false;
      refreshBtn.disabled = false;
    }
  });

  await scan();
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch((err) => {
    const errorEl = document.getElementById('error');
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  });
});
