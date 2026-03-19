# Analitzador d'Elements Clicables

Una extensió de Chrome que analitza la web actual i crea un llistat complet de tots els elements amb els que es pot fer clic.

## Funcionalitats

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

## Instal·lació

1. Obrir Chrome i anar a `chrome://extensions/`
2. Activa "Modo de desenvolupador" (cantonada superior dreta)
3. Clica "Cargar extensión sin empaquetar"
4. Selecciona la carpeta `clickable-elements-analyzer`

## Ús

1. Navegar a qualsevol web
2. Clica la icona de l'extensió en la barra superior
3. Clica el botó "Analitzar"
4. Veurà un llistat de tots els elements clicables

## Tecnologia

- Manifest V3
- Chrome Scripting API
- Vanilla JavaScript (ES6+)
