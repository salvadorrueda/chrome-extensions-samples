# Gestió Esfera

Una extensió de Chrome que analitza la web actual i crea un llistat complet de tots els elements amb els que es pot fer clic, i que permet a més descobrir, ressaltar i editar els valors de tots els camps d'entrada (`input`, `textarea`, `select` i elements `contenteditable`).

## Funcionalitats

### Anàlisi d'elements clicables

- **Detecció automàtica**: Troba tots els elements clicables (`<a>`, `<button>`, inputs, elements amb rol button, etc.)
- **Informació detallada**: Mostra per a cada element:
  - Tag HTML del element
  - Text visible
  - ID
  - Classes CSS
  - Href (per a enllaços)
  - Role ARIA
  - Title
  - Tipus (per a inputs)
- **Filtratge intel·ligent**: Només mostra elements visibles i que realment es poden interactuar
- **Interfície neta**: Popup amb llista scrollable i fàcil de llegir

### Anàlisi i edició de camps d'entrada (Input Fields Analyzer)

- **Ressaltat visual per categories**: Detecta i marca amb colors diferenciats tots els camps d'entrada de la pàgina:
  - Blau (`#4285f4`) — Text, Email, Password, URL, Search, Tel
  - Verd (`#34a853`) — Number, Range, Date, Time, DateTime-local, Month, Week
  - Lila (`#9c27b0`) — Textarea
  - Taronja (`#ff9800`) — Select (llistes desplegables)
  - Vermell (`#ea4335`) — Elements Contenteditable
- **Comptador per categoria**: Mostra quants camps de cada tipus s'han trobat.
- **Llistat detallat**: Per a cada camp d'entrada s'indica:
  - Tag HTML i tipus d'input
  - Categoria (text, number, textarea, select, contenteditable)
  - Etiqueta associada (`<label>`), placeholder o `aria-label`
  - Atributs `id` i `name`
  - Valor actual del camp
  - Ruta DOM (`domPath`) per identificar l'element de forma única
  - URL del frame on es troba (útil en pàgines amb iframes)
- **Edició massiva de valors**: Un àrea de text mostra tots els valors en el format `identificador: valor`. Modificant les línies i prement "Aplicar valors als inputs" s'actualitzen els camps directament a la pàgina, disparant els events `input` i `change` perquè els frameworks reactius (React, Vue, Angular…) detectin el canvi.
- **Suport multi-frame**: Detecta i actualitza camps dins d'`<iframe>` embedats a la pàgina principal.
- **Activació/desactivació**: El botó "Highlight Input Fields" actua com a commutador; tornar-lo a prémer elimina tots els ressaltats.

## Instal·lació

1. Obrir Chrome i anar a `chrome://extensions/`
2. Activa "Mode de desenvolupador" (cantonada superior dreta)
3. Clica "Carregar extensió sense empaquetar"
4. Selecciona la carpeta `clickable-elements-analyzer`

## Ús

### Anàlisi d'elements clicables

1. Navegar a qualsevol web
2. Clica la icona de l'extensió en la barra superior
3. Clica el botó "Analitzar"
4. Veurà un llistat de tots els elements clicables

### Cerca i edició de camps d'entrada

1. Navegar a qualsevol web amb formularis
2. Clica la icona de l'extensió
3. A la secció **Input Fields Analyzer**, clica "Highlight Input Fields"
4. La pàgina ressaltarà tots els camps d'entrada amb colors per categoria i el popup mostrarà el llistat complet
5. Per actualitzar valors, edita les línies de l'àrea de text inferior (format `identificador: nou_valor`)
6. Clica "Aplicar valors als inputs" per escriure els nous valors als camps de la pàgina

## Tecnologia

- Manifest V3
- Chrome Scripting API (`scripting.executeScript` amb `allFrames: true`)
- Vanilla JavaScript (ES6+)
