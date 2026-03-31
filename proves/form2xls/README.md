# Form2XLS

Extensió de Chrome que exporta els camps d'un formulari web a un fitxer CSV (compatible amb Excel i LibreOffice Calc) i permet reimportar-lo per aplicar els valors editats.

## Flux d'ús

1. Obre el popup sobre una pàgina amb formulari → l'extensió detecta tots els camps.
2. Clica **Exportar CSV** → es descarrega `form-data.csv`.
3. Obre el fitxer amb Excel o LibreOffice, edita la columna **Valor** i desa.
4. Torna al popup, selecciona el fitxer editat i clica **Aplicar valors**.

## Format del CSV

```
#,Identificador,Valor
1,Nom,Joan
2,Cognom,Pérez
3,Email,joan@exemple.com
4,#accepto-termes,true
5,[name="pais"],ES
```

- **`#`** — índex del camp (1-based). S'usa per fer la concordança en importar; **no el canviïs**.
- **`Identificador`** — nom llegible del camp (etiqueta, aria-label, placeholder, id o name).
- **`Valor`** — valor actual del camp. **Aquesta és l'única columna que has d'editar.**

Pots ordenar les files a Excel sense problemes; la reimportació usa la columna `#` per trobar cada camp.

## Ús

1. Clona el repositori.
2. A Chrome, vés a `chrome://extensions/` i activa el **mode de desenvolupador**.
3. Clica **Carregar extensió desempaquetada** i selecciona aquesta carpeta.
4. Obre una pàgina web amb un formulari i fes clic a la icona de l'extensió.
