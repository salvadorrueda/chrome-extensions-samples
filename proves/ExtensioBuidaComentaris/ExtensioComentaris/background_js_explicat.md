# Anàlisi línia a línia: `background.js`

**Debugger estàtic — mode explicació exhaustiva**

---

```
[DEBUGGER] Carregant script per analitzar: /home/salvadorrueda/Developer/chrome-extensions-samples/proves/ExtensioBuidaComentaris/ExtensioComentaris/background.js
[DEBUGGER] Total de línies: 92
[DEBUGGER] Intèrpret detectat: javascript
[DEBUGGER] Iniciant anàlisi seqüencial...
```

---

## BLOC 1 — Declaració global i capçalera de la funció injectada (línies 1–4)

```javascript
/* global angular */
// Aquesta funció s'injectarà i s'executarà directament a la pàgina
async function scriptPerInjectar(nouText) {
  let tipusPaginaGrupMateriaa = false;
```

```
[DEBUGGER] L:1 » COMENTARI DE LINT — Declaració de global per a ESLint
  La directiva `/* global angular */` és una instrucció especial per a ESLint (i eines compatibles
  com JSHint). Li indica a l'analitzador estàtic que la variable `angular` és una variable global
  que existirà en temps d'execució (proveïda per la pàgina web de destí), de manera que no ha de
  generar l'error "angular is not defined".
  Aquesta directiva NO té cap efecte en temps d'execució del navegador: és purament un mecanisme
  de supressió d'advertències per a eines de qualitat de codi.
  L'alternativa seria usar `typeof angular !== 'undefined'` en cada ús (cosa que de fet sí es fa
  a les línies 37 i 53), però la directiva global centralitza la declaració.

[DEBUGGER] L:2 » COMENTARI — Descripció d'intenció de la funció
  El comentari explica la raó d'existència de la funció: no s'executa des del context del service
  worker (background), sinó que serà serialitzada i injectada a la pàgina web activa.
  Això és rellevant perquè `scriptPerInjectar` no pot fer servir cap variable del context del
  background script: el motor V8 la serialitza i la re-executa en un context completament diferent.

[DEBUGGER] L:3 » DECLARACIÓ DE FUNCIÓ ASYNC — `async function scriptPerInjectar(nouText)`
  La paraula clau `async` declara la funció com a asíncrona. Això implica dues coses:
    1. La funció retorna sempre una Promise implícita, independentment del valor de retorn.
    2. Dins la funció es pot usar `await` per pausar l'execució fins que una Promise es resolgui,
       sense bloquejar el fil principal.
  El paràmetre `nouText` és el text que es passarà a cada camp de comentaris. Rep el seu valor
  des del camp `args` de `chrome.scripting.executeScript` a la línia 88.
  Alternativa: una funció regular retornant una Promise manualment (`.then()/.catch()`), però
  `async/await` és més llegible per a fluxos seqüencials amb múltiples esperes.

[DEBUGGER] L:4 » DECLARACIÓ DE VARIABLE — `let tipusPaginaGrupMateriaa = false`
  `let` declara una variable amb àmbit de bloc (block scope). El valor inicial `false` indica que
  per defecte s'assumeix que la pàgina és del tipus "continguts" (no de grup/matèria).
  Observació ortogràfica: el nom conté una doble 'a' al final (`Materiaa`) que sembla un error
  tipogràfic, però no afecta la funcionalitat perquè JavaScript és sensible a majúscules/minúscules
  i el nom es fa servir de forma consistent al llarg de la funció.
  Alternativa a `let`: `const` no seria vàlid aquí perquè el valor canvia a la línia 18.
  `var` hauria funcionat però amb àmbit de funció en lloc de bloc, cosa considerada una mala
  pràctica en JavaScript modern (prohibida per ESLint en aquest projecte).
```

---

## BLOC 2 — Selecció i filtratge dels botons de tipus "continguts" (línies 5–12)

```javascript
let botons = Array.from(
  document.querySelectorAll('a[data-ng-click*="showCommentsContingutsModal"]')
).filter(
  (boto) =>
    !boto.classList.contains('emptyIcon') &&
    !boto.hasAttribute('disabled') &&
    boto.getAttribute('data-ng-disabled') !== 'true'
);
```

```
[DEBUGGER] L:5-6 » SELECCIÓ DOM — `document.querySelectorAll` amb selector d'atribut CSS
  `document.querySelectorAll('a[data-ng-click*="showCommentsContingutsModal"]')` selecciona
  tots els elements `<a>` del DOM que tinguin l'atribut `data-ng-click` que contingui (operador
  `*=`) la cadena "showCommentsContingutsModal".
  `data-ng-click` és un atribut de la directiva AngularJS (Angular 1.x) que defineix l'acció
  a executar quan l'usuari fa clic. L'ús de `*=` (substring match) és deliberat per capturar
  variacions del nom del handler (per exemple, si inclou paràmetres addicionals).
  `querySelectorAll` retorna una NodeList, que és una col·lecció semblant a un array però sense
  tots els mètodes d'Array. Per això es necessita la conversió de la línia 5.

[DEBUGGER] L:5 » CONVERSIÓ DE TIPUS — `Array.from(NodeList)`
  `Array.from()` converteix la NodeList retornada per `querySelectorAll` en un Array de JavaScript
  natiu. Això és necessari per poder encadenar `.filter()` a continuació.
  Alternativa equivalent: l'operador spread `[...document.querySelectorAll(...)]`. Tots dos
  produeixen el mateix resultat; `Array.from()` és lleugerament més explícit en la intenció.

[DEBUGGER] L:7-12 » FILTRATGE — `.filter()` amb tres condicions
  El mètode `.filter()` retorna un nou Array que només conté els elements per als quals la funció
  de callback retorna `true`. La funció és una arrow function `(boto) => ...` que avalua tres
  condicions combinades amb l'operador lògic AND (`&&`):

  Condició 1 — `!boto.classList.contains('emptyIcon')` (L:9):
    Exclou els botons que tinguin la classe CSS `emptyIcon`. En el context de l'aplicació de
    destí, aquesta classe indica que el botó és un marcador de posició buit sense funcionalitat
    real (alumne sense comentari previ o desactivat visualment).

  Condició 2 — `!boto.hasAttribute('disabled')` (L:10):
    Exclou els botons que tinguin l'atribut HTML natiu `disabled`. Un element `<a>` amb `disabled`
    no hauria de ser interactuable. Cal notar que `disabled` és un atribut vàlid per a `<input>`,
    `<button>`, etc., però no és estàndard per a `<a>`. L'aplicació Angular el fa servir de
    manera no estàndard per desactivar enllaços.

  Condició 3 — `boto.getAttribute('data-ng-disabled') !== 'true'` (L:11):
    Exclou els botons on l'atribut AngularJS `data-ng-disabled` tingui el valor textual `'true'`.
    Quan AngularJS avalua la directiva `ng-disabled` i la condició és certa, escriu l'atribut
    `disabled` al DOM, però durant la renderització inicial pot existir `data-ng-disabled="true"`
    sense que l'atribut `disabled` ja estigui present. Aquesta condició cobreix aquest cas de
    carrera (race condition).
    Nota: `getAttribute` retorna sempre una cadena de text o `null`, mai un booleà. Per tant,
    la comparació correcta és amb la cadena `'true'`, no amb el booleà `true`.

  El resultat és un Array `botons` que conté només els elements <a> actius i accionables.
```

---

## BLOC 3 — Lògica de fallback per a pàgines de grup/matèria i validació (línies 13–23)

```javascript
if (botons.length === 0) {
  console.log('Provo a recuperar els de grup i matèria.');
  botons = Array.from(
    document.querySelectorAll('a[data-ng-click*="showDialogMoreOptions"]')
  ).filter((boto) => !boto.classList.contains('emptyIcon'));
  tipusPaginaGrupMateriaa = true;
}
if (botons.length === 0) {
  alert("No s'han trobat botons actius.");
  return;
}
```

```
[DEBUGGER] L:13 » CONDICIÓ — `if (botons.length === 0)`
  Comprova si l'Array `botons` és buit, és a dir, si no s'han trobat botons del tipus
  "continguts". L'operador `===` és l'igualtat estricta (comprova valor I tipus), que és
  preferible a `==` perquè evita coercions de tipus implícites com `0 == false` (cert amb `==`,
  fals amb `===`).

[DEBUGGER] L:14 » DIAGNÒSTIC — `console.log`
  Escriu un missatge informatiu a la consola del navegador (context de la pàgina injectada,
  visible des de DevTools de la pàgina). És útil per a depurar en quins casos s'activa el camí
  alternatiu. En producció, aquest `console.log` hauria de ser eliminat o substituït per
  `console.debug`, però en extensions personals de depuració és una pràctica habitual.

[DEBUGGER] L:15-17 » FALLBACK — Selecció alternativa de botons per a pàgines de grup/matèria
  Si no s'han trobat botons del primer tipus, es prova amb un selector diferent:
  `a[data-ng-click*="showDialogMoreOptions"]`. Aquest selector apunta a un handler Angular
  diferent que s'usa en la vista de grup/matèria de l'aplicació de destí.
  El filtre és més simple: només exclou els botons amb classe `emptyIcon`, sense verificar
  `disabled` ni `data-ng-disabled`. Això pot ser intencionat (el comportament de l'app és
  diferent en aquest tipus de pàgina) o una simplificació.
  `botons` es reasigna (possible gràcies a `let` a la L:5; amb `const` hauria donat error).

[DEBUGGER] L:18 » ASSIGNACIÓ — `tipusPaginaGrupMateriaa = true`
  Marca que s'ha activat el camí de fallback. Aquesta variable bandera (flag) es consultarà
  dins el bucle de la línia 30 per decidir quins selectors CSS i quins camps Angular usar
  en cada iteració. És un patró clàssic de discriminació de casos sense refactoritzar en
  dues funcions separades.

[DEBUGGER] L:20-23 » GUARD CLAUSE — Sortida anticipada si no hi ha botons
  Un segon `if (botons.length === 0)` comprova si tampoc el fallback ha retornat resultats.
  En cas afirmatiu:
    - `alert(...)` mostra un diàleg modal bloquejant a l'usuari. En el context de la pàgina
      injectada, `alert` és la funció nativa del navegador, que bloqueja el fil de renderització
      fins que l'usuari fa clic a "Acceptar".
    - `return` surt de `scriptPerInjectar` sense executar el bucle. Com que la funció és
      `async`, el `return` implícitament resol la Promise retornada amb `undefined`.
  Alternativa: llançar una excepció amb `throw new Error(...)` per propagar l'error cap al
  context del background, però `alert` és suficient per a la UX d'una extensió personal.
```

---

## BLOC 4 — Bucle principal d'iteració sobre botons i interacció amb modals (línies 25–67)

```javascript
  for (let i = 0; i < botons.length; i++) {
    botons[i].click();

    // Espera que el modal es carregi
    await new Promise((r) => setTimeout(r, 1200));
    if (!tipusPaginaGrupMateriaa) {
      const textarea = document.querySelector(
        'textarea[data-ng-model="modalComentaris.comentaris"]'
      );
      const botoDesa = document.querySelector(
        'a[data-ng-click*="saveComentariContingut"]'
      );
      if (textarea && typeof angular !== 'undefined') {
        const scope = angular.element(textarea).scope();
        if (scope && scope.modalComentaris) {
          scope.$apply(() => {
            scope.modalComentaris.comentaris = nouText;
          });

          await new Promise((r) => setTimeout(r, 500));
          if (botoDesa) botoDesa.click();
        }
      }
    } else {
      const textarea = document.querySelector(
        'textarea[data-ng-model="commentsToModify.commentsToModifyModal"]'
      );
      const botoDesa = document.querySelector('a[data-ng-click*="modalSave"]');
      if (textarea && typeof angular !== 'undefined') {
        const scope = angular.element(textarea).scope();
        if (scope && scope.commentsToModify) {
          scope.$apply(() => {
            scope.commentsToModify.commentsToModifyModal = nouText;
          });

          await new Promise((r) => setTimeout(r, 500));
          if (botoDesa) botoDesa.click();
        }
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }
  alert('Procés finalitzat!');
}
```

```
[DEBUGGER] L:25 » BUCLE — `for (let i = 0; i < botons.length; i++)`
  Un bucle `for` clàssic amb tres parts: inicialització (`let i = 0`), condició de continuació
  (`i < botons.length`) i increment (`i++`).
  L'ús de `let` per a `i` garanteix que la variable és local al bloc del bucle (block scope).
  S'ha triat un `for` indexat en lloc de `for...of` o `.forEach()` per raons importants:
    - `for...of` hauria funcionat igualment aquí.
    - `.forEach()` NO admet `await` de forma nativa; una arrow function asíncrona dins
      `.forEach()` crea Promises no gestionades i les iteracions s'executen en paral·lel,
      trencant la seqüencialitat necessària per obrir i tancar modals un a un.
  Per tant, el `for` indexat és l'elecció correcta per garantir que cada modal s'obre, s'omple
  i es tanca ABANS de passar al següent alumne.

[DEBUGGER] L:26 » CLIC — `botons[i].click()`
  Dispara programàticament l'event `click` sobre l'element `<a>` de l'índex `i`. Això fa que
  AngularJS executi el handler definit a `data-ng-click` (per exemple, `showCommentsContingutsModal`),
  que en la pàgina de destí obre un diàleg modal.
  El clic és síncron (l'event es despatxa immediatament), però l'obertura del modal pot implicar
  una operació asíncrona d'Angular ($digest cycle, animació CSS), d'on la necessitat de l'espera
  de la línia 29.

[DEBUGGER] L:28 » COMENTARI — "Espera que el modal es carregi"
  Comentari en línia que explica el propòsit del `await` següent. És un comentari precís i
  directament útil per a qui llegeix el codi.

[DEBUGGER] L:29 » ESPERA TEMPORAL — `await new Promise((r) => setTimeout(r, 1200))`
  Patró idiomàtic per crear una pausa asíncrona sense bloquejar el fil principal:
    1. `new Promise((r) => setTimeout(r, 1200))` crea una Promise que es resol automàticament
       al cap de 1200 mil·lisegons (1,2 segons) cridant `r` (la funció resolve).
    2. `await` suspèn l'execució de `scriptPerInjectar` fins que aquesta Promise es resol,
       permetent que el navegador processi events (incloent l'obertura del modal d'Angular).
  El valor de 1200 ms és una heurística: prou temps perquè el modal s'obri i Angular renderitzi
  el camp `<textarea>`. Si la xarxa o el dispositiu van lents, pot ser insuficient.
  Risc: si el modal no s'ha obert en 1200 ms, els selectors de la línia 31 retornaran `null`
  i la condició de la línia 37 fallirà silenciosament sense desar el comentari.

[DEBUGGER] L:30 » BIFURCACIÓ — `if (!tipusPaginaGrupMateriaa)`
  Discrimina entre els dos tipus de pàgina usant la bandera establerta prèviament.
  `!tipusPaginaGrupMateriaa` és `true` quan estem a la pàgina de "continguts" (cas per defecte).
  L'operador `!` (NOT lògic) inverteix el booleà.

[DEBUGGER] L:31-32 » SELECCIÓ DOM — `textarea[data-ng-model="modalComentaris.comentaris"]`
  Selecciona el primer element `<textarea>` del DOM que tingui l'atribut `data-ng-model` exacte
  `"modalComentaris.comentaris"`. `querySelector` retorna el primer element coincident o `null`.
  `data-ng-model` és la directiva AngularJS que crea un binding bidireccional entre el camp de
  formulari i una propietat de l'$scope. La notació `"modalComentaris.comentaris"` indica que
  el valor es troba a `$scope.modalComentaris.comentaris` (objecte imbricat).

[DEBUGGER] L:34-36 » SELECCIÓ DOM — `a[data-ng-click*="saveComentariContingut"]`
  Selecciona el botó de desar del modal de continguts. Usa `*=` (substring match) per capturar
  possibles variacions del handler. Es desa a `botoDesa` per fer-hi clic després d'actualitzar
  el model Angular.

[DEBUGGER] L:37 » DOBLE GUARD — `if (textarea && typeof angular !== 'undefined')`
  Dues condicions de seguretat combinades amb `&&`:
    1. `textarea`: comprova que `querySelector` no ha retornat `null`. Si el modal no s'ha obert
       correctament, `textarea` serà `null`, i avaluar `null` com a booleà és `false`, de manera
       que es salta el bloc sense error.
    2. `typeof angular !== 'undefined'`: comprova que la biblioteca AngularJS estigui carregada
       a la pàgina. L'ús de `typeof` és l'únic mètode segur per verificar una variable global
       que podria no existir: accedir directament a `angular` quan no existeix llançaria un
       `ReferenceError`. La directiva `/* global angular */` de la L:1 evita que ESLint avisi
       d'un possible ús d'una variable no declarada.

[DEBUGGER] L:38 » ACCÉS A L'SCOPE D'ANGULAR — `angular.element(textarea).scope()`
  Aquesta és la línia clau per interactuar amb AngularJS des de codi extern:
    - `angular.element(textarea)` embolica el node DOM en un objecte jqLite (implementació
      lleugera de jQuery inclosa a AngularJS), que exposa l'API d'Angular.
    - `.scope()` retorna l'$scope AngularJS associat a l'element o als seus ancestors. L'$scope
      és l'objecte de dades que AngularJS usa per al binding entre el model i la vista.
  Si Angular no ha processat l'element (per exemple, perquè el modal encara no ha renderitzat
  completament), `.scope()` pot retornar `undefined` o `null`.

[DEBUGGER] L:39 » GUARD — `if (scope && scope.modalComentaris)`
  Comprova que:
    1. `scope` no és `null`/`undefined` (el modal s'ha renderitzat i Angular ha associat un scope).
    2. `scope.modalComentaris` existeix (l'objecte esperat dins l'$scope és present).
  Si alguna d'aquestes condicions falla, el bloc s'omet silenciosament. Això pot causar que
  alguns alumnes no rebin el comentari sense cap notificació a l'usuari.

[DEBUGGER] L:40-42 » MODIFICACIÓ DEL MODEL ANGULAR — `scope.$apply()`
  `scope.$apply()` és la manera correcta de modificar l'$scope d'AngularJS des de codi extern
  al cicle de digest d'Angular:
    - Sense `$apply`, Angular no detectaria el canvi i el binding no actualitzaria la vista.
    - Amb `$apply`, Angular executa la funció callback i posteriorment activa el mecanisme
      de detecció de canvis ($digest cycle), que actualitza tots els bindings afectats.
  Dins el callback arrow `() => { scope.modalComentaris.comentaris = nouText; }`:
    - S'assigna `nouText` (el paràmetre de `scriptPerInjectar`) a la propietat imbricada
      `scope.modalComentaris.comentaris`, que és exactament el model que `data-ng-model`
      vincula amb el `<textarea>`.
  Risc: si `$apply` es crida quan ja hi ha un $digest en curs, Angular llança l'error
  "digest already in progress". En aplicacions Angular pures es faria servir `$applyAsync`
  o `$timeout`, però aquí el context és extern i el risc és baix.

[DEBUGGER] L:44 » ESPERA TEMPORAL — `await new Promise((r) => setTimeout(r, 500))`
  Pausa de 500 ms per donar temps a Angular perquè apliqui el canvi de model, actualitzi
  la vista i el `<textarea>` estigui visualment actualitzat. A continuació es fa clic a desar.

[DEBUGGER] L:45 » CLIC CONDICIONAL — `if (botoDesa) botoDesa.click()`
  Comprova que `botoDesa` no és `null` (el botó de desar s'ha trobat al DOM) i llavors
  dispara el clic. El clic executarà el handler Angular de `saveComentariContingut`, que
  desa el comentari i probablement tanca el modal.
  Nota: no hi ha espera après d'aquest clic (a diferència del bloc `else`). Pot ser que el
  modal es tanqui prou ràpid o que l'arquitectura de la pàgina no ho requereixi.

[DEBUGGER] L:48 » INICI DEL BLOC ELSE — Cas de pàgina de grup/matèria
  S'executa quan `tipusPaginaGrupMateriaa` és `true`. La lògica és paral·lela al cas anterior
  però amb selectors i propietats de model Angular diferents.

[DEBUGGER] L:49-50 » SELECCIÓ DOM — `textarea[data-ng-model="commentsToModify.commentsToModifyModal"]`
  Selector per al modal de grup/matèria. El model Angular usat aquí és
  `commentsToModify.commentsToModifyModal` (en anglès, a diferència de `modalComentaris.comentaris`
  en català del cas anterior). Reflecteix que les dues vistes de l'aplicació de destí van ser
  desenvolupades per equips o en moments diferents.

[DEBUGGER] L:52 » SELECCIÓ DOM — `a[data-ng-click*="modalSave"]`
  Selector per al botó de desar del modal de grup/matèria. El handler Angular és `modalSave`
  (més genèric que `saveComentariContingut`).

[DEBUGGER] L:53-58 » GUARD I MODIFICACIÓ DEL MODEL ANGULAR — cas grup/matèria
  La lògica és idèntica a la del cas de continguts (L:37-42):
    - Guard doble: `textarea && typeof angular !== 'undefined'`
    - Obtenció de l'$scope: `angular.element(textarea).scope()`
    - Guard del model: `scope && scope.commentsToModify`
    - Modificació via `$apply`: `scope.commentsToModify.commentsToModifyModal = nouText`
  La diferència clau és la propietat del model accedida: `scope.commentsToModify`
  i la seva subpropietat `commentsToModifyModal`.

[DEBUGGER] L:60-61 » ESPERA I CLIC A DESAR — cas grup/matèria
  Mateixa estructura que el cas de continguts: 500 ms d'espera + clic condicional a `botoDesa`.

[DEBUGGER] L:63 » ESPERA ADDICIONAL — `await new Promise((r) => setTimeout(r, 800))`
  Espera extra de 800 ms que no existeix en el cas de continguts. Probablement necessària
  perquè el modal de grup/matèria triga més a tancar-se, i sense aquesta espera el proper
  `botons[i].click()` podria trobar el DOM en un estat intermedi amb el modal anterior
  encara visible, causant interferències.
  Observació: aquesta espera es troba dins el bloc `if (textarea && ...)`, de manera que si
  `textarea` és `null`, NO s'executa. Això podria ser un bug: si el modal no es troba, no
  s'espera, i el proper clic s'executa immediatament. Hauria d'estar fora del bloc `if`.

[DEBUGGER] L:65 » TANCAMENT DEL BLOC IF/ELSE INTERN — fi de la bifurcació de tipus de pàgina
  El `}` tanca el bloc `else` de la línia 48, que al seu torn és la part alternativa del
  `if (!tipusPaginaGrupMateriaa)` de la línia 30.

[DEBUGGER] L:66 » TANCAMENT DEL BUCLE FOR — fi d'una iteració
  El `}` tanca el cos del bucle `for` de la línia 25. L'execució torna a la condició
  `i < botons.length` per decidir si continuar amb el següent alumne.

[DEBUGGER] L:67 » NOTIFICACIÓ FINAL — `alert('Procés finalitzat!')`
  Quan tots els botons han estat processats, es mostra un `alert` bloquejant per informar
  l'usuari que l'automatització ha completat. Aquesta línia s'executa fora del bucle, per
  tant apareix una sola vegada al final.

[DEBUGGER] L:68 » TANCAMENT DE LA FUNCIÓ — fi de `scriptPerInjectar`
  El `}` tanca la funció `async function scriptPerInjectar`. La Promise implícita retornada
  per la funció async es resol amb `undefined` un cop arriba aquí.
```

---

## BLOC 5 — Listener del clic a la icona de l'extensió i codi comentat (línies 70–92)

```javascript
// Escoltador del clic a la icona de l'extensió
chrome.action.onClicked.addListener(async (tab) => {
  // 1. Executem un prompt simple per demanar el text
  // Com que el prompt no es pot fer des de background, l'executem via scripting
  // //SI VOLEM PREGUNTAR A L'USUARI PER POSAR UN TEXT FIX A CADA ALUMNE
  /*   const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => prompt("Quin comentari vols posar?", "")
  });
 */
  const textUsuari = '';

  if (textUsuari != null) {
    // 2. Injectem la funció principal al món MAIN (on viu Angular)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: scriptPerInjectar,
      args: [textUsuari]
    });
  }
});
```

```
[DEBUGGER] L:70 » COMENTARI — "Escoltador del clic a la icona de l'extensió"
  Comentari que identifica el bloc com el punt d'entrada de l'extensió. És precís i útil.

[DEBUGGER] L:71 » EVENT LISTENER — `chrome.action.onClicked.addListener(async (tab) => { ... })`
  `chrome.action.onClicked` és un event de l'API de Chrome Extensions (Manifest V3) que es
  dispara quan l'usuari fa clic a la icona de l'extensió a la barra d'eines del navegador.
  Cal tenir en compte que aquest event NO es dispara si l'extensió té un popup definit al
  manifest (`"default_popup"`): en aquell cas s'obre el popup i l'event no arriba al background.
  Per tant, el manifest d'aquesta extensió presumably NO defineix `"default_popup"`.
  `.addListener(async (tab) => { ... })` registra una funció async com a callback. El paràmetre
  `tab` és un objecte `chrome.tabs.Tab` que conté informació sobre la pestanya activa on l'usuari
  ha fet clic, incloent `tab.id` (identificador únic de la pestanya, necessari per injectar codi).
  El service worker del background és l'únic context on `chrome.action.onClicked` pot ser escoltat.

[DEBUGGER] L:72-74 » COMENTARIS — Explicació del context i limitació del `prompt`
  Tres línies de comentari que expliquen per què el `prompt` (diàleg natiu del navegador per
  demanar text a l'usuari) no es pot executar des del service worker del background:
    - El service worker NO té accés al DOM ni a funcions de UI com `alert`, `prompt`, `confirm`.
    - Aquestes funcions existeixen únicament en el context d'una pàgina web (content script o
      funció injectada amb `world: 'MAIN'`).
  L'alternativa documentada als comentaris seria injectar una funció que cridi `prompt` a la
  pàgina, capturar-ne el resultat i retornar-lo al background.

[DEBUGGER] L:74 » COMENTARI ESPECIAL — Línies dobles de comentari (`// //`)
  La línia comença amb `// //`, que és un commentari de línia senzill que conté un altre `//`
  dins el text. No té cap efecte especial: tot el text a la dreta del primer `//` és tractat
  com a comentari i ignorat per l'intèrpret. El text en majúscules `SI VOLEM PREGUNTAR A L'USUARI
  PER POSAR UN TEXT FIX A CADA ALUMNE` actua com a títol o capçalera explicativa del bloc
  comentat que segueix.

[DEBUGGER] L:75-79 » CODI COMENTAT — Bloc de `chrome.scripting.executeScript` per al `prompt`
  Un bloc de codi entre `/* ... */` que estava actiu en una versió anterior i ha estat desactivat.
  El codi injectaria una funció `() => prompt("Quin comentari vols posar?", "")` a la pestanya
  activa, capturaria el resultat a `result` i l'usaria com a text.
  Per què s'ha comentat: la funcionalitat de demanar text a l'usuari ha estat desactivada, i el
  text s'ha fixat a una cadena buida a la línia 80. Probablement és una simplificació temporal
  per a proves o perquè el cas d'ús actual és esborrar comentaris (posar text buit) en lloc
  de reemplaçar-los per un text customitzat.
  El resultat de `chrome.scripting.executeScript` en injectar una funció que retorna un valor
  és un Array d'objectes `InjectionResult`, on `result[0].result` conté el valor retornat.
  Nota d'arquitectura: és tècnicament correcte injectar un `prompt` a la pàgina per obtenir
  l'entrada de l'usuari, però la UX seria millor amb un popup HTML propi de l'extensió.

[DEBUGGER] L:80 » CONSTANT — `const textUsuari = ''`
  Declara `textUsuari` com una constant (`const`) amb valor de cadena buida.
  `const` garanteix que `textUsuari` no pot ser reassignat dins el callback. Si es volgués
  recuperar el valor del `prompt` comentat, caldria canviar-ho a `let`.
  El valor `''` (cadena buida) és el text que s'enviarà a tots els camps de comentaris.
  En el context de l'aplicació de destí (un sistema de gestió escolar), això efectivament
  ESBORRA els comentaris existents de tots els alumnes, que és el comportament que dona nom
  a l'extensió (`ExtensioBuidaComentaris` = extensió que buida comentaris).

[DEBUGGER] L:82 » CONDICIÓ — `if (textUsuari != null)`
  Comprova que `textUsuari` no és `null`. Usa `!=` (igualtat abstracta, no estricta), que
  considera `null` i `undefined` equivalents, per tant la condició falla si `textUsuari` és
  `null` o `undefined`.
  Amb el valor actual `''` (cadena buida), la condició SEMPRE és certa: `'' != null` és `true`.
  Aquesta condició tenia sentit quan existia el `prompt` comentat: si l'usuari feia clic a
  "Cancel·lar" en el `prompt`, el valor retornat seria `null`, i la condició impediria l'execució.
  Amb el codi actual, la condició és redundant (mai falla) però es manté per compatibilitat
  amb la lògica original.

[DEBUGGER] L:83 » COMENTARI — "Injectem la funció principal al món MAIN (on viu Angular)"
  Comentari precís i tècnicament correcte. Explica el propòsit de l'`executeScript` i menciona
  el motiu d'usar `world: 'MAIN'` (que Angular hi sigui accessible).

[DEBUGGER] L:84-89 » INJECCIÓ DE SCRIPT — `chrome.scripting.executeScript`
  Crida asíncrona a l'API de Chrome per injectar codi a la pestanya activa. Els paràmetres:

  `target: { tabId: tab.id }` (L:85):
    Especifica la pestanya on s'injectarà el codi. `tab.id` prové del paràmetre `tab` del
    listener de l'event `onClicked`. Si la pestanya és una pàgina especial (chrome://, about:,
    etc.), la injecció fallarà amb un error que no s'ha capturat aquí (manca de try/catch).

  `world: 'MAIN'` (L:86):
    Paràmetre crític. Per defecte, els scripts injectats per extensions s'executen en
    `world: 'ISOLATED'`, un context separat del JavaScript de la pàgina, amb el seu propi
    scope global. En el context aïllat, la variable global `angular` de la pàgina NO és
    accessible.
    Amb `world: 'MAIN'`, el codi s'injecta i s'executa en el mateix context JavaScript que
    la pàgina web, compartint el scope global. Això permet accedir directament a `angular`,
    a l'$scope dels components, i a qualsevol altra variable global de la pàgina.
    Risc de seguretat: executar codi en el món MAIN exposa el codi de l'extensió a possibles
    atacs de la pàgina (prototype pollution, etc.). Acceptable en extensions de confiança
    personal però no recomanat en extensions públiques.

  `func: scriptPerInjectar` (L:87):
    Referència a la funció declarada a la línia 3. Chrome la serialitza com a cadena de text
    (`.toString()`), la transmet al procés de la pestanya i la re-avalua allà.
    Limitació important: com que és serialitzada, la funció NO captura res del closure del
    background script. Qualsevol variable o funció del background que `scriptPerInjectar` volgués
    usar hauria de ser passada com a argument o redeclarada dins la funció.

  `args: [textUsuari]` (L:88):
    Array d'arguments que es passaran a `scriptPerInjectar` quan s'executi a la pàgina.
    `textUsuari` (cadena buida `''`) es mapeja al paràmetre `nouText` de la funció.
    Els arguments han de ser serialitzables com a JSON (strings, numbers, objects plans, etc.);
    funcions, classes o objectes amb mètodes no serialitzables causarien errors.

[DEBUGGER] L:90 » TANCAMENT DEL BLOC IF — fi de la condició `if (textUsuari != null)`
  El `}` tanca el bloc condicional de la línia 82.

[DEBUGGER] L:91 » TANCAMENT DEL LISTENER — fi del callback de `onClicked`
  `});` tanca simultàniament:
    - La funció arrow async `async (tab) => { ... }` (el `}`)
    - La crida a `.addListener(...)` (el `)`)
    - L'expressió com a statement (el `;`)

[DEBUGGER] L:92 » FINAL DEL FITXER
  Última línia del fitxer. No hi ha codi addicional. El fitxer finalitza correctament sense
  instruccions penjades o incompletes.
```

---

```
[DEBUGGER] Anàlisi completada. Total d'instruccions analitzades: 92 línies.
[DEBUGGER] Fi de la sessió de depuració.
```
