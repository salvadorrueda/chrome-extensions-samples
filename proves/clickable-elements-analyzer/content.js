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

(function () {
  const STYLE_ID = 'input-analyzer-styles';
  const MODE_KEY = '__inputAnalyzerMode';

  const TYPE_COLORS = {
    text: '#4285f4',
    number: '#34a853',
    textarea: '#9c27b0',
    select: '#ff9800',
    contenteditable: '#ea4335'
  };

  const TYPE_SELECTORS = {
    text: [
      'input[type=text]',
      'input:not([type])',
      'input[type=email]',
      'input[type=url]',
      'input[type=search]',
      'input[type=tel]',
      'input[type=password]'
    ].join(','),
    number: [
      'input[type=number]',
      'input[type=range]',
      'input[type=date]',
      'input[type=time]',
      'input[type=datetime-local]',
      'input[type=month]',
      'input[type=week]'
    ].join(','),
    textarea: 'textarea',
    select: 'select',
    contenteditable: '[contenteditable=""],[contenteditable="true"]'
  };

  const ALL_SELECTORS = Object.values(TYPE_SELECTORS).join(',');
  const DATA_ATTR = 'data-input-analyzer-type';

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

  function describeInputElement(el, type) {
    const labelEl = el.labels && el.labels.length > 0 ? el.labels[0] : null;
    const labelText = labelEl
      ? compactText(labelEl.innerText || labelEl.textContent)
      : '';
    const text = compactText(el.innerText || el.textContent || '');
    const placeholder = el.getAttribute('placeholder') || '';
    const value = el.value || el.getAttribute('value') || '';
    const ariaLabel = el.getAttribute('aria-label') || '';
    const name = el.getAttribute('name') || '';
    const id = el.getAttribute('id') || '';
    const className = el.getAttribute('class') || '';

    return {
      kind: type,
      tag: el.tagName.toLowerCase(),
      inputType: el.getAttribute('type') || '',
      id,
      class: className,
      name: name.substring(0, 120),
      ariaLabel: ariaLabel.substring(0, 120),
      placeholder: placeholder.substring(0, 120),
      value: compactText(value).substring(0, 120),
      label: labelText.substring(0, 120),
      text: text.substring(0, 120),
      domPath: getDomPath(el),
      frameUrl: window.location.href
    };
  }

  function getElementType(el) {
    if (
      el.isContentEditable &&
      el.tagName !== 'INPUT' &&
      el.tagName !== 'TEXTAREA' &&
      el.tagName !== 'SELECT'
    ) {
      return 'contenteditable';
    }

    const tag = el.tagName.toLowerCase();
    if (tag === 'textarea') {
      return 'textarea';
    }

    if (tag === 'select') {
      return 'select';
    }

    const inputType = (el.getAttribute('type') || 'text').toLowerCase();
    const numberTypes = [
      'number',
      'range',
      'date',
      'time',
      'datetime-local',
      'month',
      'week'
    ];

    return numberTypes.includes(inputType) ? 'number' : 'text';
  }

  function removeHighlights() {
    document.querySelectorAll(`[${DATA_ATTR}]`).forEach((el) => {
      el.removeAttribute(DATA_ATTR);
    });

    const style = document.getElementById(STYLE_ID);
    if (style) {
      style.remove();
    }

    window.__inputAnalyzerActive = false;
    return { active: false, count: 0, counts: {}, elements: [] };
  }

  function buildCss() {
    return Object.entries(TYPE_COLORS)
      .map(
        ([type, color]) => `
        [${DATA_ATTR}="${type}"] {
          outline: 3px solid ${color} !important;
          outline-offset: 2px !important;
        }`
      )
      .join('\n');
  }

  function addHighlights() {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = buildCss();
    document.head.appendChild(style);

    const elements = document.querySelectorAll(ALL_SELECTORS);
    const counts = {
      text: 0,
      number: 0,
      textarea: 0,
      select: 0,
      contenteditable: 0
    };
    const describedElements = [];

    elements.forEach((el) => {
      const type = getElementType(el);
      el.setAttribute(DATA_ATTR, type);
      counts[type] += 1;
      describedElements.push(describeInputElement(el, type));
    });

    window.__inputAnalyzerActive = true;
    return {
      active: true,
      count: elements.length,
      counts,
      elements: describedElements
    };
  }

  const mode = window[MODE_KEY] || 'toggle';
  delete window[MODE_KEY];

  if (mode === 'remove') {
    return removeHighlights();
  }

  if (mode === 'add') {
    return addHighlights();
  }

  if (window.__inputAnalyzerActive) {
    return removeHighlights();
  }

  return addHighlights();
})();
