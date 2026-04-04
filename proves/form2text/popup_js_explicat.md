# Anàlisi línia a línia: `popup.js`

**Debugger estàtic — mode explicació exhaustiva**

---

```
[DEBUGGER] Carregant script per analitzar: /home/salvadorrueda/Developer/chrome-extensions-samples/proves/form2text/popup.js
[DEBUGGER] Total de línies: 371
[DEBUGGER] Intèrpret detectat: javascript
[DEBUGGER] Iniciant anàlisi seqüencial...
```

---

## BLOC 1 — Funció `collectFormElements`: declaració i selector CSS (línies 1–9)

```javascript
// Runs inside the page. Must be fully self-contained (no outer scope references).
function collectFormElements() {
  const SELECTOR = [
    'input:not([type="hidden"]):not([type="submit"]):not([type="reset"]):not([type="button"]):not([type="image"])',
    'textarea',
    'select',
    '[contenteditable=""]',
    '[contenteditable="true"]'
  ].join(',');
```

```
[DEBUGGER] L:1 » COMMENT — Advertència d'aïllament de la funció
  El comentari avisa que aquesta funció s'injectarà en una pàgina web externa mitjançant
  chrome.scripting.executeScript, on el context del popup no és accessible. Tota referència
  a variables externes (closures, imports, globals del popup) provocaria un ReferenceError
  silenciós o un error d'execució al context de la pàgina injectada.
  Per tant la funció ha de ser completament autosuficient: no pot cridar funcions del popup
  ni accedir a cap variable de l'àmbit exterior.

[DEBUGGER] L:2 » FUNCTION DECLARATION — Punt d'entrada per escanejar els camps
  `function collectFormElements()` declara una funció amb la paraula clau `function`,
  que és hissada (hoisted) al capdamunt del seu àmbit. Això significa que podria cridar-se
  abans de la seva definició textual, tot i que aquí no és necessari.
  Podria haver-se declarat com a `const collectFormElements = () => { ... }` (arrow function),
  però una arrow function no pot ser passada per referència a executeScript de la mateixa
  manera quan es combina amb restriccions de serialització. La declaració clàssica és
  intencionada.

[DEBUGGER] L:3-9 » CONST DECLARATION / ARRAY + JOIN — Construcció del selector CSS compost
  `SELECTOR` s'escriu en majúscules (SCREAMING_SNAKE_CASE) per indicar que és una constant
  semàntica: no canvia durant la vida de la funció.
  Es declara com un array de strings i s'uneix amb `.join(',')` per llegibilitat: cada
  cadena del selector és en una línia independent, facilitant-ne el manteniment.
  L'alternativa seria un únic string literal, però seria ilegible.

  Desglossament de cada selector de l'array:
  - L:4: `input:not([type="hidden"]):not([type="submit"])...` — Selecciona tots els `<input>`
    excepte els ocults i els de control (submit, reset, button, image). Aquests tipus no
    contenen dades introduïdes per l'usuari. La pseudo-classe `:not()` pot encadenar-se
    múltiples vegades en CSS3, i els navegadors moderns ho suporten plenament.
  - L:5: `textarea` — Captura els camps de text multilínia, no inclosos en la regla anterior.
  - L:6: `select` — Captura les llistes desplegables.
  - L:7: `[contenteditable=""]` — Captura elements amb l'atribut contenteditable igualat a
    la cadena buida, que és equivalent a "true" en la majoria de navegadors.
  - L:8: `[contenteditable="true"]` — Captura elements amb contenteditable explícitament
    "true". Es necessiten les dues formes perquè el valor de l'atribut pot diferir.

  Cas límit: elements amb contenteditable="false" no es capturen, cosa correcta perquè no
  accepten edició. Elements `<input type="range">` i `<input type="color">` sí que es
  capturen, cosa potencialment no desitjada en alguns contextos.
```

---

## BLOC 2 — Funció interna `getDomPath` (línies 11–32)

```javascript
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
```

```
[DEBUGGER] L:11 » FUNCTION DECLARATION — Generador de camí DOM únic
  `getDomPath` rep un element DOM (`el`) i retorna un string CSS selector que identifica
  de manera única aquell element dins del document. S'utilitza posteriorment com a
  mecanisme de localització fiable quan es vol tornar a trobar el camp en aplicar valors.
  És una funció d'ordre intern (inner function): es declara dins de `collectFormElements`
  i té accés al seu àmbit léxic, tot i que no usa cap variable exterior.

[DEBUGGER] L:12-13 » VARIABLE INITIALIZATION — Acumulador de segments i cursor de recorregut
  `parts` és un array buit que acumularà els segments del camí (un per cada nivell DOM).
  `cur` és un cursor mutable (`let`) que s'inicialitza a `el` i avança cap amunt per
  l'arbre DOM en cada iteració del bucle.

[DEBUGGER] L:14 » WHILE + CONDITION — Condició de terminació del recorregut ascendent
  El bucle continua mentre `cur` existeixi (no sigui null) i sigui un node de tipus element
  (`Node.ELEMENT_NODE`, valor numèric 1). Això exclou nodes de text o comentaris que podrien
  aparèixer com a parentElement en situacions inesperades.
  Alternativa: podria haver-se usat `cur instanceof Element`, però `nodeType` és compatible
  amb tots els entorns de navegació, inclosos iframes amb contextos globals separats.

[DEBUGGER] L:15 » CONST — Normalització del nom de l'etiqueta
  `cur.tagName` retorna el nom en majúscules (p.ex. "DIV"). `.toLowerCase()` normalitza
  a minúscules per construir selectors CSS convencionals ("div", "input", etc.).

[DEBUGGER] L:16-19 » IF + BREAK — Ancoratge en un element amb ID
  Si l'element actual (`cur`) té un atribut `id`, el camí s'ancora aquí: s'afegeix al
  principi de `parts` el segment `tag#id` (p.ex. "form#contact-form") i el bucle acaba
  amb `break`. Això és una optimització important: un ID ha de ser únic al document, per
  tant no cal continuar pujant per l'arbre.
  `parts.unshift(...)` insereix al principi de l'array, perquè el recorregut és de fill a
  pare però el selector final es llegeix de pare a fill.
  Cas límit: si dos elements compartissin el mateix ID (HTML no vàlid però possible en
  pràctica), el selector podria ser ambigu.

[DEBUGGER] L:20-27 » NESTED WHILE — Càlcul de l'índex nth-of-type
  `idx` s'inicialitza a 1 (CSS és 1-indexed).
  `sib` recorre tots els germans anteriors (`previousElementSibling`) en ordre invers.
  Per cada germà que tingui el mateix `tagName` que `cur`, incrementa `idx`.
  Això permet construir el selector `:nth-of-type(N)` correcte. Per exemple, si hi ha tres
  `<input>` germans i l'element és el segon, `idx` valdrà 2.
  Nota: la comparació `sib.tagName === cur.tagName` usa === sobre strings en majúscules
  (ambdós vénen de `.tagName`), cosa correcta i consistent.

[DEBUGGER] L:28-29 » ARRAY.UNSHIFT + CURSOR ADVANCE — Afegir segment i pujar al pare
  `parts.unshift(...)` afegeix el segment `:nth-of-type(idx)` al principi de l'array.
  `cur = cur.parentElement` avança el cursor al node pare. Si el pare és null
  (hem arribat a `<html>` o a un fragment desconnectat), el bucle termina a la condició.

[DEBUGGER] L:31 » RETURN + JOIN — Construcció del selector final
  `parts.join(' > ')` uneix tots els segments amb el combinador CSS de fill directe.
  El resultat és un selector del tipus "html > body > form#login > div:nth-of-type(2) > input:nth-of-type(1)".
  Cas límit: si l'element és directament l'arrel del document, `parts` pot quedar buit
  i la funció retorna una cadena buida ''. Això és manejat posteriorment amb la crida
  a `getDomPath(el).substring(0, 80)` a `getIdentifier`.
```

---

## BLOC 3 — Funcions internes `getIdentifier` i `getValue` (línies 34–94)

```javascript
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
```

```
[DEBUGGER] L:34 » COMMENT — Restricció del format de l'identificador
  El comentari explica una restricció de disseny important: l'identificador NO pot
  contenir la seqüència " = " perquè aquesta s'utilitza com a separador entre
  identificador i valor al format de text. Si l'identificador la contingués, el
  parsejador `parseTextValues` partiria la línia en el lloc equivocat.

[DEBUGGER] L:35 » FUNCTION DECLARATION — Construcció d'identificadors llegibles per humans
  `getIdentifier` implementa una cascada de prioritats per assignar un nom llegible
  a cada camp de formulari. La prioritat és: etiqueta <label> > aria-label >
  placeholder > id > name > camí DOM. Segueix la mateixa jerarquia que els lectors
  de pantalla per identificar camps, cosa que és una tria semànticament correcta.

[DEBUGGER] L:36-42 » INNER FUNCTION — `clean`: normalitzador de strings
  `clean` és una funció interna de `getIdentifier` (funció dintre de funció dintre de
  funció). Aplica en cadena (method chaining) quatre transformacions:
  - `(s || '')`: protecció contra valors null/undefined, evitant que `.replace` llanci
    TypeError.
  - `.replace(/\s+/g, ' ')`: col·lapsa múltiples espais/tabs/salts de línia en un
    espai únic. La flag `g` (global) aplica la substitució a totes les ocurrències.
  - `.replace(/ = /g, ' - ')`: substitueix la seqüència prohibida " = " per " - "
    per preservar la invariant del format de text.
  - `.trim()`: elimina espais als extrems.
  - `.substring(0, 60)`: limita a 60 caràcters per evitar identificadors excessivament
    llargs al textarea.

[DEBUGGER] L:44-50 » CONDITIONAL — Prioritat 1: etiqueta <label> associada
  `el.labels` és una propietat de HTMLInputElement que retorna la NodeList de <label>
  associats (via atribut `for` o per embolcall). Funciona per a <input>, <textarea> i
  <select>, però NO per a elements contenteditable (que no implementen la propietat
  `labels`), d'aquí la comprovació defensiva `el.labels &&`.
  `el.labels[0]` pren la primera etiqueta (n'hi podria haver diverses).
  Es prefereix `labelEl.innerText` sobre `labelEl.textContent` perquè `innerText`
  respecta el CSS (ignora text ocult amb `display:none`), però si no és disponible
  es recorre a `textContent`.

[DEBUGGER] L:52-55 » CONDITIONAL — Prioritat 2: atribut aria-label
  `aria-label` és l'atribut d'accessibilitat ARIA que proporciona un nom llegible.
  Molt usat en formularis moderns on no hi ha <label> visible. La comprovació
  `aria.trim()` descarta valors que siguin espais en blanc.

[DEBUGGER] L:57-60 » CONDITIONAL — Prioritat 3: atribut placeholder
  El `placeholder` és el text que apareix dins del camp quan és buit. Tot i que no
  és la manera recomanada d'etiquetar camps (per accessibilitat), és molt comú en
  formularis mal etiquetats. S'usa com a darrer recurs llegible per humans.

[DEBUGGER] L:62-65 » CONDITIONAL — Prioritat 4: atribut id
  Si existeix, retorna `#id` sense passar per `clean` perquè els IDs no haurien de
  contenir espais ni la seqüència " = ". El prefix "#" deixa clar que és un ID.

[DEBUGGER] L:67-70 » CONDITIONAL — Prioritat 5: atribut name
  Retorna `[name="valor"]` amb sintaxi de selector CSS d'atribut. Tampoc es passa per
  `clean`, assumint que els noms d'atribut no contenen la seqüència prohibida.
  Cas límit: un name que contingués cometes dobles podria trencar la sintaxi del
  selector.

[DEBUGGER] L:72 » RETURN — Fallback: camí DOM truncat
  Com a darrer recurs, usa el camí DOM generat per `getDomPath`, truncat a 80 caràcters.
  Aquesta opció produeix identificadors no llegibles per humans però únics. Els 80
  caràcters garanteixen que cap segment excessivament llarg ompli el textarea.

[DEBUGGER] L:75 » FUNCTION DECLARATION — Extracció del valor actual d'un element
  `getValue` encapsula la lògica per extreure el valor actual de qualsevol tipus
  d'element de formulari suportat. Cal tractar-los diferent perquè cada tipus
  exposa el seu valor de manera diferent al DOM.

[DEBUGGER] L:76 » CONST — Normalització del tipus d'input
  `el.getAttribute('type')` retorna null si l'atribut no existeix. La combinació amb
  `|| ''` i `.toLowerCase()` garanteix sempre un string en minúscules sense errors.
  `el.type` (propietat DOM) podria semblar equivalent, però retorna "text" per defecte
  si l'atribut no existeix, cosa que podria confondre la detecció de checkbox/radio.
  Usar `getAttribute` és més fidel a l'HTML real.

[DEBUGGER] L:78-80 » IF — Tractament de checkbox i radio
  Per a checkbox i radio, la propietat `el.checked` (booleana) reflecteix l'estat
  actual. Es serialitza com a string 'true' o 'false' per compatibilitat amb el format
  de text de línia. L'operador ternari condensa la conversió booleana.
  Alternativa: `String(el.checked)` seria equivalent però menys explícit.

[DEBUGGER] L:82-87 » CONST + LOGICAL AND — Detecció d'elements contenteditable
  `isEditable` és true si l'element és contenteditable i NO és un dels tres tipus
  natives (`INPUT`, `TEXTAREA`, `SELECT`). Aquesta exclusió és necessària perquè
  `isContentEditable` pot retornar true per a inputs dins d'un contenteditable pare,
  però el seu valor real s'accedeix via `el.value`, no `el.textContent`.
  Les comparacions de `tag` usen `.toUpperCase()` per consistència amb `tagName`.

[DEBUGGER] L:89-91 » IF — Extracció de valor d'element contenteditable
  Per a contenteditable, el contingut és `el.textContent`. Els salts de línia reals
  (`\n`) es serialitzen com la seqüència literal `\\n` (backslash-n) per poder
  emmagatzemar-los en una sola línia del textarea sense trencar el format.
  `.replace(/\n/g, '\\n')` substitueix cada salt de línia per dos caràcters: \ i n.

[DEBUGGER] L:93 » RETURN — Extracció de valor estàndard
  Per a tots els altres elements (`<input>` de text, `<textarea>`, `<select>`),
  `el.value` retorna el valor actual. S'aplica la mateixa escapada de salts de línia.
  `|| ''` protegeix contra el cas improbable que `value` sigui null o undefined.
```

---

## BLOC 4 — Recopilació d'elements i retorn de `collectFormElements` (línies 96–120)

```javascript
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
```

```
[DEBUGGER] L:96 » CONST — Array acumulador dels objectes descriptors
  `elements` és l'array que acumularà un objecte descriptor per cada camp trobat al DOM.
  Es declara amb `const` perquè la referència a l'array no canvia, tot i que el seu
  contingut sí (amb `.push`). Aquesta distinció és important: `const` no implica
  immutabilitat del contingut, només de la referència.

[DEBUGGER] L:97 » QUERYSELECTORALL + FOREACH — Iteració sobre tots els camps del formulari
  `document.querySelectorAll(SELECTOR)` retorna una NodeList estàtica (no viva) de tots
  els elements que coincideixen amb el selector compost construït a la línia 3-9.
  `.forEach(...)` itera sobre la NodeList. Alternativa: `Array.from(...).forEach` o
  `for...of`, però `NodeList.prototype.forEach` és suportat directament en navegadors
  moderns i és suficient aquí.

[DEBUGGER] L:98-99 » CONST — Normalització de tag i inputType per al descriptor
  `tag` i `inputType` es normalitzen en minúscules per garantir comparacions
  consistents. `getAttribute('type') || ''` protegeix el cas en que l'atribut no
  existeixi (elements no-input com textarea o select no tenen type).

[DEBUGGER] L:100-104 » CONST + LOGICAL — Detecció de contenteditable (duplicació de getValue)
  `isContentEditable` reprodueix la mateixa lògica que a la funció `getValue`.
  Nota: aquesta duplicació de lògica podria ser un candidat a refactoritzar en una
  funció helper compartida, però donat que `collectFormElements` ha de ser
  autosuficient (injectada al context de la pàgina), la duplicació és acceptable
  i intencional.

[DEBUGGER] L:106-117 » OBJECT LITERAL + PUSH — Construcció i acumulació del descriptor
  Cada element es descriu com un objecte pla (plain object) amb propietats:
  - `tag`: tipus d'element HTML en minúscules ('input', 'textarea', etc.)
  - `inputType`: valor de l'atribut type en minúscules ('' per a no-inputs)
  - `id`: valor de l'atribut id, o cadena buida. S'usa || '' per evitar null al descriptor.
  - `name`: valor de l'atribut name, o cadena buida.
  - `identifier`: string llegible per humans, generat per `getIdentifier(el)`
  - `value`: valor actual del camp, generat per `getValue(el)`
  - `domPath`: camí CSS del DOM, generat per `getDomPath(el)`
  - `isContentEditable`: booleà del flag calculat
  - `frameUrl`: URL del frame actual (`window.location.href`). Important per a iframes:
    si la pàgina té iframes de dominis/subrutas, cada frame tindrà la seva URL pròpia.
    Aquí s'emmagatzema però no s'usa directament per a la localització posterior.

  La sintaxi de propietats abreujades (shorthand properties) `{ tag, inputType }` és
  equivalent a `{ tag: tag, inputType: inputType }`. És una característica ES6.

[DEBUGGER] L:119 » RETURN — Retorn de l'array de descriptors
  Retorna l'array `elements` complet. Quan s'injecta via `executeScript`, aquest valor
  de retorn es serialitza com a JSON i es transmet de tornada al popup. Per tant, tots
  els valors han de ser serializables (strings, numbers, booleans, arrays, objectes plans).
  No hi poden haver funcions, WeakMaps, Dates específiques, etc.

[DEBUGGER] L:120 » CLOSING BRACE — Tancament de `collectFormElements`
  Tanca el cos de la funció `collectFormElements` declarada a la línia 2.
```

---

## BLOC 5 — Funcions utilitàries globals: `aggregateResults`, `formatElementsAsText`, `parseTextValues` (línies 122–148)

```javascript
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
```

```
[DEBUGGER] L:122 » FUNCTION DECLARATION — Agregació de resultats multi-frame
  `aggregateResults` és la primera funció declarada a l'àmbit global del popup
  (fora de qualsevol altra funció). Rep `results`, l'array retornat per
  `chrome.scripting.executeScript` amb `allFrames: true`. Quan s'injecta en tots
  els frames, l'API retorna un array on cada element correspon a un frame diferent.

[DEBUGGER] L:123-130 » FOREACH ANIDADA + SPREAD — Aplanament de resultats per frame
  El bucle extern itera sobre cada `entry` (un per frame). Cada `entry` té:
  - `entry.frameId`: identificador numèric del frame (0 per al frame principal).
  - `entry.result`: el valor retornat per `collectFormElements` en aquell frame
    (un array d'objectes descriptor).

  `typeof entry.frameId === 'number' ? ... : 0` és una comprovació defensiva: si per
  alguna raó la propietat faltés o fos d'un altre tipus, es fa servir 0 com a valor per
  defecte (el frame principal). `typeof` és més segur que `entry.frameId instanceof Number`
  perquè numbers literals no són instàncies de Number.

  `entry.result || []`: protecció contra el cas en que l'execució al frame fallés i
  `result` fos null o undefined.

  `{ ...el, frameId }` usa l'operador spread d'objectes (ES2018) per clonar cada
  descriptor i afegir-hi la propietat `frameId`. Això és necessari perquè els descriptors
  originals de `collectFormElements` no inclouen `frameId` (el frame no sap el seu propi id).

[DEBUGGER] L:133-134 » COMMENT — Documentació del format de serialització
  Els dos comentaris documenten el contracte de format: una línia per element, amb
  el separador " = " entre identificador i valor, i salts de línia interns escapats
  com \n. Sense aquesta documentació la funció seria difícil d'entendre de manera aïllada.

[DEBUGGER] L:135-137 » FUNCTION + MAP + JOIN — Serialització a text pla
  `formatElementsAsText` transforma l'array de descriptors a un string multilínia.
  `.map((el) => `${el.identifier} = ${el.value}`)` crea un array de strings, un per
  element, amb el format "identificador = valor". Els template literals ES6 interpolen
  les propietats directament.
  `.join('\n')` concatena tots els strings amb salt de línia real (no escapat).
  Resultat exemple:
    "Nom = Joan\\nCognoms = Puig"
  (on \\n seria el literal backslash-n escapat dins d'un valor)

[DEBUGGER] L:139 » COMMENT — Documentació del mecanisme d'aparellament
  Explica que el parsejament es basa en l'índex de línia (posició), no en el contingut
  de l'identificador. Aquesta decisió de disseny és important: si l'usuari afegeix o
  elimina línies al textarea, els elements ja no s'aparellaran correctament. D'aquí
  el mecanisme d'advertiment `updateLineCountWarning`.

[DEBUGGER] L:140-148 » FUNCTION + SPLIT + MAP — Parsejament del textarea a descriptors actualitzats
  `parseTextValues` rep el contingut actual del textarea i l'array original d'elements.
  `textareaContent.split('\n')` parteix per salts de línia reals (no pels escapats \\n).

  Per a cada element a l'índex `i`:
  - `lines[i] || ''`: si hi ha menys línies que elements (cas de retall), usa cadena buida.
  - `line.indexOf(' = ')`: busca el primer separador " = " a la línia.
  - `sep >= 0 ? line.slice(sep + 3) : line`: si es troba el separador, extreu tot el que
    va després (des de la posició sep + 3 fins al final). Si no es troba (línies malformades),
    usa tota la línia com a valor. `slice(sep + 3)` salta els 3 caràcters de " = ".
  - `.replace(/\\n/g, '\n')`: desescapa les seqüències \\n literals de tornada a salts de
    línia reals. La regex `/\\n/g` cerca la seqüència de dos caràcters \ i n.

  `{ ...el, value: raw... }` crea un nou objecte amb totes les propietats originals del
  descriptor però amb la propietat `value` substituïda pel nou valor. El descriptor
  original no es muta (immutabilitat de dades, bona pràctica).
```

---

## BLOC 6 — Funció `applyElementsToPage`: injecció de valors per frame (línies 150–234)

```javascript
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
```

```
[DEBUGGER] L:150 » ASYNC FUNCTION DECLARATION — Aplicació de valors a la pàgina
  `applyElementsToPage` és una funció asíncrona (`async`) perquè opera amb
  `chrome.scripting.executeScript`, que és una API basada en Promises.
  Sense `async`, hauria de gestionar explícitament les promises amb `.then()`.
  Rep `tabId` (identificador numèric de la pestanya) i `elements` (array de
  descriptors actualitzats amb els nous valors).

[DEBUGGER] L:151-157 » MAP CONSTRUCTION — Agrupació d'elements per frameId
  `byFrame` és un `Map` (no un objecte pla) que agrupa els descriptors per `frameId`.
  S'usa `Map` en lloc d'un objecte pla `{}` perquè les claus de Map poden ser de
  qualsevol tipus (aquí números) i perquè `Map` és més adequat per a acumulació
  dinàmica de clau-valor.
  El patró "si no existeix, crea l'array; afegeix l'element" és el patró clàssic
  d'acumulació de grups. Alternativa moderna: `Map.prototype.set` amb `get(key) ?? []`,
  però el codi usa una verificació explícita amb `has` per claredat.

[DEBUGGER] L:159-233 » AWAIT PROMISE.ALL + MAP — Execució paral·lela per frame
  `Promise.all(...)` executa les injeccions a tots els frames en paral·lel (de manera
  concurrent). Alternativa: iterar amb `for...of` i `await` dins el bucle, que seria
  seqüencial i potencialment més lent si hi ha molts iframes.
  `Array.from(byFrame.entries())` converteix l'iterator del Map en array per poder
  aplicar-hi `.map(...)`.
  La destructuració `([frameId, frameEls])` extreu les dues parts de cada entrada del Map.

[DEBUGGER] L:161-163 » CHROME.SCRIPTING.EXECUTESCRIPT — Injecció al frame específic
  `chrome.scripting.executeScript` injecta la funció `func` al frame indicat per
  `frameIds: [frameId]`. Utilitzar `frameIds` en lloc d'`allFrames: true` és essencial
  aquí: cal aplicar cada grup de descriptors NOMÉS al frame on van ser trobats.
  `args: [frameEls]` és l'array d'arguments que es passarà a `func`. Sempre ha de ser
  un array, i el primer element (`frameEls`) es convertirà en el paràmetre `descriptors`.

[DEBUGGER] L:164-191 » INNER FUNCTION — `findElement`: localització d'elements dins del frame injectat
  `findElement` intenta trobar l'element al DOM del frame injectat a partir del
  descriptor `desc`. Primer intenta via `desc.domPath` (ràpid i precís).

  L:166-173: Try/catch al voltant de `document.querySelector(desc.domPath)` perquè el
  camí DOM generat podria haver quedat desfasat si el DOM ha canviat des de l'escaneig.
  El `catch` buit (sense paràmetre de captura, sintaxi ES2019 "optional catch binding")
  descarta silenciosament l'error i passa al fallback heurístic. El comentari explica
  l'intent explícitament.

  L:176-190: Fallback heurístic: recerca per combinació de tag + id + name + inputType.
  `Array.from(document.querySelectorAll(...)).find(...)` itera fins trobar el primer
  element que coincideixi en les quatre propietats. `|| null` garanteix que si `find`
  retorna `undefined` (cap coincidència), la funció retorna `null` explícitament.
  Cas límit: si hi ha múltiples elements amb el mateix tag/id/name/inputType, es pren
  el primer, que podria no ser el correcte.

[DEBUGGER] L:193-221 » INNER FUNCTION — `applyValue`: escriptura del valor en l'element
  `applyValue` gestiona l'assignació del valor a l'element DOM depenent del seu tipus.
  Replica parcialment la lògica de `getValue` però en sentit invers.

  L:202-203: Checkbox/radio: assigna `el.checked = value === 'true'`. La comparació
  amb el string 'true' (no amb booleà true) és consistent amb la serialització de
  `getValue`.

  L:204-205: Contenteditable: assigna `el.textContent = value`. Atés que `value` ja
  és el contingut desescapat (\\n convertit a \n per `parseTextValues`), els salts de
  línia s'inseriran correctament.

  L:206-210: Select: cerca una opció que coincideixi per `value` o per `text` (per
  si l'usuari ha canviat el text de l'opció al textarea en lloc del valor intern).
  Si no es troba cap opció coincident, s'assigna el valor directament a `el.value`,
  que pot resultar en una selecció invàlida (cap opció seleccionada en molts navegadors).

  L:211-213: Inputs de text, textarea: assignació directa a `el.value`.

  L:215-220: `dispatchEvent` — Dos events sintètics essencials:
  - `'input'`: l'event que s'envia quan l'usuari escriu al camp. Molts frameworks
    JavaScript (React, Vue, Angular) escolten aquest event per actualitzar el seu
    estat intern. Sense ell, la pàgina podria no "veure" el canvi.
  - `'change'`: l'event que s'envia quan l'element perd el focus amb un valor diferent.
    Alguns formularis validen o reaccionen a aquest event.
  `bubbles: true` fa que l'event pugi per l'arbre DOM, cosa necessària si els
  listeners estan en un element pare. `cancelable: true` permet que els listeners
  puguin cridar `preventDefault()`.

[DEBUGGER] L:223-228 » FOREACH — Aplicació dels descriptors al DOM del frame
  Itera sobre `descriptors` (l'array `frameEls` passat com a argument). Per cada
  descriptor, crida `findElement` per localitzar l'element i, si es troba, `applyValue`
  per escriure el valor. La condició `if (target)` evita errors si l'element ja no
  existeix al DOM.
```

---

## BLOC 7 — Funció `getActiveTab` (línies 236–242)

```javascript
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    throw new Error("No s'ha pogut obtenir la pestanya activa.");
  }
  return tab;
}
```

```
[DEBUGGER] L:236 » ASYNC FUNCTION DECLARATION — Obtenció de la pestanya activa
  `getActiveTab` és una petita funció utilitària asíncrona que encapsula la crida a
  `chrome.tabs.query`. Separar-la en una funció pròpia facilita el testing i la
  reutilització.

[DEBUGGER] L:237 » DESTRUCTURING + AWAIT — Extracció de la primera pestanya del resultat
  `chrome.tabs.query({ active: true, currentWindow: true })` retorna una Promise que
  resol a un array de pestanyes que compleixin els criteris. Amb `active: true` i
  `currentWindow: true` hauria de retornar exactament una pestanya (l'activa de la
  finestra on és obert el popup).
  `const [tab] = await ...` usa destructuració d'array per extreure el primer element.
  Si l'array és buit, `tab` serà `undefined`.

[DEBUGGER] L:238-240 » IF + THROW — Gestió d'errors de pestanya no disponible
  La comprovació `!tab || !tab.id` cobreix dos casos:
  - `!tab`: `query` ha retornat un array buit (cap pestanya activa, improbable però possible).
  - `!tab.id`: la pestanya existeix però no té ID assignat (podria passar en pestanyes
    especials com `chrome://` o `about:blank`).
  `throw new Error(...)` llança una excepció que serà capturada pel caller (`scan` o
  altres) en el seu bloc `catch`. El missatge és en català, coherent amb els altres
  missatges de la UI.
```

---

## BLOC 8 — Funció `init`: inicialització del popup i lligam d'events (línies 244–362)

```javascript
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
```

```
[DEBUGGER] L:244 » ASYNC FUNCTION DECLARATION — Funció principal d'inicialització del popup
  `init` és el punt d'entrada principal de la lògica del popup. Es declara `async` perquè
  conté operacions await internes (principalment la crida a `scan()`). Tota la lògica
  d'UI es tanca dins d'aquesta funció per evitar contaminar l'àmbit global amb variables
  com `textarea`, `currentElements`, etc.

[DEBUGGER] L:245-250 » CONST DECLARATIONS — Captura de referències als elements de la UI
  Sis constants capturen referències als elements HTML del popup per ID. S'usen
  `document.getElementById(...)` (no `querySelector`) per eficiència i claredat.
  - `textarea` (id: 'form-textarea'): el camp de text multilínia on es mostra i edita el text.
  - `statusEl` (id: 'status'): l'element que mostra el missatge d'estat ("Escanejant...", "3 camps trobats", etc.).
  - `refreshBtn` (id: 'refresh-btn'): el botó d'actualitzar/escanejar.
  - `applyBtn` (id: 'apply-btn'): el botó d'aplicar canvis al formulari.
  - `errorEl` (id: 'error'): l'element per mostrar missatges d'error.
  - `lineCountEl` (id: 'line-count'): l'element d'advertiment quan les línies no coincideixen.

[DEBUGGER] L:252-253 » LET DECLARATIONS — Estat mutable compartit per les funcions internes
  `currentElements` i `currentTab` formen l'estat mutable del popup.
  S'usen `let` perquè les seves referències canvien al llarg del cicle de vida.
  Es declaren a l'àmbit de `init` (no global) per evitar contaminació de l'àmbit global
  i per fer-los accessibles a totes les funcions internes (closures).
  `currentElements = []`: array dels descriptors més recentment escaneats.
  `currentTab = null`: referència a la pestanya activa actual.

[DEBUGGER] L:255-258 » INNER FUNCTION — `setStatus`: actualització de l'indicador d'estat
  `setStatus` modifica el text i la classe CSS de `statusEl`.
  `statusEl.textContent = text` és segur contra XSS (no interpreta HTML), a diferència
  de `innerHTML`.
  La classe CSS es construeix amb template literal: si `type` és undefined/null/cadena
  buida (falsy), la classe és simplement "status"; si hi ha tipus ('ok', 'scanning', etc.),
  la classe és "status ok" o "status scanning". Això permet aplicar estils visuals
  diferenciats per a cada estat.

[DEBUGGER] L:260-263 » INNER FUNCTION — `showError`: visualització de missatges d'error
  `showError` assigna el missatge i fa visible l'element d'error traient-li la propietat
  `hidden`. `errorEl.hidden = false` és equivalent a eliminar l'atribut `hidden` de l'HTML.
  L'ús de `.textContent` (no `.innerHTML`) és correcte per seguretat: el missatge
  d'error podria provenir d'una excepció amb contingut no confiable.

[DEBUGGER] L:265-267 » INNER FUNCTION — `hideError`: ocultació de l'element d'error
  Funció minimalista que oculta `errorEl` amb `hidden = true`. Separada de `showError`
  per seguir el principi de responsabilitat única i per poder cridar-la sola sense
  necessitat de passar un missatge buit.

[DEBUGGER] L:269-281 » INNER FUNCTION — `updateLineCountWarning`: advertiment de dessincronització
  Aquesta funció és el mecanisme de protecció contra edicions destructives del textarea.
  Si l'usuari afegeix o elimina línies, el nombre de línies del textarea deixa de
  coincidir amb el nombre d'elements escaneats, i el parsejament per índex fallaria.

  L:270-273: Si no hi ha elements (`currentElements.length === 0`), oculta l'avís i
  surt anticipadament amb `return`. Patró de "early return" per evitar anidament excessiu.

  L:274: `textarea.value.split('\n').length` compta les línies actuals. Nota: un textarea
  buit (`''`) té `split('\n').length === 1`, no 0, cosa que podria produir un fals positiu
  si `currentElements.length === 1`. En la pràctica, si hi ha elements i el textarea és buit,
  l'avís es mostraria incorrectament.

  L:276: El missatge usa caràcters Unicode directament (⚠) i és en català. El guió llarg
  (—) s'usa com a separador tipogràfic en el missatge.
```

---

## BLOC 9 — Funció `scan` i registre d'events (línies 283–323)

```javascript
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
```

```
[DEBUGGER] L:283 » ASYNC FUNCTION DECLARATION — Funció principal d'escaneig del formulari
  `scan` és el cor de la lògica del popup. S'executa en inicialitzar i cada vegada que
  l'usuari clica el botó de refresc. Es declara `async` perquè fa `await` sobre
  `getActiveTab()` i `executeScript`.

[DEBUGGER] L:284-290 » STATE RESET — Preparació de la UI per a l'escaneig
  Abans d'iniciar l'operació asíncrona, es restableix la UI a un estat net:
  - `hideError()`: elimina errors anteriors.
  - `lineCountEl.hidden = true`: oculta l'advertiment de línies.
  - `setStatus('Escanejant...', 'scanning')`: indicador visual d'activitat.
  - `textarea.value = ''`: neteja el contingut anterior.
  - `textarea.disabled = true`: desactiva l'edició mentre s'escaneja.
  - `applyBtn.disabled = true` i `refreshBtn.disabled = true`: prevenen dobles clics
    mentre l'operació és en curs. Patró defensiu essencial per a operacions asíncrones.

[DEBUGGER] L:292-297 » TRY BLOCK — Execució de l'escaneig
  El bloc `try` encapsula totes les operacions que podrien fallar (crida de xarxa,
  permís denegat, pestanya sense accés).
  `currentTab = await getActiveTab()` obté i emmagatzema la pestanya activa en la
  variable de clausura `currentTab`, accessible posteriorment al handler d'apply.
  `chrome.scripting.executeScript` amb `allFrames: true` injecta `collectFormElements`
  a TOTS els frames de la pestanya (frame principal + iframes). Retorna un array de
  resultats, un per frame.

[DEBUGGER] L:298 » ASSIGNMENT — Actualització de l'estat intern
  `currentElements = aggregateResults(results)` aplana els resultats multi-frame i
  actualitza l'estat de clausura `currentElements`. A partir d'aquest moment, tota
  la lògica del popup treballa amb aquesta llista aplanada.

[DEBUGGER] L:300-311 » CONDITIONAL — Branques de resultat buit vs elements trobats
  Si `currentElements.length === 0`, mostra un missatge informatiu i deixa el textarea
  buit. `applyBtn` es manté desactivat (no hi ha res a aplicar).

  Si hi ha elements, calcula `n` i construeix un missatge en català amb concordança
  gramatical: `camp${n !== 1 ? 's' : ''}` i `trobat${n !== 1 ? 's' : ''}` apliquen
  la desinència plural/singular. Per a n=1: "1 camp trobat"; per a n>1: "3 camps trobats".
  Després escriu el text al `textarea` i activa `applyBtn`.

[DEBUGGER] L:312-314 » CATCH BLOCK — Gestió d'errors d'escaneig
  Captura qualsevol error (de `getActiveTab` o d'`executeScript`). Mostra el missatge
  d'estat d'error i visualitza el missatge detallat via `showError(err.message)`.
  `err.message` és la propietat estàndard dels objectes `Error`.

[DEBUGGER] L:315-318 » FINALLY BLOCK — Restauració de la UI
  El bloc `finally` s'executa sempre (amb èxit o error), garantint que `textarea` i
  `refreshBtn` es reactiven. Sense `finally`, un error podria deixar la UI bloquejada
  permanentment amb botons desactivats.
  Nota: `applyBtn` NO es reactiva aquí (perquè depèn de si s'han trobat elements, lògica
  gestionada al bloc `try`).

[DEBUGGER] L:321 » ADD EVENT LISTENER — Detecció de canvis al textarea
  `textarea.addEventListener('input', updateLineCountWarning)` registra el listener
  per a l'event 'input', que es dispara en cada keystroke. Alternatiu seria 'change'
  (que es dispara en perdre el focus), però 'input' ofereix feedback immediat.

[DEBUGGER] L:323 » ADD EVENT LISTENER — Botó de refresc
  Lliga el clic de `refreshBtn` directament a la referència de la funció `scan`
  (sense wrapper). Donat que `scan` és una funció asíncrona, el resultat de la crida
  (una Promise) es descarta silenciosament, cosa acceptable perquè tota la gestió
  d'errors es fa internament a `scan`.
```

---

## BLOC 10 — Handler del botó apply i crida inicial a scan (línies 325–362)

```javascript
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
```

```
[DEBUGGER] L:325 » ADD EVENT LISTENER + ASYNC ARROW FUNCTION — Handler asíncron del botó apply
  `applyBtn.addEventListener('click', async () => { ... })` registra un handler
  asíncron. S'usa una arrow function anònima (no la referència a una funció nomenada)
  perquè el callback no es necessita referenciar externament.
  L'arrow function no té el seu propi `this`, però aquí no és rellevant perquè no s'usa
  `this` al handler.

[DEBUGGER] L:326-328 » EARLY RETURN — Guarda de precondicions
  Si no hi ha elements escaneats o no hi ha pestanya activa, el handler surt immediatament
  sense fer res. Aquesta guarda és una defensa contra l'estat inconsistent: teòricament
  `applyBtn` estaria desactivat en aquest cas, però la guarda és una mesura extra de seguretat.

[DEBUGGER] L:330 » CALL — Neteja d'errors anteriors
  `hideError()` neteja qualsevol error mostrat d'una operació anterior. Bona pràctica
  per evitar que errors anteriors es vegin mentre es processa una nova acció.

[DEBUGGER] L:332-339 » VALIDATION — Comprovació de concordança de línies
  `textarea.value.split('\n')` torna a partir les línies per validar. Si el nombre de
  línies difereix del nombre d'elements, s'atura l'operació amb un missatge d'error
  explicatiu en català. El missatge inclou els dos valors concrets per ajudar l'usuari
  a entendre el problema i li indica l'acció a prendre ("Fes clic a Actualitzar").
  La concatenació amb `+` a través de múltiples línies (+ al final de la primera, string
  continua a la següent) és una manera de partir strings llargs respectant el límit de
  80 caràcters del projecte.

[DEBUGGER] L:341-342 » DISABLE BUTTONS — Prevenció de dobles clics durant l'apply
  Igual que a `scan`, es desactiven els dos botons durant l'operació asíncrona per
  evitar condicions de carrera (race conditions) que podrien produir estats inconsistents.

[DEBUGGER] L:344-358 » TRY/CATCH/FINALLY — Aplicació dels canvis amb gestió d'errors
  L:345: `parseTextValues(textarea.value, currentElements)` parseja el textarea i
  crea `updated`, el nou array de descriptors amb els valors actualitzats. Aquesta
  operació és síncrona i no llança errors en condicions normals.

  L:346: `await applyElementsToPage(currentTab.id, updated)` executa la injecció
  als frames. Pot fallar si la pestanya s'ha tancat, si el DOM ha canviat, o si
  hi ha errors de permisos.

  L:347: `currentElements = updated` actualitza l'estat intern amb els nous valors.
  Això és important: si l'usuari aplica i torna a aplicar, els valors base de comparació
  seran els de l'última aplicació, no els de l'escaneig original.

  L:348-352: Missatge d'èxit en català amb concordança gramatical plural/singular,
  idèntic al patró de `scan`.

  L:353-355: `catch (err)`: mostra l'error però NO restableix l'estat d'UI complet
  (no crida `setStatus`), perquè el contingut del textarea i `currentElements` podrien
  estar en un estat parcialment aplicat i és millor no confondre l'usuari amb un
  missatge d'estat d'escaneig.

  L:356-358: `finally`: reactiva ambdós botons independentment del resultat.

[DEBUGGER] L:361 » AWAIT SCAN() — Escaneig automàtic en inicialitzar
  `await scan()` al final de `init` executa un escaneig automàtic quan s'obre el
  popup, sense que l'usuari hagi de clicar cap botó. L'`await` garanteix que `init`
  no acabi fins que el primer escaneig hagi completat (o fallat).

[DEBUGGER] L:362 » CLOSING BRACE — Tancament de `init`
  Tanca el cos de la funció `init` declarada a la línia 244.
```

---

## BLOC 11 — Punt d'entrada: `DOMContentLoaded` (línies 364–371)

```javascript
document.addEventListener('DOMContentLoaded', () => {
  init().catch((err) => {
    const errorEl = document.getElementById('error');
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  });
});
```

```
[DEBUGGER] L:364 » ADD EVENT LISTENER — Punt d'entrada protegit per DOMContentLoaded
  `document.addEventListener('DOMContentLoaded', ...)` garanteix que el codi s'executi
  NOMÉS quan el DOM del popup estigui completament analitzat i tots els elements HTML
  estiguin disponibles. Sense aquest guard, `document.getElementById(...)` dins de `init`
  podria retornar null si el script s'executa abans que els elements existeixin.
  En popups de Chrome Extension, el navegador analitza l'HTML i executa els scripts en
  ordre, però és bona pràctica (i a vegades necessari) esperar a DOMContentLoaded.

[DEBUGGER] L:365-369 » INIT CALL + PROMISE CATCH — Gestió d'errors no capturats d'init
  `init()` retorna una Promise (és una async function). Si la Promise és rebutjada per
  una raó no capturada internament a `init` (un error molt inesperat), el `.catch(...)`
  la captura i la mostra a l'usuari via `errorEl`.
  Dins del `.catch`, es torna a fer `document.getElementById('error')` en lloc d'usar
  la variable `errorEl` de `init`. Això és necessari perquè el closure de `.catch`
  no té accés a les variables locals d'`init` (que no ha completat), però sí al DOM global.
  `errorEl.textContent = err.message` i `errorEl.hidden = false` mostren el missatge
  d'error directament, sense cridar `showError` (que pertany a l'àmbit d'`init`).

[DEBUGGER] L:370 » CLOSING BRACE — Tancament del callback de DOMContentLoaded
  Tanca l'arrow function passada com a callback al listener.

[DEBUGGER] L:371 » END OF FILE — Última línia del fitxer
  Tanca l'estructura del script. No hi ha cap codi a l'àmbit global excepte
  les declaracions de funcions (`collectFormElements`, `aggregateResults`,
  `formatElementsAsText`, `parseTextValues`, `applyElementsToPage`, `getActiveTab`,
  `init`) i el listener `DOMContentLoaded`. Aquesta arquitectura manté l'àmbit
  global net i evita col·lisions de noms.
```

---

```
[DEBUGGER] Anàlisi completada. Total d'instruccions analitzades: 371 línies.
[DEBUGGER] Fi de la sessió de depuració.
```
