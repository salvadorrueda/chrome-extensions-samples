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

  function getIdentifier(el) {
    function clean(s) {
      return (s || '').replace(/\s+/g, ' ').trim().substring(0, 60);
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
      return el.textContent || '';
    }

    return el.value || '';
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

// --- CSV utils ---

function escapeCSV(value) {
  const str = String(value == null ? '' : value);
  // Always quote: simplifies parsing and handles all edge cases.
  return '"' + str.replace(/"/g, '""') + '"';
}

// Columns: # (1-based index), Identificador, Valor
// BOM (\uFEFF) ensures Excel opens the file as UTF-8.
function elementsToCSV(elements) {
  const header = '#,Identificador,Valor';
  const rows = elements.map((el, i) =>
    [escapeCSV(i + 1), escapeCSV(el.identifier), escapeCSV(el.value)].join(',')
  );
  return '\uFEFF' + [header, ...rows].join('\r\n');
}

// Minimal RFC 4180 CSV parser. Handles quoted fields with embedded commas,
// quotes and newlines.
function parseCSV(text) {
  const rows = [];
  let i = 0;
  const n = text.length;

  // Strip BOM if present.
  if (text.charCodeAt(0) === 0xfeff) {
    i = 1;
  }

  while (i < n) {
    const row = [];
    let firstField = true;

    rowLoop: while (i < n) {
      if (!firstField) {
        if (text[i] === ',') {
          i++;
        } else {
          break rowLoop;
        }
      }
      firstField = false;

      if (text[i] === '"') {
        i++; // skip opening quote
        let field = '';
        while (i < n) {
          if (text[i] === '"') {
            if (i + 1 < n && text[i + 1] === '"') {
              field += '"';
              i += 2;
            } else {
              i++; // skip closing quote
              break;
            }
          } else {
            field += text[i++];
          }
        }
        row.push(field);
      } else if (text[i] === '\r' || text[i] === '\n') {
        break rowLoop;
      } else {
        let field = '';
        while (
          i < n &&
          text[i] !== ',' &&
          text[i] !== '\r' &&
          text[i] !== '\n'
        ) {
          field += text[i++];
        }
        row.push(field);
      }
    }

    if (i < n && text[i] === '\r') {
      i++;
    }
    if (i < n && text[i] === '\n') {
      i++;
    }

    if (row.length > 0) {
      rows.push(row);
    }
  }

  return rows;
}

// Match imported CSV rows to elements by the '#' index column (column 0).
// Returns updated elements array. Elements not found in CSV are left unchanged.
function applyCSVToElements(elements, csvRows) {
  // Skip header row.
  const dataRows = csvRows.slice(1);

  const updated = elements.map((el) => ({ ...el }));

  dataRows.forEach((row) => {
    const rawIndex = row[0];
    const newValue = row[2] !== undefined ? row[2] : '';
    const idx = parseInt(rawIndex, 10);

    if (!Number.isNaN(idx) && idx >= 1 && idx <= updated.length) {
      updated[idx - 1] = { ...updated[idx - 1], value: newValue };
    }
  });

  return updated;
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

// The source tab ID is passed as a URL param by background.js when opening this page.
function getSourceTabId() {
  const params = new URLSearchParams(window.location.search);
  const id = parseInt(params.get('sourceTabId'), 10);
  if (Number.isNaN(id)) {
    throw new Error(
      "No s'ha trobat la pestanya d'origen. Tanca aquesta pestanya i fes clic a la icona de l'extensió de nou."
    );
  }
  return id;
}

async function init() {
  const statusEl = document.getElementById('status');
  const exportBtn = document.getElementById('export-btn');
  const fileInput = document.getElementById('file-input');
  const fileLabelText = document.getElementById('file-label-text');
  const importPreview = document.getElementById('import-preview');
  const importInfo = document.getElementById('import-info');
  const applyBtn = document.getElementById('apply-btn');
  const errorEl = document.getElementById('error');

  let currentElements = [];
  let sourceTabId = null;
  let pendingCSVRows = null;

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

  // Scan the source tab for form elements.
  async function scan() {
    hideError();
    setStatus('Escanejant...', 'scanning');
    exportBtn.disabled = true;

    try {
      sourceTabId = getSourceTabId();
      const results = await chrome.scripting.executeScript({
        target: { tabId: sourceTabId, allFrames: true },
        func: collectFormElements
      });
      currentElements = aggregateResults(results);

      const n = currentElements.length;
      if (n === 0) {
        setStatus('Cap camp de formulari trobat.');
      } else {
        setStatus(
          `${n} camp${n !== 1 ? 's' : ''} trobat${n !== 1 ? 's' : ''}`,
          'ok'
        );
        exportBtn.disabled = false;
      }
    } catch (err) {
      setStatus('Error en escanejar');
      showError(err.message);
    }
  }

  exportBtn.addEventListener('click', () => {
    if (!currentElements.length) {
      return;
    }

    hideError();
    exportBtn.disabled = true;

    const csv = elementsToCSV(currentElements);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    chrome.downloads.download({ url, filename: 'form-data.csv' }, (_id) => {
      URL.revokeObjectURL(url);
      exportBtn.disabled = false;
      if (chrome.runtime.lastError) {
        showError(`Error en exportar: ${chrome.runtime.lastError.message}`);
      }
    });
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) {
      return;
    }

    hideError();
    importPreview.hidden = true;
    pendingCSVRows = null;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rows = parseCSV(e.target.result);
        // rows[0] is the header; rows[1..] are data rows.
        const dataCount = Math.max(0, rows.length - 1);

        if (dataCount === 0) {
          showError('El fitxer CSV no conté dades.');
          return;
        }

        pendingCSVRows = rows;
        importInfo.textContent = `"${file.name}" — ${dataCount} fila${dataCount !== 1 ? 'es' : ''}`;
        importPreview.hidden = false;
        fileLabelText.textContent = file.name;
      } catch (err) {
        showError(`Error llegint el fitxer: ${err.message}`);
      }
    };

    reader.onerror = () => {
      showError("No s'ha pogut llegir el fitxer.");
    };

    reader.readAsText(file, 'UTF-8');
  });

  applyBtn.addEventListener('click', async () => {
    if (!pendingCSVRows || !currentElements.length || !sourceTabId) {
      return;
    }

    hideError();
    applyBtn.disabled = true;

    try {
      const updated = applyCSVToElements(currentElements, pendingCSVRows);
      await applyElementsToPage(sourceTabId, updated);
      currentElements = updated;

      const n = updated.length;
      setStatus(
        `${n} camp${n !== 1 ? 's' : ''} actualitzat${n !== 1 ? 's' : ''}`,
        'ok'
      );
      importPreview.hidden = true;
      fileLabelText.textContent = 'Selecciona un fitxer CSV…';
      fileInput.value = '';
      pendingCSVRows = null;
    } catch (err) {
      showError(err.message);
    } finally {
      applyBtn.disabled = false;
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
