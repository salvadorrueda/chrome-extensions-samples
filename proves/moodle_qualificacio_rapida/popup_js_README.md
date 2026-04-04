# `popup.js` — Lògica del popup per analitzar i omplir camps d'entrada d'una pàgina web

## Descripció (Description)

Aquest script és el controlador del popup d'una extensió de Chrome (Manifest V3) anomenada "Analitzador d'Elements Clicables". Resol el problema d'identificar visualment i de forma massiva tots els camps d'entrada d'una pàgina web —incloent iframes— i permet editar-ne els valors de manera centralitzada. S'executa en el context del popup (`popup.html`) quan l'usuari obre l'extensió des de la barra d'eines del navegador. A alt nivell, coordina la injecció d'un script de contingut (`content.js`) a la pestanya activa, recull els descriptors dels elements ressaltats, els presenta al popup, i permet aplicar nous valors als camps directament des d'un textarea d'edició massiva.

## Prerequisits (Prerequisites)

- Google Chrome amb suport per a **Manifest V3** (Chrome 88+).
- El fitxer `content.js` ha d'existir al directori de l'extensió i ser accessible com a recurs injectables (no cal declarar-lo a `web_accessible_resources` perquè s'injecta via `chrome.scripting.executeScript`).
- El fitxer `manifest.json` ha de declarar els permisos `"activeTab"` i `"scripting"`.
- El popup `popup.html` ha d'exposar els elements DOM amb els IDs: `toggle-input-btn`, `apply-input-values-btn`, `input-values-textarea`, `input-status`, `input-results`, `input-element-count`, `input-elements-list`, `input-counts`, i els parells `row-{key}` / `cnt-{key}` per a cada categoria (`text`, `number`, `textarea`, `select`, `contenteditable`).
- La pàgina analitzada ha de ser accessible per a l'extensió (no hi ha restriccions de `Content-Security-Policy` que bloquegin la injecció de scripts).

## Ús (Usage)

```
[Clic a la icona de l'extensió al navegador]
```

El script no s'invoca directament per línia de comandes. S'executa automàticament quan el navegador carrega `popup.html` com a popup de l'extensió. Tota la interacció és a través dels botons del popup.

## Paràmetres i opcions (Parameters and Options)

Aquest script no accepta paràmetres. La interacció és exclusivament via els controls de la interfície d'usuari del popup:

| Opció                            | Argument                        | Per defecte                      | Descripció                                                                                                              |
| -------------------------------- | ------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Botó `toggle-input-btn`          | —                               | `'Highlight Input Fields'`       | Activa o desactiva el ressaltat de camps d'entrada a la pàgina. En estat actiu, el text canvia a `'Remove Highlights'`. |
| Botó `apply-input-values-btn`    | —                               | ocult fins activar l'analitzador | Aplica els valors editats al textarea `input-values-textarea` als camps d'entrada de la pàgina.                         |
| Textarea `input-values-textarea` | Text lliure, una línia per camp | buit                             | Permet editar massivament els valors dels camps. El format de cada línia és `identificador: valor`.                     |

## Exemples (Examples)

```bash
# Cas bàsic — ressaltar tots els camps d'entrada de la pàgina activa
# 1. Obrir l'extensió fent clic a la icona a la barra d'eines de Chrome
# 2. Clicar el botó "Highlight Input Fields"
# Resultat: els camps queden ressaltats i el popup mostra el recompte per categoria
```

```bash
# Editar valors massivament i aplicar-los
# 1. Amb l'analitzador actiu, editar el textarea "Valors dels inputs":
#    #username: joan.puig
#    [name="password"]: 1234
#    form:nth-of-type(1) > input:nth-of-type(3): valor_exemple
# 2. Clicar "Aplicar valors als inputs"
# Resultat: els camps de la pàgina s'actualitzen amb els nous valors i es disparen els events input/change
```

```bash
# Desactivar el ressaltat un cop analitzada la pàgina
# 1. Amb l'analitzador actiu, clicar el botó "Remove Highlights"
# Resultat: s'eliminen les marques visuals, el recompte desapareix i el textarea es buida
```

```bash
# Analitzar una pàgina amb iframes (p.ex. Moodle amb editors TinyMCE)
# 1. Navegar a una pàgina de qualificació de Moodle
# 2. Obrir l'extensió i clicar "Highlight Input Fields"
# Resultat: els camps dins iframes s'analitzen separadament (frameId != 0) i s'agreguen al llistat total
```

## Flux d'execució (Execution Flow)

1. El DOM de `popup.html` acaba de carregar i es crida `initInputAnalyzer()`.
2. Es consulta la pestanya activa amb `getActiveTab()` via `chrome.tabs.query`.
3. Es consulta l'estat actual de l'analitzador a tots els frames de la pestanya amb `queryInputAnalyzerState(tabId)`, injectant codi inline que cerca elements amb l'atribut `data-input-analyzer-type`.
4. Els resultats de tots els frames s'agreguen i es desduplicen a `aggregateInputAnalyzerResults()`.
5. La interfície s'actualitza amb `updateInputAnalyzerUi()` reflectint si l'analitzador és actiu, el recompte per categoria i la llista d'elements.
6. Si l'usuari clica `toggle-input-btn`, s'injecta la variable `window.__inputAnalyzerMode` (`'add'` o `'remove'`) a tots els frames i s'executa `content.js`, que s'encarrega de ressaltar o eliminar el ressaltat.
7. Els resultats retornats per `content.js` s'agreguen de nou i s'actualitza la UI.
8. Si l'usuari modifica el textarea i clica `apply-input-values-btn`, es parsegen les línies amb `parseTextareaInputValues()` extraient el valor après del separador `': '`.
9. Els elements s'agrupen per `frameId` i s'injecta codi a cada frame per localitzar cada camp (primer per `domPath`, després per coincidència de `tag`+`id`+`name`+`inputType`) i assignar-li el nou valor.
10. Es disparen els events `input` i `change` per a cada camp modificat, i la UI s'actualitza amb el recompte d'elements actualitzats.

## Fitxers generats / modificats (Files Created or Modified)

- `popup.js` — **[llegeix]** carregat pel navegador com a script del popup de l'extensió.
- `popup.html` — **[llegeix]** proporciona l'estructura DOM que `popup.js` manipula.
- `content.js` — **[llegeix]** injectat a la pestanya activa quan l'usuari commuta el ressaltat; retorna l'estat dels elements ressaltats.
- DOM de la pàgina web activa — **[modifica]** s'assignen valors als camps `input`, `textarea`, `select` i `contenteditable` quan s'apliquen els valors, i es disparen events `input`/`change`.
- `window.__inputAnalyzerMode` (variable global de la pàgina) — **[modifica]** s'escriu `'add'` o `'remove'` per comunicar el mode a `content.js` abans d'injectar-lo.

## Propostes de millora (Improvement Proposals)

1. **L:403–419 — `applyInputValuesToPage`: resultats d'error ignorats silenciosament.** La funció que aplica valors retorna un array de `{ success, identifier }` per cada descriptor, però `applyInputValuesToPage` no retorna ni inspecciona aquests resultats. Si un camp no es troba, el fallada passa desapercebuda. Cal recollir els retorns de `Promise.all`, filtrar els `{ success: false }` i mostrar-los a l'usuari (p.ex. afegint-los al `statusEl`).

2. **L:304–319 — `parseTextareaInputValues`: acoblament posicional fràgil.** El mapeig entre línies del textarea i elements es fa per índex (`lines[index]`). Si l'usuari insereix o elimina una línia, tots els valors posteriors queden desplaçats i s'apliquen al camp incorrecte. Cal canviar l'estratègia per analitzar l'identificador de cada línia (el text abans de `': '`) i cercar l'element corresponent pel seu identificador, en lloc de per posició.

3. **L:451–454 — `initInputAnalyzer` toggle: `content.js` reinjectat sense versió.** Cada cop que l'usuari clica `toggle-input-btn`, `content.js` s'injecta de nou a tots els frames sense comprovar si ja hi és actiu. Depenent de com estigui implementat `content.js`, pot acumular listeners o efectes secundaris. Cal afegir una guarda amb `window.__inputAnalyzerInitialized` a `content.js` o comprovar l'estat abans d'injectar.

4. **L:22–119 — `queryInputAnalyzerState`: lògica de negoci injectada com a funció inline.** La funció `func` passada a `chrome.scripting.executeScript` és una closure complexa amb quatre funcions anidades (`compactText`, `getDomPath`, `describeInput` i la lògica principal). Això fa que sigui impossible fer-ne proves unitàries. Cal extreure aquesta lògica a `content.js` com a funció exportada/cridable per missatge, i comunicar-se via `chrome.tabs.sendMessage`.

5. **L:155–169 — `aggregateInputAnalyzerResults`: clau de deduplicació inclou `value`.** La clau única per detectar elements duplicats entre frames inclou el camp `value` actual de l'element. Si dos frames contenen elements idèntics però amb valors diferents, ambdós es consideraran únics, però si el mateix element té el valor buit en dos frames, es deduplicarà incorrectament. Cal excloure `value` i `text` de la clau de deduplicació i basar-la únicament en propietats estructurals (`frameId`, `domPath`, `id`, `name`, `tag`, `inputType`).

6. **L:337–346 — `getElementByDomPath`: `document.querySelector` amb rutes generades per `getDomPath` pot fallar.** La ruta DOM generada inclou selectors com `form:nth-of-type(1) > div:nth-of-type(3) > input:nth-of-type(1)`, que no és un selector CSS estàndard vàlid en tots els contextos (`:nth-of-type` compta per tipus de tag, no per posició general). Si la pàgina ha canviat des de la consulta inicial, el selector pot seleccionar un element incorrecte. Cal afegir validació del resultat (comprovar que el `tag`, `id` i `name` de l'element trobat coincideixen amb el descriptor) abans d'usar-lo.

7. **L:497–502 — `DOMContentLoaded`: errors mostrats sense distinció de tipus.** El `catch` final mostra `error.message` al `#input-status`, però errors de permisos de Chrome (p.ex. si la pestanya activa és `chrome://extensions`) mostren missatges tècnics en anglès poc comprensibles per a l'usuari. Cal afegir detecció de codis d'error específics de l'API de Chrome (p.ex. comprovant si la URL de la pestanya comença per `chrome://` o `edge://`) i mostrar un missatge localitzat en català.
