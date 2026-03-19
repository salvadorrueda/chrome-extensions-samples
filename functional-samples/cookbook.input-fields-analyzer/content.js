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

// This script is injected via scripting.executeScript. It toggles the
// highlight of all text-input elements on the page and returns the new state.
(function () {
  const STYLE_ID = 'input-analyzer-styles';

  const TYPE_COLORS = {
    text: '#4285f4',
    number: '#34a853',
    textarea: '#9c27b0',
    select: '#ff9800',
    contenteditable: '#ea4335'
  };

  // Selectors grouped by semantic type.
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
    contenteditable: '[contenteditable="true"],[contenteditable=""]'
  };

  const ALL_SELECTORS = Object.values(TYPE_SELECTORS).join(',');
  const DATA_ATTR = 'data-input-analyzer-type';

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
    if (tag === 'textarea') return 'textarea';
    if (tag === 'select') return 'select';
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
    if (style) style.remove();
    window.__inputAnalyzerActive = false;
    return { active: false, count: 0, counts: {} };
  }

  function buildCSS() {
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
    style.textContent = buildCSS();
    document.head.appendChild(style);

    const elements = document.querySelectorAll(ALL_SELECTORS);
    const counts = {
      text: 0,
      number: 0,
      textarea: 0,
      select: 0,
      contenteditable: 0
    };

    elements.forEach((el) => {
      const type = getElementType(el);
      el.setAttribute(DATA_ATTR, type);
      counts[type]++;
    });

    window.__inputAnalyzerActive = true;
    return { active: true, count: elements.length, counts };
  }

  if (window.__inputAnalyzerActive) {
    return removeHighlights();
  } else {
    return addHighlights();
  }
})();
