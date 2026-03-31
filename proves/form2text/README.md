# Form2Text

Extensió de Chrome que visualitza tots els camps editables d'un formulari web en una textarea de text pla, permet editar els valors i els torna a aplicar al formulari.

## Com funciona

1. Obre un popup amb tots els camps del formulari en format `identificador = valor` (un per línia).
2. Edita els valors que vulguis directament al text.
3. Fes clic a **Aplicar valors** per escriure els nous valors als camps del formulari.

### Format de la textarea

```
Nom = Joan
Cognom = Pérez
Email = joan@exemple.com
#accepto-termes = true
[name="pais"] = ES
```

- L'identificador s'obté en aquest ordre: etiqueta (`<label>`), `aria-label`, `placeholder`, `#id`, `[name="..."]`, o ruta DOM.
- Els salts de línia dins valors (textarea de la pàgina) s'escapen com `\n`.
- Checkboxes i radios mostren `true` o `false`.

## Ús

1. Clona el repositori.
2. A Chrome, vés a `chrome://extensions/` i activa el **mode de desenvolupador**.
3. Fes clic a **Carregar extensió desempaquetada** i selecciona aquesta carpeta.
4. Obre una pàgina web amb un formulari i fes clic a la icona de l'extensió.
