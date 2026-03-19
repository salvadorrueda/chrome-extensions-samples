function getPriorityScore(element) {
  let score = 0;

  if (element.tag === 'button') {
    score += 50;
  }

  if (element.onclick) {
    score += 40;
  }

  if (element.contextText) {
    score += 15;
  }

  if (element.text) {
    score += 10;
  }

  if (element.frameUrl && /login/i.test(element.frameUrl)) {
    score += 25;
  }

  if (
    element.domPath &&
    /loginForm|pageBody|form-group/i.test(element.domPath)
  ) {
    score += 20;
  }

  if (element.iconClass && /glyphicon-play/i.test(element.iconClass)) {
    score += 30;
  }

  return score;
}

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

  if (!elements || elements.length === 0) {
    inputResultsEl.hidden = true;
    inputListEl.innerHTML = '';
    inputCountEl.textContent = '';
    return;
  }

  inputResultsEl.hidden = false;
  inputCountEl.textContent = `Total: ${elements.length} input field(s)`;
  inputListEl.innerHTML = '';

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

    return;
  }

  toggleBtn.textContent = 'Highlight Input Fields';
  toggleBtn.classList.remove('active');
  statusEl.textContent = "Clica per ressaltar camps d'entrada";
  countsEl.hidden = true;
  renderInputElementsList([]);
}

async function initInputAnalyzer() {
  const toggleBtn = document.getElementById('toggle-input-btn');
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
}

async function clickElementInPage(tabId, elementDescriptor) {
  function clickResolvedElement(descriptor) {
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

    function findBestFallback(descriptorToFind) {
      const candidates = Array.from(
        document.querySelectorAll(
          'a, button, input, [role="button"], [role="link"], [onclick]'
        )
      );

      return (
        candidates.find((candidate) => {
          const candidateOnclick = candidate.getAttribute('onclick') || '';
          const candidateId = candidate.getAttribute('id') || '';
          const candidateClass = candidate.getAttribute('class') || '';
          const candidateType = candidate.getAttribute('type') || '';
          const candidateText = (
            candidate.innerText ||
            candidate.textContent ||
            ''
          )
            .replace(/\s+/g, ' ')
            .trim();

          return (
            candidate.tagName.toLowerCase() === descriptorToFind.tag &&
            candidateOnclick === (descriptorToFind.onclick || '') &&
            candidateId === (descriptorToFind.id || '') &&
            candidateClass === (descriptorToFind.class || '') &&
            candidateType === (descriptorToFind.type || '') &&
            candidateText.substring(0, 120) === (descriptorToFind.text || '')
          );
        }) || null
      );
    }

    function fireClick(element) {
      element.scrollIntoView({ block: 'center', inline: 'center' });
      element.focus({ preventScroll: true });

      ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(
        (eventName) => {
          element.dispatchEvent(
            new MouseEvent(eventName, {
              bubbles: true,
              cancelable: true,
              view: window
            })
          );
        }
      );
    }

    const target =
      getElementByDomPath(descriptor.domPath) || findBestFallback(descriptor);

    if (!target) {
      return {
        success: false,
        message: "No s'ha pogut localitzar l'element a la pàgina."
      };
    }

    fireClick(target);
    return { success: true };
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [elementDescriptor.frameId] },
    func: clickResolvedElement,
    args: [elementDescriptor]
  });

  const result = results[0]?.result;
  if (!result?.success) {
    throw new Error(result?.message || "No s'ha pogut fer click a l'element.");
  }
}

async function highlightElementInPage(tabId, elementDescriptor) {
  function highlightResolvedElement(descriptor) {
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

    function findBestFallback(descriptorToFind) {
      const candidates = Array.from(
        document.querySelectorAll(
          'a, button, input, [role="button"], [role="link"], [onclick]'
        )
      );

      return (
        candidates.find((candidate) => {
          const candidateOnclick = candidate.getAttribute('onclick') || '';
          const candidateId = candidate.getAttribute('id') || '';
          const candidateClass = candidate.getAttribute('class') || '';
          const candidateType = candidate.getAttribute('type') || '';
          const candidateText = (
            candidate.innerText ||
            candidate.textContent ||
            ''
          )
            .replace(/\s+/g, ' ')
            .trim();

          return (
            candidate.tagName.toLowerCase() === descriptorToFind.tag &&
            candidateOnclick === (descriptorToFind.onclick || '') &&
            candidateId === (descriptorToFind.id || '') &&
            candidateClass === (descriptorToFind.class || '') &&
            candidateType === (descriptorToFind.type || '') &&
            candidateText.substring(0, 120) === (descriptorToFind.text || '')
          );
        }) || null
      );
    }

    function ensureHighlightStyle() {
      if (document.getElementById('__clickable-analyzer-highlight-style')) {
        return;
      }

      const style = document.createElement('style');
      style.id = '__clickable-analyzer-highlight-style';
      style.textContent = `
        .__clickable-analyzer-highlight {
          outline: 3px solid #ff7a00 !important;
          outline-offset: 2px !important;
          box-shadow: 0 0 0 4px rgba(255, 122, 0, 0.25) !important;
          transition: box-shadow 0.15s ease-in-out !important;
        }
      `;
      document.head.appendChild(style);
    }

    const target =
      getElementByDomPath(descriptor.domPath) || findBestFallback(descriptor);

    if (!target) {
      return { success: false, message: "No s'ha pogut ressaltar l'element." };
    }

    ensureHighlightStyle();

    if (
      window.__clickableAnalyzerLastHighlight &&
      window.__clickableAnalyzerLastHighlight.isConnected
    ) {
      window.__clickableAnalyzerLastHighlight.classList.remove(
        '__clickable-analyzer-highlight'
      );
    }

    target.classList.add('__clickable-analyzer-highlight');
    target.scrollIntoView({ block: 'center', inline: 'center' });
    window.__clickableAnalyzerLastHighlight = target;

    window.setTimeout(() => {
      if (target.isConnected) {
        target.classList.remove('__clickable-analyzer-highlight');
      }
    }, 1300);

    return { success: true };
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [elementDescriptor.frameId] },
    func: highlightResolvedElement,
    args: [elementDescriptor]
  });

  const result = results[0]?.result;
  if (!result?.success) {
    throw new Error(result?.message || "No s'ha pogut ressaltar l'element.");
  }
}

// Funció per a analitzar els elements clicables de la pàgina o del frame actual
function getClickableElements() {
  function compactText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function isVisible(element, style) {
    if (!style) {
      return false;
    }

    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.visibility === 'collapse' ||
      style.pointerEvents === 'none' ||
      Number(style.opacity) === 0
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return (
      rect.width > 0 && rect.height > 0 && element.getClientRects().length > 0
    );
  }

  function isProbablyClickable(element, style) {
    const tagName = element.tagName.toLowerCase();
    const role = (element.getAttribute('role') || '').toLowerCase();
    const type = (element.getAttribute('type') || '').toLowerCase();
    const className = element.className || '';
    const tabIndex = element.getAttribute('tabindex');

    if (
      tagName === 'button' ||
      tagName === 'summary' ||
      tagName === 'select' ||
      (tagName === 'a' && element.hasAttribute('href')) ||
      (tagName === 'area' && element.hasAttribute('href'))
    ) {
      return true;
    }

    if (
      tagName === 'input' &&
      ['button', 'submit', 'reset', 'checkbox', 'radio', 'image'].includes(type)
    ) {
      return true;
    }

    if (
      [
        'button',
        'link',
        'menuitem',
        'option',
        'tab',
        'checkbox',
        'radio',
        'switch'
      ].includes(role)
    ) {
      return true;
    }

    if (
      element.hasAttribute('onclick') ||
      element.hasAttribute('ng-click') ||
      element.hasAttribute('data-ng-click')
    ) {
      return true;
    }

    if (tabIndex !== null && tabIndex !== '-1') {
      return true;
    }

    if (style.cursor === 'pointer') {
      return true;
    }

    return /(^|\s)(btn|button|link)(-|_|\s|$)/i.test(className);
  }

  function getClickReason(element, style) {
    const tagName = element.tagName.toLowerCase();
    const role = (element.getAttribute('role') || '').toLowerCase();
    const type = (element.getAttribute('type') || '').toLowerCase();

    if (tagName === 'button') {
      return 'button';
    }

    if (tagName === 'a' && element.hasAttribute('href')) {
      return 'link';
    }

    if (tagName === 'input' && type) {
      return `input:${type}`;
    }

    if (element.hasAttribute('onclick')) {
      return 'onclick';
    }

    if (
      element.hasAttribute('ng-click') ||
      element.hasAttribute('data-ng-click')
    ) {
      return 'angular-click';
    }

    if (role) {
      return `role:${role}`;
    }

    if (element.getAttribute('tabindex') !== null) {
      return 'tabindex';
    }

    if (style.cursor === 'pointer') {
      return 'cursor:pointer';
    }

    return 'class-hint';
  }

  function getContextText(element) {
    const candidates = [
      element.previousElementSibling,
      element.nextElementSibling,
      element.parentElement
    ];

    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }

      const clonedCandidate = candidate.cloneNode(true);
      clonedCandidate.querySelectorAll('script, style').forEach((node) => {
        node.remove();
      });

      const text = compactText(
        clonedCandidate.innerText || clonedCandidate.textContent
      );
      if (!text) {
        continue;
      }

      const ownText = compactText(element.innerText || element.textContent);
      if (candidate === element.parentElement && ownText) {
        const parentTextWithoutOwnText = compactText(text.replace(ownText, ''));
        if (parentTextWithoutOwnText) {
          return parentTextWithoutOwnText.substring(0, 120);
        }
      }

      return text.substring(0, 120);
    }

    return '';
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

  function describeElement(element) {
    const text = compactText(element.innerText || element.textContent || '');
    const ariaLabel = element.getAttribute('aria-label') || '';
    const value = element.getAttribute('value') || '';
    const alt = element.getAttribute('alt') || '';
    const placeholder = element.getAttribute('placeholder') || '';
    const name = element.getAttribute('name') || '';
    const onclick = element.getAttribute('onclick') || '';
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const iconClass = compactText(
      Array.from(element.querySelectorAll('[class]'))
        .map((node) => node.getAttribute('class') || '')
        .join(' ')
    );

    return {
      tag: element.tagName.toLowerCase(),
      text: text.substring(0, 120),
      type: element.getAttribute('type') || '',
      id: element.getAttribute('id') || '',
      class: element.getAttribute('class') || '',
      href: element.getAttribute('href') || '',
      role: element.getAttribute('role') || '',
      title: element.getAttribute('title') || '',
      ariaLabel,
      value: value.substring(0, 120),
      alt: alt.substring(0, 120),
      placeholder: placeholder.substring(0, 120),
      name: name.substring(0, 120),
      onclick: onclick.substring(0, 120),
      iconClass: iconClass.substring(0, 120),
      contextText: getContextText(element),
      reason: getClickReason(element, style),
      domPath: getDomPath(element),
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      frameUrl: window.location.href
    };
  }

  const selectors = [
    'a[href]',
    'button',
    'summary',
    'select',
    'area[href]',
    'input:not([type="hidden"])',
    '[role="button"]',
    '[role="link"]',
    '[role="menuitem"]',
    '[role="tab"]',
    '[onclick]',
    '[ng-click]',
    '[data-ng-click]',
    '[tabindex]:not([tabindex="-1"])',
    '[style*="cursor: pointer"]',
    '[class*="btn"]',
    '[class*="button"]',
    '[class*="link"]'
  ];

  const clickableElements = [];
  const seenElements = new Set();
  const candidates = new Set(document.querySelectorAll(selectors.join(',')));

  document.querySelectorAll('*').forEach((element) => {
    const style = window.getComputedStyle(element);
    if (style.cursor === 'pointer') {
      candidates.add(element);
    }
  });

  candidates.forEach((element) => {
    if (seenElements.has(element)) {
      return;
    }

    seenElements.add(element);

    const style = window.getComputedStyle(element);
    if (!isVisible(element, style) || !isProbablyClickable(element, style)) {
      return;
    }

    const info = describeElement(element);
    if (
      info.text ||
      info.id ||
      info.class ||
      info.href ||
      info.role ||
      info.title ||
      info.ariaLabel ||
      info.value ||
      info.alt ||
      info.placeholder ||
      info.name ||
      info.onclick ||
      info.contextText ||
      info.iconClass
    ) {
      clickableElements.push(info);
    }
  });

  return clickableElements;
}

// Escoltador del botó
document.getElementById('analyze-btn').addEventListener('click', async () => {
  const loadingEl = document.getElementById('loading');
  const resultsEl = document.getElementById('results');
  const errorEl = document.getElementById('error');
  const listEl = document.getElementById('elements-list');
  const countEl = document.getElementById('element-count');

  // Reset
  loadingEl.style.display = 'block';
  resultsEl.style.display = 'none';
  errorEl.style.display = 'none';

  try {
    // Obtenemos la pestaña activa
    const tab = await getActiveTab();

    // Executar l'anàlisi a la pàgina principal i a tots els iframes accessibles
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: getClickableElements
    });

    const uniqueElements = new Map();

    results.forEach((frameResult) => {
      const frameElements = frameResult.result || [];
      frameElements.forEach((element) => {
        element.frameId = frameResult.frameId;

        const key = [
          frameResult.frameId,
          element.frameUrl,
          element.tag,
          element.id,
          element.class,
          element.text,
          element.href,
          element.value,
          element.ariaLabel,
          element.onclick,
          element.contextText,
          element.domPath,
          element.rect
            ? `${element.rect.x},${element.rect.y},${element.rect.width},${element.rect.height}`
            : ''
        ].join('|');

        if (!uniqueElements.has(key)) {
          uniqueElements.set(key, element);
        }
      });
    });

    const elements = Array.from(uniqueElements.values()).sort((left, right) => {
      return getPriorityScore(right) - getPriorityScore(left);
    });

    if (elements.length === 0) {
      throw new Error("No s'han trobat elements clicables.");
    }

    // Mostrar resultats
    listEl.innerHTML = '';
    elements.forEach((el) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'element-item';
      itemEl.tabIndex = 0;
      itemEl.setAttribute('role', 'button');

      let content = `<span class="element-tag">&lt;${el.tag}&gt;</span>`;

      if (el.text) {
        content += `<div class="element-text">${escapeHtml(el.text)}</div>`;
      } else if (el.contextText) {
        content += `<div class="element-text">Context: ${escapeHtml(el.contextText)}</div>`;
      }

      const properties = [];
      if (el.id)
        properties.push(
          `<span class="element-property"><span class="property-label">ID:</span> ${escapeHtml(el.id)}</span>`
        );
      if (el.class)
        properties.push(
          `<span class="element-property"><span class="property-label">CLASS:</span> ${escapeHtml(el.class.substring(0, 50))}</span>`
        );
      if (el.href)
        properties.push(
          `<span class="element-property"><span class="property-label">HREF:</span> ${escapeHtml(el.href.substring(0, 40))}</span>`
        );
      if (el.type)
        properties.push(
          `<span class="element-property"><span class="property-label">TYPE:</span> ${el.type}</span>`
        );
      if (el.role)
        properties.push(
          `<span class="element-property"><span class="property-label">ROLE:</span> ${el.role}</span>`
        );
      if (el.title)
        properties.push(
          `<span class="element-property"><span class="property-label">TITLE:</span> ${escapeHtml(el.title.substring(0, 40))}</span>`
        );
      if (el.ariaLabel)
        properties.push(
          `<span class="element-property"><span class="property-label">ARIA:</span> ${escapeHtml(el.ariaLabel.substring(0, 40))}</span>`
        );
      if (el.value)
        properties.push(
          `<span class="element-property"><span class="property-label">VALUE:</span> ${escapeHtml(el.value.substring(0, 40))}</span>`
        );
      if (el.alt)
        properties.push(
          `<span class="element-property"><span class="property-label">ALT:</span> ${escapeHtml(el.alt.substring(0, 40))}</span>`
        );
      if (el.placeholder)
        properties.push(
          `<span class="element-property"><span class="property-label">PLACEHOLDER:</span> ${escapeHtml(el.placeholder.substring(0, 40))}</span>`
        );
      if (el.name)
        properties.push(
          `<span class="element-property"><span class="property-label">NAME:</span> ${escapeHtml(el.name.substring(0, 40))}</span>`
        );
      if (el.onclick)
        properties.push(
          `<span class="element-property"><span class="property-label">ONCLICK:</span> ${escapeHtml(el.onclick.substring(0, 40))}</span>`
        );
      if (el.iconClass)
        properties.push(
          `<span class="element-property"><span class="property-label">ICONA:</span> ${escapeHtml(el.iconClass.substring(0, 40))}</span>`
        );
      if (el.reason)
        properties.push(
          `<span class="element-property"><span class="property-label">DETECTAT PER:</span> ${escapeHtml(el.reason)}</span>`
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
      let highlightTimeoutId = null;

      const scheduleHighlight = () => {
        window.clearTimeout(highlightTimeoutId);
        highlightTimeoutId = window.setTimeout(async () => {
          try {
            await highlightElementInPage(tab.id, el);
          } catch (_error) {
            // Ignore preview highlight errors to avoid noisy UX.
          }
        }, 120);
      };

      itemEl.addEventListener('mouseenter', scheduleHighlight);
      itemEl.addEventListener('focus', scheduleHighlight);
      itemEl.addEventListener('click', async () => {
        errorEl.style.display = 'none';

        try {
          itemEl.classList.add('element-item-pending');
          await clickElementInPage(tab.id, el);
          itemEl.classList.remove('element-item-pending');
          itemEl.classList.add('element-item-success');
          window.setTimeout(() => {
            itemEl.classList.remove('element-item-success');
          }, 1500);
        } catch (error) {
          itemEl.classList.remove('element-item-pending');
          errorEl.style.display = 'block';
          errorEl.textContent = `Error: ${error.message}`;
        }
      });
      itemEl.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }

        event.preventDefault();
        itemEl.click();
      });
      listEl.appendChild(itemEl);
    });

    countEl.textContent = `Total: ${elements.length} element(s) clicable(s)`;

    loadingEl.style.display = 'none';
    resultsEl.style.display = 'block';
  } catch (error) {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    errorEl.textContent = `Error: ${error.message}`;
  }
});

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
