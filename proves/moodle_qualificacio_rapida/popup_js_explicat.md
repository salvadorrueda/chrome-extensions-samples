# Anàlisi línia a línia: `popup.js`

**Debugger estàtic — mode explicació exhaustiva**

---

```
[DEBUGGER] Carregant script per analitzar: /home/salvadorrueda/Developer/chrome-extensions-samples/proves/moodle_qualificacio_rapida/popup.js
[DEBUGGER] Total de línies: 503
[DEBUGGER] Intèrpret detectat: javascript
[DEBUGGER] Iniciant anàlisi seqüencial...
```

---

## BLOC 1 — Constant global de tipus d'entrada (línies 1–7)

```javascript
const INPUT_TYPE_KEYS = [
  'text',
  'number',
  'textarea',
  'select',
  'contenteditable'
];
```

```
[DEBUGGER] L:1-7 » const — Definició de la constant INPUT_TYPE_KEYS
  La paraula clau `const` declara una variable de bloc que no pot ser reassignada.
  El nom SCREAMING_SNAKE_CASE (majúscules amb guions baixos) és una convenció per
  indicar que és una constant de configuració global, immutable durant tota l'execució.

  El valor és un array literal de sis cadenes de text que representen les categories
  d'elements d'entrada HTML que l'analitzador és capaç de reconèixer:
    - 'text': camps <input type="text"> o similars
    - 'number': camps <input type="number">
    - 'textarea': elements <textarea>
    - 'select': desplegables <select>
    - 'contenteditable': elements HTML amb l'atribut contenteditable="true"

  Aquest array s'utilitza com a font única de veritat (single source of truth) per
  a totes les operacions que necessiten iterar sobre els tipus possibles. Centralitzar
  la llista aquí permet afegir nous tipus en un sol lloc sense modificar múltiples
  funcions.

  IMPORTANT: `const` no congela el contingut de l'array. Podria fer-se
  `INPUT_TYPE_KEYS.push('checkbox')` sense error. Per fer-lo immutable del tot
  caldria `Object.freeze(INPUT_TYPE_KEYS)`, cosa que aquí no s'ha fet.

  Alternativa: podria haver-se usat `Object.freeze([...])` o un enum-like object
  `{ TEXT: 'text', NUMBER: 'number', ... }` per evitar comparacions per string.
```

---

## BLOC 2 — Funció per obtenir la pestanya activa (línies 9–20)

```javascript
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
```

```
[DEBUGGER] L:9 » async function — Declaració de la funció getActiveTab
  La paraula clau `async` transforma la funció perquè sempre retorni una Promise.
  Quan s'utilitza `await` dins seu, el motor JavaScript suspèn l'execució de la
  funció fins que la Promise esperada es resol, sense bloquejar el fil principal.
  La declaració de funció (function declaration) es hissa (hoisted) al capdamunt del
  seu àmbit, a diferència de les function expressions.

[DEBUGGER] L:10-13 » await + destructuring — Consulta a la API de Chrome
  `chrome.tabs.query({ active: true, currentWindow: true })` crida l'API de
  Chrome Extensions per obtenir un array de pestanyes que compleixin els filtres:
    - `active: true`: només la pestanya que té el focus
    - `currentWindow: true`: dins de la finestra on s'ha obert el popup

  L'API retorna sempre un array, però amb aquests filtres quasi sempre conté un sol
  element. La sintaxi `const [tab] = await ...` és destructuració d'array: extreu
  el primer element de l'array i l'assigna a `tab`. Si l'array és buit, `tab` serà
  `undefined`.

  `await` desemballa la Promise retornada per `chrome.tabs.query`. Sense `await`,
  `tab` seria la Promise en si mateixa, no el resultat.

[DEBUGGER] L:15-17 » if — Guàrdia de seguretat doble
  La condició `!tab || !tab.id` cobreix dos casos límit:
    1. `!tab`: l'array estava buit (no hi ha cap pestanya activa, cas poc probable)
    2. `!tab.id`: la pestanya existeix però no té id (pot passar amb pestanyes
       internes del navegador com `chrome://settings` o pàgines de nova pestanya)

  L'operador `||` fa curtcircuit: si `!tab` és veritat, no s'avalua `!tab.id`,
  evitant un TypeError de propietat sobre `undefined`.

  `throw new Error(...)` llança una excepció que serà capturada per qualsevol
  bloc `catch` o `.catch()` que envolteixi la crida a `getActiveTab()`.
  El missatge és en català, consistent amb l'idioma del projecte.

[DEBUGGER] L:19 » return — Retorn de la pestanya vàlida
  Si les guàrdies no s'han activat, `tab` conté un objecte Tab vàlid de Chrome amb
  propietats com `id`, `url`, `title`, etc. Es retorna sencer per si el codi
  cridador necessita qualsevol d'aquestes propietats.
```

---

## BLOC 3 — Funció que consulta l'estat de l'analitzador d'inputs en el DOM (línies 22–122)

```javascript
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
```

```
[DEBUGGER] L:22 » async function — Declaració de queryInputAnalyzerState
  Rep `tabId` (un número enters) com a paràmetre. Aquest id s'utilitza per indicar
  a Chrome en quina pestanya s'ha d'injectar el codi.

[DEBUGGER] L:23 » const — Constant local DATA_ATTR
  `'data-input-analyzer-type'` és un atribut de dades HTML personalitzat (data-*)
  que l'script de contingut (content.js) afegeix als elements que ressalta.
  Definir-lo com a constant local evita que un potencial error tipogràfic en la
  cadena de text passi desapercebut en múltiples llocs.

[DEBUGGER] L:25-118 » await chrome.scripting.executeScript — Injecció de codi al DOM
  `chrome.scripting.executeScript` és la API de Manifest V3 per executar codi
  JavaScript dins del context d'una pàgina web. Rep un objecte de configuració:

  - `target: { tabId, allFrames: true }`: el paràmetre `tabId` usa shorthand
    property (ES6), equivalent a `tabId: tabId`. `allFrames: true` fa que el codi
    s'executi en el frame principal I en tots els iframes de la pàgina, cosa
    crucial per a Moodle que pot tenir contingut en iframes.

  - `func: (attr) => { ... }`: la funció SERIALITZADA i enviada al context de la
    pàgina. IMPORTANT: aquesta funció s'executa en un entorn completament separat
    (el context de la pàgina web), no té accés a les variables del popup. Per
    això les dades externes es passen via `args`.

  - `args: [DATA_ATTR]`: array de valors que es passen com arguments a `func`.
    `DATA_ATTR` del popup es rep com el paràmetre `attr` dins la funció injectada.

[DEBUGGER] L:27-30 » function compactText — Funció auxiliar local dins el context injectat
  Normalitza text blanc: `(text || '')` gestiona valors null/undefined convertint-los
  a cadena buida. `.replace(/\s+/g, ' ')` substitueix qualsevol seqüència d'espais
  blancs (espais, tabuladors, salts de línia) per un sol espai. `.trim()` elimina
  els espais dels extrems.
  L'expressió regular `/\s+/g` usa el flag `g` (global) per substituir totes les
  ocurrències, no només la primera.

[DEBUGGER] L:32-60 » function getDomPath — Generació del camí CSS del DOM
  Construeix un selector CSS únic per localitzar l'element. Funciona pujant per
  l'arbre del DOM des de l'element fins arribar a un element amb `id` o a l'arrel.

  L:33 — `const segments = []`: array on s'acumulen els segments del camí.
  L:34 — `let current = element`: punter mutable que avança cap amunt en el DOM.
    Es usa `let` perquè `current` es reassigna en cada iteració del bucle.

  L:36 — `while (current && current.nodeType === Node.ELEMENT_NODE)`:
    - `current &&` evita NullPointerException quan s'arriba al node document
    - `Node.ELEMENT_NODE` (valor 1) comprova que és un element HTML, no un text o
      comentari. La constant `Node.ELEMENT_NODE` és part de la Web API estàndard.

  L:38-39 — `tagName.toLowerCase()`: les etiquetes HTML en el DOM es guarden en
    majúscules (`INPUT`, `DIV`), es converteixen a minúscules per fer selectors CSS
    estàndard.

  L:41-44 — `if (current.id)`: si l'element té id, el camí pot acabar aquí perquè
    l'id hauria de ser únic a la pàgina. S'afegeix com `tagName#id`, es posa al
    principi de `segments` amb `unshift` (afegir al capdavant, no al final com
    `push`) i es trenca el bucle amb `break`.

  L:46-53 — Càlcul de l'índex `nth-of-type`:
    Si l'element no té id, cal distingir-lo entre els seus germans (siblings) del
    mateix tipus. `index` comença a 1 i s'incrementa per cada germà anterior
    (`previousElementSibling`) que tingui el mateix `tagName`. La comparació
    `sibling.tagName === current.tagName` és case-sensitive, però com que el DOM
    guarda les etiquetes en majúscules, la comparació és consistent.

  L:55-56 — `segment += ':nth-of-type(${index})'` i `segments.unshift(segment)`:
    S'afegeix el selector posicional i el segment es col·loca al principi de l'array,
    perquè s'està pujant per l'arbre però el camí s'ha de llegir de dalt a baix.

  L:57 — `current = current.parentElement`: avança un nivell cap amunt al DOM.

  L:60 — `segments.join(' > ')`: uneix els segments amb el combinador CSS fill
    directe, produint selectors com `form#gradebook > div:nth-of-type(2) > input:nth-of-type(1)`.

[DEBUGGER] L:63-84 » function describeInput — Serialització de les propietats d'un element
  Crea un objecte pla (plain object) amb totes les metadades rellevants d'un element.
  Els objectes plans es poden serialitzar amb JSON, cosa necessària per transportar
  les dades del context de la pàgina al context del popup.

  L:64 — `el.labels`: la propietat `labels` és específica d'HTMLInputElement i
    HTMLTextAreaElement. Conté una NodeList dels elements <label> associats.
    Per a elements `contenteditable` o `select`, pot no existir, d'aquí el
    cortcircuit `el.labels &&`.

  L:65-68 — Operador ternari per obtenir el text del label. `labelEl.innerText`
    és preferit sobre `textContent` perquè retorna el text visible (respecta
    `display: none`), però `textContent` actua com a fallback.

  L:71-83 — L'objecte retornat per `describeInput`:
    - `kind`: la categoria (dels tipus de INPUT_TYPE_KEYS)
    - `tag`: nom de l'etiqueta en minúscules
    - `inputType`: l'atribut `type` de l'input (text, email, number, etc.)
    - `id`, `class`, `name`: atributs HTML estàndard
    - `ariaLabel`: important per accessibilitat, molt usat en Moodle
    - `placeholder`: text indicatiu del camp
    - `.substring(0, 120)`: tots els valors de text es tallen a 120 caràcters per
      evitar transferir dades excessives entre la pàgina i el popup
    - `value`: `el.value` accedeix al valor DOM (ja processat), diferent de
      `getAttribute('value')` que retorna l'atribut HTML original (valor inicial)
    - `frameUrl`: `window.location.href` dins el context injectat retorna la URL
      del frame on s'executa, no del frame principal

  L:79 — `el.value || el.getAttribute('value') || ''`: cadena de fallbacks. Per
    a elements `contenteditable`, `el.value` és `undefined`, de manera que
    `getAttribute('value')` actua com a alternativa.

[DEBUGGER] L:86 » const highlighted — Selecció d'elements marcats
  `document.querySelectorAll('[data-input-analyzer-type]')` selecciona tots els
  elements que tinguin l'atribut de dades personalitzat, independentment del seu
  valor. Retorna una NodeList (no un array), però és iterable amb `forEach`.

[DEBUGGER] L:87-93 » const counts — Objecte acumulador de comptadors per tipus
  S'inicialitzen tots els comptadors a 0. Això garanteix que l'objecte sempre
  tingui les mateixes claus, independentment dels elements trobats. Facilita
  la lectura posterior sense haver de comprovar si la clau existeix.

[DEBUGGER] L:95-101 » forEach — Iteració sobre elements ressaltats
  Per a cada element, es llegeix el valor de l'atribut `data-input-analyzer-type`.
  La comprovació `type in counts` valida que el tipus sigui un dels reconeguts
  (evita injectar dades de tipus desconeguts). L'operador `in` comprova l'existència
  de la clau en l'objecte, no el valor. És equivalent a
  `Object.hasOwn(counts, type)` però més breu.

[DEBUGGER] L:103-108 » return — Resultat de l'script injectat
  L'objecte retornat és el que `chrome.scripting.executeScript` empaqueta en
  l'array `results`. Cada element de `results` correspon a un frame on s'ha
  executat l'script.
  - `active: window.__inputAnalyzerActive || false`: comprova una variable global
    de la pàgina que `content.js` estableix quan activa el mode ressaltament.
    `|| false` assegura un valor booleà en cas que la variable no existeixi.

[DEBUGGER] L:120 » return aggregateInputAnalyzerResults(results)
  Delega la combinació de resultats de múltiples frames a una funció separada.
  Aquesta separació segueix el principi de responsabilitat única (SRP): la funció
  actual s'encarrega d'executar el codi a la pàgina; l'altra, d'agregar resultats.
```

---

## BLOC 4 — Funció d'agregació de resultats de múltiples frames (línies 124–183)

```javascript
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
```

```
[DEBUGGER] L:124 » function — Declaració de aggregateInputAnalyzerResults (sincrona)
  Aquesta funció és síncrona (no `async`) perquè no necessita esperar cap operació
  asíncrona; simplement processa dades ja disponibles.
  Rep `results`, l'array retornat per `chrome.scripting.executeScript`.

[DEBUGGER] L:125-133 » const totals — Objecte acumulador de totals globals
  Mateix esquema que `counts` dins la funció injectada. S'inicialitza a zeros per
  poder sumar els valors de tots els frames sense comprovar si les claus existeixen.

[DEBUGGER] L:135-138 » Variables d'acumulació
  - `let active = false`: s'usa `let` perquè s'actualitza dins del `forEach`.
    Comença en `false` i es pot canviar a `true`, però mai de tornada a `false`
    (per disseny: si qualsevol frame té el mode actiu, es considera actiu).
  - `let count = 0`: comptador acumulatiu total d'elements.
  - `const aggregatedElements = []`: array on s'aniran afegint elements.
  - `const seenKeys = new Set()`: estructura de dades Set, òptima per comprovar
    existència en O(1). S'usa per detectar duplicats entre frames.

[DEBUGGER] L:140-178 » forEach — Iteració sobre resultats per frame
  `results` és l'array de respostes de `executeScript`, on cada element correspon
  a un frame diferent.

[DEBUGGER] L:141 » Optional chaining i fallback — entry?.result || entry
  `entry?.result`: l'operador `?.` (optional chaining) accedeix a `result` sense
  llançar error si `entry` és null o undefined. Quan `executeScript` té èxit, el
  resultat de la funció injectada es troba a `entry.result`. No obstant, en alguns
  contextos (com quan la funció és invocada des de `content.js` via `files:`),
  `entry` podria ser directament el resultat. El `|| entry` actua com a fallback.

[DEBUGGER] L:143-145 » if (!result) return
  Si `result` és null, undefined, 0, o cadena buida (valors falsy), s'abandona
  la iteració d'aquest element sense processament. Això pot passar si el frame
  ha llançat un error o ha retornat null. L'`return` dins un `forEach` equival
  a un `continue` en un bucle `for`.

[DEBUGGER] L:147 » typeof entry?.frameId === 'number' — Comprovació del tipus de frameId
  `typeof` és l'únic operador segur per comprovar el tipus sense risc de TypeError.
  Es comprova explícitament que sigui `'number'` (i no `'string'` o `'undefined'`)
  perquè `frameId: 0` és el frame principal, i `Boolean(0)` és `false`, de manera
  que no seria segur usar simplement `entry?.frameId || 0`.

[DEBUGGER] L:148 » active = active || Boolean(result.active)
  `Boolean()` converteix explícitament qualsevol valor truthy/falsy a `true`/`false`.
  L'operador `||` fa que `active` romangui `true` un cop establert (no pot tornar
  a `false`). Això implementa una lògica OR: si qualsevol frame és actiu, el total
  és actiu.

[DEBUGGER] L:151-153 » forEach sobre INPUT_TYPE_KEYS — Acumulació de comptadors
  `result.counts?.[key]`: encadenament opcional amb notació de claudàtors per
  accedir a propietats amb nom dinàmic. `|| 0` garanteix que els valors nuls o
  indefinits no produeixin `NaN` en la suma.
  Usar INPUT_TYPE_KEYS aquí evita repetir la llista de tipus manualment.

[DEBUGGER] L:155-177 » forEach sobre elements — Deduplicació amb uniqueKey
  Per a cada element de cada frame:

  L:156-159 — Spread operator `...element` copia totes les propietats de l'element
  original en un nou objecte i afegeix `frameId`. Això no modifica l'original.

  L:160-174 — `uniqueKey` és un string format per la concatenació de totes les
  propietats identificatives separades per `'|'`. El separador `|` s'ha escollit
  perquè rarament apareix en valors de formularis HTML normals.
  RISC D'EDGE CASE: si un atribut conté el caràcter `|`, dues claus diferents
  podrien produir el mateix `uniqueKey`. Per evitar-ho caldria usar JSON.stringify.

  L:175-178 — `seenKeys.has(uniqueKey)` comprova si ja s'ha processat un element
  idèntic (pot ocórrer si el mateix element és retornat per múltiples frames per
  algun error de configuració). Si és nou, s'afegeix al Set i a l'array resultant.

[DEBUGGER] L:180 » return — Objecte agregat final
  Retorna un objecte amb l'estructura esperada per `updateInputAnalyzerUi`:
  `{ active, count, counts, elements }`. La propietat `counts` usa la variable
  `totals` amb renombrament: `counts: totals`.
```

---

## BLOC 5 — Funció de renderització de la llista d'elements (línies 185–280)

```javascript
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
```

```
[DEBUGGER] L:185 » function renderInputElementsList — Funció de renderització de la UI
  Funció síncrona que actualitza el DOM del popup per mostrar la llista d'elements
  detectats. Segueix el patró de renderització imperativa: manipulació directa del DOM.
  Rep `elements`, l'array d'objectes generats per `aggregateInputAnalyzerResults`.

[DEBUGGER] L:186-189 » Obtenció de referències DOM
  `document.getElementById` és el mètode més ràpid per obtenir elements per id
  (cerca directa en un índex intern). Les referències s'emmagatzemen en constants
  locals per no repetir la cerca al DOM en cada ús.

  - `inputResultsEl` (#input-results): contenidor principal de la secció de resultats
  - `inputCountEl` (#input-element-count): element on es mostra el recompte total
  - `inputListEl` (#input-elements-list): contenidor de les targetes individuals
  - `inputValuesTextarea` (#input-values-textarea): àrea de text editable amb
    els valors actuals dels camps, que l'usuari pot modificar

[DEBUGGER] L:191-203 » function getInputIdentifier — Identificador llegible per l'usuari
  Funció interna (closure) que tria el millor identificador disponible per mostrar
  al costat del valor. Segueix una jerarquia de preferència:
    1. `#id` — el més precís i curt
    2. `[name="..."]` — selector per atribut name, comú en formularis
    3. `element.domPath` — el camí complet CSS, menys llegible però únic
    4. `element.tag || 'input'` — últim recurs, poc informatiu però no falla mai

[DEBUGGER] L:205-207 » function getInputLineValue — Format de línia per al textarea
  Produeix una cadena del format `#identificador: valor actual`. El separador `: `
  (dos punts i espai) és important: la funció `parseTextareaInputValues` el usa
  per dividir identificador i valor quan l'usuari edita el textarea.
  `element.value || element.text || ''` usa cadena de fallbacks per gestionar
  elements `contenteditable` on `value` pot ser buit però `text` conté el contingut.

[DEBUGGER] L:209-215 » if (!elements || elements.length === 0) — Guàrdia per estat buit
  Si no hi ha elements a mostrar (pas inicial o després de desactivar):
  - `hidden = true` oculta el contenidor (equivalent a `display: none` via atribut)
  - `innerHTML = ''` borra el DOM interior
  - `textContent = ''` borra el text del comptador
  - `value = ''` buida el textarea
  - `return` atura l'execució de la funció aquí

  NOTA: `inputListEl.innerHTML = ''` és una forma ràpida de buidar el contingut,
  però elimina tots els event listeners dels fills (si en tinguessin). Com que
  els elements d'aquí es generen sense listeners propis, no és un problema.

[DEBUGGER] L:217-220 » Renderització en mode actiu
  - `hidden = false`: mostra el contenidor
  - Template literal amb `elements.length` per al recompte
  - `inputListEl.innerHTML = ''` borra el contingut anterior abans de refer-lo
  - `elements.map(getInputLineValue).join('\n')`: crea el text del textarea
    aplicant `getInputLineValue` a cada element i unint els resultats amb salts
    de línia. L'ordre és crític: ha de coincidir amb `elements` per a
    `parseTextareaInputValues`.

[DEBUGGER] L:222-280 » forEach — Generació de targetes individuals per element
  Per a cada element de l'array `elements` (denominat `el` en aquest context
  per distingir-lo del paràmetre `elements`):

  L:223-224 — Es crea un `<div>` nou amb `document.createElement` i se li assigna
  la classe CSS `element-item`. Usar `createElement` en comptes de concatenar HTML
  és millor pràctica per als elements contenidors (separa estructura de contingut),
  però el contingut intern s'assigna per `innerHTML` (veure L:277).

  L:226-227 — `&lt;` i `&gt;` són entitats HTML per a `<` i `>`. S'usen
  directament al template literal per mostrar l'etiqueta com `<input>` de manera
  segura sense que el navegador la interpreti com HTML real.
  `escapeHtml(el.tag)` protegeix en cas que `el.tag` contingui caràcters especials
  (poc probable però defensivament correcte).
  `el.kind || 'text'` usa 'text' com a valor per defecte si `kind` fos buit.

  L:229-231 — Bloc condicional per `inputType`: si l'element té atribut `type`
  (com `type="email"` o `type="number"`), s'afegeix una línia addicional.
  Elements com `<select>` o `<textarea>` no tenen atribut `type`, de manera que
  no es mostra.

  L:233-236 — `mainText = el.label || el.placeholder || el.ariaLabel || el.text`:
  cadena de fallbacks per trobar el text descriptiu més rellevant. `el.label`
  (del `<label>` associat) és el més informatiu; si no n'hi ha, es busca
  `placeholder`, `aria-label` i finalment el text intern.

  L:238-270 — `properties` és un array de strings HTML. Cada propietat es
  comprova condicionalment i s'afegeix a l'array si té valor. Usar `push` en
  un array i `join('')` al final és més eficient que concatenar strings en un
  bucle, perquè evita crear molts strings intermedis.

  L:261 i L:265 — `.substring(0, 60)` talla el `domPath` i el `frameUrl` a
  60 caràcters per motius visuals (les URLs i els camins DOM poden ser molt llargs).
  NOTA: els valors originals ja estaven truncats a 120 en `describeInput`; aquí
  es trunca a 60 addicionals per la UI del popup que és estreta.

  L:272-274 — Si `properties` té algun element, es renderitza el bloc de propietats
  com un div amb tots els spans junts (sense separadors entre ells, la CSS s'ocupa
  del layout).

  L:277 — `itemEl.innerHTML = content`: assignació del HTML construït. Aquí hi
  ha un risc potencial d'XSS si `escapeHtml` fallés o si no s'apliqués
  correctament a totes les interpolacions. La funció `escapeHtml` (definida a
  L:484) usa el mecanisme natiu del DOM per escapar, que és robust.

  L:278 — `inputListEl.appendChild(itemEl)`: afegeix la targeta al contenidor.
  Cada crida a `appendChild` provoca un re-paint del navegador; per a llistes
  molt llargues seria millor usar `DocumentFragment`.
```

---

## BLOC 6 — Funció d'actualització de la UI de l'analitzador (línies 282–322)

```javascript
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
```

```
[DEBUGGER] L:282 » Destructuració en el paràmetre — { active, count, counts, elements }
  En lloc de rebre un paràmetre `state` i accedir a `state.active`, `state.count`,
  etc., la funció usa destructuració directament en la signatura. Això fa explícites
  les propietats que la funció necessita i escurça el codi intern.
  L'objecte d'entrada ha de tenir exactament aquestes claus (o compatibles).

[DEBUGGER] L:283-286 » Obtenció de referències DOM
  - `toggleBtn` (#toggle-input-btn): el botó principal d'activació/desactivació
  - `statusEl` (#input-status): text d'estat que informa l'usuari
  - `countsEl` (#input-counts): secció que mostra els recomptes per tipus
  - `applyBtn` (#apply-input-values-btn): botó per aplicar els valors editats

[DEBUGGER] L:288-307 » if (active) — Branca d'estat actiu
  Quan `active` és `true`, l'analitzador ha trobat i ressaltat elements.

  L:289 — `toggleBtn.textContent = 'Remove Highlights'`: canvia el text del botó
  per indicar l'acció inversa (desactivar). Patró toggle.

  L:290 — `toggleBtn.classList.add('active')`: afegeix la classe CSS `active` per
  canviar visualment l'aparença del botó (color, estat visual actiu). `classList`
  és l'API moderna per manipular classes (alternativa a manipular `className`
  com a string).

  L:292 — `const plural = count === 1 ? '' : 's'`: operador ternari per pluralitzar
  correctament "field" vs "fields". Comparació estricta `===` per evitar coerció.

  L:293 — Template literal per construir el missatge d'estat amb pluralització.

  L:296-302 — Iteració sobre INPUT_TYPE_KEYS per actualitzar cada fila de recompte:
    - `document.getElementById('row-${key}')`: ids dinàmics amb convenció `row-text`,
      `row-number`, etc. S'assumeix que existeixen al HTML del popup.
    - `document.getElementById('cnt-${key}')`: ids per als números, convenció `cnt-text`.
    - `row.hidden = total === 0`: oculta les files on el recompte és zero per
      no mostrar categories buides. L'atribut HTML `hidden` fa el mateix que
      `display: none` via CSS.

  L:304 — `renderInputElementsList(elements || [])`: el `|| []` protegeix de
  `undefined` passant un array buit si `elements` no existeix.

  L:305 — `applyBtn.hidden = false`: mostra el botó d'aplicar, que estava ocult.

  L:307 — `return`: atura l'execució. El codi que segueix (línies 310-320)
  correspon a l'estat inactiu i no s'ha d'executar.

[DEBUGGER] L:310-320 » Branca d'estat inactiu (sense if explícit)
  Codi que s'executa quan `active` és `false`. El `return` anterior evita usar
  un bloc `else`, reduint la indentació.

  L:311 — `classList.remove('active')`: elimina la classe CSS d'estat actiu.
  Si la classe no existeix, `remove` no llança cap error (és idempotent).

  L:312 — El missatge de status torna al català: "Clica per ressaltar camps d'entrada"
  mentre que els missatges d'estat actiu estan en anglès (inconsistència menor).

  L:314 — `applyBtn.hidden = true`: oculta el botó d'aplicar quan no hi ha
  res ressaltat.

  L:315 — `renderInputElementsList([])`: passa un array buit per netejar la llista.
  Això activa la guàrdia `if (!elements || elements.length === 0)` de la funció.
```

---

## BLOC 7 — Funció de processament del textarea editat (línies 324–337)

```javascript
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
```

```
[DEBUGGER] L:324 » function parseTextareaInputValues — Parsejat del textarea editat
  Rep `textareaValue` (el contingut sencer del textarea com a string) i `elements`
  (l'array original d'elements amb les seves metadades).

[DEBUGGER] L:325 » const lines = textareaValue.split('\n')
  Divideix el text pel caràcter de salt de línia. Cada línia correspon a un element
  en el mateix ordre que `elements`. Aquesta correspondència positional és el
  mecanisme d'associació: `lines[0]` correspon a `elements[0]`, etc.

  RISC D'EDGE CASE: en sistemes Windows, els salts de línia poden ser `\r\n`.
  Si el textarea retorna `\r\n`, el `split('\n')` deixaria el caràcter `\r` al
  final de cada línia, potencialment afegint espai al valor. Caldria fer
  `textareaValue.split(/\r?\n/)` per ser robust.

[DEBUGGER] L:327-335 » elements.map — Transformació d'elements amb nous valors
  `map` retorna un nou array sense modificar l'original. El paràmetre `index`
  és el segon argument del callback de `map` i indica la posició actual.

  L:328 — `lines[index] || ''`: si `lines` té menys elements que `elements`
  (l'usuari ha esborrat línies), `lines[index]` seria `undefined`, de manera
  que `|| ''` substitueix per cadena buida.

  L:329 — `rawLine.indexOf(': ')`: cerca el separador `: ` (dos punts i espai).
  Retorna -1 si no es troba. `indexOf` cerca la primera ocurrència, cosa que és
  correcta: el format és `identificador: valor`, i el valor pot contenir `: `.

  L:330-331 — `rawLine.slice(separatorIndex + 2)`: `+2` salta els dos caràcters
  del separador (`:` i ` `). Si `separatorIndex` és -1 (no hi ha separador),
  la condició `separatorIndex >= 0` és `false` i s'usa `rawLine` sencer com a valor.

  L:333-336 — Spread `...element` copia totes les propietats originals i sobrescriu
  `value` i `text` amb el nou valor. S'actualitzen les dues propietats per mantenir
  la coherència, ja que alguns elements `contenteditable` usen `text` en lloc de `value`.
```

---

## BLOC 8 — Funció d'aplicació de valors al DOM de la pàgina (línies 339–431)

```javascript
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
```

```
[DEBUGGER] L:339 » async function applyInputValuesToPage
  Funció principal d'escriptura: envia els nous valors als elements del DOM de la pàgina.
  Rep `tabId` i l'array `elements` amb les metadades i valors actualitzats.

[DEBUGGER] L:340-349 » Map — Agrupació d'elements per frameId
  `new Map()` crea un mapa clau-valor. Les claus són els `frameId` (números) i
  els valors són arrays d'elements d'aquell frame.
  Es tria `Map` en lloc d'un objecte `{}` perquè les claus poden ser números, i
  els `Map` preserven el tipus de la clau (els objectes literals converteixen
  les claus a strings).

  El patró d'agrupació dins del `forEach`:
  - `if (!elementsByFrame.has(frameId))`: si no hi ha entrada per aquest frame,
    es crea un array buit.
  - `elementsByFrame.get(frameId).push(element)`: s'afegeix l'element a l'array
    del seu frame.

[DEBUGGER] L:351-428 » await Promise.all — Execució paral·lela per frame
  `Promise.all` accepta un iterable de Promises i les executa en paral·lel.
  Retorna una Promise que es resol quan TOTES les Promises s'han resolt, o
  es rebutja si qualsevol es rebutja.

  `Array.from(elementsByFrame.entries())`: converteix el Map en array de parelles
  `[clau, valor]` per poder usar `.map()`. `elementsByFrame.entries()` és un
  iterador de Map.

  `.map(([frameId, frameElements]) => { ... })`: destructuració de la parella
  directament en el callback. Cada iteració crea una Promise per injectar codi
  en un frame específic.

  `target: { tabId, frameIds: [frameId] }`: a diferència de `allFrames: true`
  (que executa en tots els frames), aquí s'especifica exactament en quin frame
  executar, gràcies a `frameIds`. Aixi s'apliquen els valors al frame correcte.

[DEBUGGER] L:354-427 » func injectada — Codi executat al context de cada frame
  Tres funcions auxiliars i la lògica principal:

[DEBUGGER] L:355-364 » function getElementByDomPath — Localització per selector CSS
  Usa `document.querySelector(path)` per trobar l'element. El bloc `try/catch`
  és necessari perquè un `domPath` malformat (per exemple, si conté caràcters
  especials no escapats en el selector CSS) llançaria un `SyntaxError` en
  `querySelector`. El paràmetre `_error` usa el prefix `_` per indicar que
  l'error es descarta intencionadament (convenció del projecte).

[DEBUGGER] L:366-393 » function findMatchingInput — Estratègia de localització en dos passos
  Primer prova `getElementByDomPath` (localització exacta i ràpida).
  Si falla, fa una cerca heurística:

  L:367-372 — `document.querySelectorAll('input, textarea, select, ...')`:
    selector de llista per obtenir tots els elements interactius. La notació
    `[contenteditable=""]` cobreix elements amb l'atribut present però buit,
    mentre que `[contenteditable="true"]` cobreix els explícitament habilitats.

  L:374-391 — `candidates.find(...)` retorna el primer element que compleixi
    TOTES les condicions:
    - `tagName` coincideix
    - `id` coincideix (o tots dos buits)
    - `name` coincideix (o tots dos buits)
    - `type` coincideix (o tots dos buits)
    Les comparacions `(attr || '') === (desc || '')` normalitzen `null`, `undefined`
    i `''` a `''` per fer comparacions consistents.

  El `|| null` final assegura que si `find` retorna `undefined` (no trobat),
  la funció retorni `null` explícitament.

[DEBUGGER] L:395-430 » function updateElementValue — Actualització del valor amb events
  Gestiona tres casos diferents:

  L:396-401 — `element.isContentEditable && tagName !== 'INPUT/TEXTAREA/SELECT'`:
    Els elements `contenteditable` com `<div>` o `<p>` no tenen la propietat `.value`.
    Cal usar `element.textContent = value` per establir el contingut de text.
    La condició exclou INPUT, TEXTAREA i SELECT que poden tenir `isContentEditable`
    a `true` en contexts inusuals però s'han de gestionar diferent.

  L:402-413 — `tagName === 'SELECT'`:
    En un `<select>`, no es pot posar qualsevol string a `.value`; cal que
    correspongui a una opció existent. `Array.from(element.options).find(...)`:
    cerca una opció on `option.value` o `option.text` coincideixi amb el valor
    desitjat. Si es troba, s'usa el `value` estàndard de l'opció. Si no, s'intenta
    assignar directament (potser el valor és vàlid però no s'ha trobat per text).

  L:414-416 — Cas general: `element.value = value` per a `<input>` i `<textarea>`.

  L:418-424 — `dispatchEvent`: CRÍTIC per a frameworks com React, Vue o Angular
    que no escolten canvis natius de `.value`. Quan el codi JavaScript assigna
    `element.value = ...` directament, el framework no s'assabenta del canvi.
    Disparar els events `'input'` i `'change'` amb `bubbles: true` simula
    la interacció de l'usuari i notifica els frameworks.
    `cancelable: true` permet que els handlers dels events els puguin cancel·lar
    (per compatibilitat màxima amb la pàgina).

[DEBUGGER] L:426-430 » descriptors.map — Aplicació i retorn de resultats
  Per a cada `descriptor` de l'array `frameElements` (rebut com `descriptors`):
  - Si no es troba l'element: retorna `{ success: false, identifier: ... }` amb
    l'identificador per facilitar el diagnòstic.
  - Si es troba: aplica el valor i retorna `{ success: true }`.
  El resultat és un array que s'envia de tornada al context del popup, però
  en aquest codi no s'usa el valor retornat per `Promise.all` (no hi ha gestió
  d'errors per a elements no trobats en la UI).
```

---

## BLOC 9 — Funció d'inicialització i gestió d'events (línies 433–482)

```javascript
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
```

```
[DEBUGGER] L:433 » async function initInputAnalyzer — Punt d'entrada principal
  Funció orquestradora que inicialitza tot el sistema: obté l'estat inicial,
  renderitza la UI i configura els event listeners. Es crida una sola vegada
  quan el popup s'obre.

[DEBUGGER] L:434-438 » Obtenció de referències DOM i pestanya activa
  Les referències DOM s'obtenen una vegada al principi per eficiència. La
  pestanya `tab` s'obté de forma asíncrona aquí i es captura en el closure
  dels event listeners, de manera que `tab.id` es manté accessible en tots
  els handlers sense necessitat de passar-lo com a paràmetre.

[DEBUGGER] L:440-441 » Consulta i renderització de l'estat inicial
  `let currentState`: es declara amb `let` perquè s'actualitzarà en cada click.
  Actua com a "estat de l'aplicació" local, un patró similar als frameworks
  reactius però implementat manualment.
  `updateInputAnalyzerUi(currentState)`: renderitza l'estat al obrir el popup.
  Si l'analitzador ja estava actiu d'una sessió anterior, es mostrarà correctament.

[DEBUGGER] L:443-469 » toggleBtn.addEventListener — Handler del botó principal
  L'arrow function `async () => { ... }` rep el control del botó i executa
  operacions asíncrones. Les arrow functions no creen el seu propi `this`,
  usant el del context exterior (no rellevant aquí, però és una característica
  important).

  L:444 — `toggleBtn.disabled = true`: desactiva el botó IMMEDIATAMENT per
  evitar dobles clicks mentre s'executa l'operació. Patró de protecció contra
  clicks múltiples.

  L:446-465 — Bloc `try/finally` (sense `catch`): garanteix que `disabled` es
  torni a `false` encara que es llanci una excepció. `finally` s'executa SEMPRE,
  independentment de si hi ha hagut error.

  L:447 — `const mode = currentState.active ? 'remove' : 'add'`: ternari per
  determinar el mode: si l'analitzador és actiu, s'eliminen els ressaltats; si
  és inactiu, s'afegeixen.

  L:449-454 — Primer `executeScript`: injecta el mode com a variable global
  `window.__inputAnalyzerMode` en la pàgina. Usar variables globals de `window`
  per passar informació entre execucions successives d'scripts és una tècnica
  comuna en extensions Chrome quan no es pot usar missatgeria.

  L:456-460 — Segon `executeScript` amb `files: ['content.js']`: en lloc de
  `func:`, s'injecta un fitxer JS extern. `content.js` llegeix `window.__inputAnalyzerMode`
  i afegeix o elimina els ressaltats al DOM. Retorna un resultat per frame.
  NOTA: injectar `content.js` múltiples vegades (cada click) és una estratègia
  vàlida si `content.js` és idempotent i usa el mode per decidir l'acció.

  L:462 — `currentState = aggregateInputAnalyzerResults(results)`: actualitza
  l'estat local amb el resultat de la nova execució.

  L:464 — `updateInputAnalyzerUi(currentState)`: re-renderitza la UI amb el nou estat.

[DEBUGGER] L:471-481 » applyBtn.addEventListener — Handler del botó d'aplicació
  L:472-474 — Guàrdia de seguretat amb optional chaining: `currentState.elements?.length`
  usa `?.` per accedir a `length` de forma segura si `elements` és `null` o
  `undefined`. Si no hi ha elements o l'analitzador no és actiu, no s'executa res.

  L:476 — `applyBtn.disabled = true`: igual que amb `toggleBtn`, protegeix contra
  clicks múltiples.

  L:478-480 — `parseTextareaInputValues(inputValuesTextarea.value, currentState.elements)`:
  llegeix el contingut actual del textarea (potencialment editat per l'usuari)
  i el combina amb les metadades dels elements per generar l'array actualitzat.

  L:482-483 — `await applyInputValuesToPage(tab.id, updatedElements)`: envia els
  nous valors a la pàgina.

  L:484-487 — `currentState = { ...currentState, elements: updatedElements }`:
  actualitza l'estat local. Spread `...currentState` preserva les propietats
  `active`, `count` i `counts`; `elements: updatedElements` sobrescriu
  només els elements.

  L:488 — `statusEl.textContent`: missatge de confirmació en català.

  L:489 — `renderInputElementsList(updatedElements)`: re-renderitza la llista
  amb els valors actualitzats per donar feedback visual a l'usuari.

  L:490-492 — `finally { applyBtn.disabled = false }`: rehabilita el botó
  sempre, fins i tot si `applyInputValuesToPage` llança una excepció.
```

---

## BLOC 10 — Funció d'escapament HTML i inicialització del document (línies 484–503)

```javascript
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
```

```
[DEBUGGER] L:484 » // Funció per escapar HTML — Comentari descriptiu
  Comentari en català, coherent amb l'idioma del projecte. Indica clarament la
  finalitat de la funció que segueix. És un comentari de línia sola (`//`) adequat
  per a funcions curtes i evidents.

[DEBUGGER] L:485-489 » function escapeHtml — Escapament segur de text per a HTML
  Implementa l'escapament d'entitats HTML usant el mecanisme natiu del DOM,
  que és el mètode més robust i segur disponible:

  L:486 — `document.createElement('div')`: crea un element `<div>` en memòria,
  sense afegir-lo al DOM de la pàgina (no produeix re-paint).

  L:487 — `div.textContent = text`: assignar a `textContent` fa que el navegador
  tracti `text` com a text pur, escapant automàticament tots els caràcters
  especials HTML: `<` → `&lt;`, `>` → `&gt;`, `&` → `&amp;`, `"` → `&quot;`.

  L:488 — `return div.innerHTML`: llegint `innerHTML` del div, s'obté el text
  amb els caràcters especials correctament convertits en entitats HTML.

  PERQUÈ AQUESTA APROXIMACIÓ:
  Alternativa manual: `text.replace(/&/g, '&amp;').replace(/</g, '&lt;')...`
  és fràgil perquè cal recordar TOTS els caràcters especials.
  La tècnica del `div` delega la feina al motor HTML del navegador, que coneix
  perfectament quins caràcters cal escapar. A més, és sincròna i no requereix
  cap importació.

  LIMITACIÓ: si `text` és `null` o `undefined`, `div.textContent = null` produirà
  el string `"null"`, i `undefined` produirà `"undefined"`. Caldria usar
  `div.textContent = text ?? ''` per gestionar valors nuls.

  Aquesta funció s'usa intensament a `renderInputElementsList` per protegir
  contra XSS quan s'insereix contingut de la pàgina web (atributs HTML com
  `id`, `name`, `class`) dins del HTML del popup.

[DEBUGGER] L:491-498 » document.addEventListener('DOMContentLoaded') — Punt d'inici
  L:491 — `'DOMContentLoaded'`: event que el navegador dispara quan el HTML del
  popup ha estat parsejat i el DOM és complet, SENSE esperar imatges ni
  fulls d'estil externs. És el moment adequat per iniciar manipulació DOM.
  Alternativa: posar el `<script>` al final del `<body>` en el HTML eliminaria
  la necessitat d'aquest event, però l'event és més explícit i portàtil.

  L:491 — Arrow function `() => { ... }`: callback que s'executa quan el DOM
  és llest. No necessita paràmetres (l'event en si no s'usa).

  L:492 — `initInputAnalyzer()`: crida la funció principal. Com que és `async`,
  retorna una Promise. No s'usa `await` aquí (el listener no pot ser `async`
  de forma útil), de manera que cal gestionar els errors explícitament.

  L:492-496 — `.catch((error) => { ... })`: gestió d'errors de `initInputAnalyzer`.
  Si qualsevol `await` dins d'`initInputAnalyzer` llança un error no capturat
  (per exemple, si `getActiveTab` falla perquè no hi ha pestanya activa),
  s'intercepta aquí i es mostra a l'element `#input-status`.
  `error.message` accedeix al missatge de text de l'Error (definit en
  `new Error("...")` a `getActiveTab`).

  LIMITACIÓ: si `document.getElementById('input-status')` retorna `null`
  (l'element no existeix al HTML), la línia `statusEl.textContent = ...`
  llançaria un TypeError secundari que no es capturaria. Un codi més defensiu
  usaria `statusEl?.textContent = ...`.
```

---

```
[DEBUGGER] Anàlisi completada. Total d'instruccions analitzades: 503 línies.
[DEBUGGER] Fi de la sessió de depuració.
```
