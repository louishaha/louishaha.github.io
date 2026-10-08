# louiskoller.cc

Fotografie-Portfolio. Reines HTML/CSS/JS ohne Build-Schritt, läuft direkt auf GitHub Pages (Branch `main`).

## Inhalte pflegen

Alle Inhalte stehen in **`assets/js/content.js`**: Name, Texte, Kontakt, Fotos und (optional) Filme.

### Neues Foto
1. Große Version (lange Kante ca. 2400 px, JPG, Qualität ~80) nach `images/photos/` legen.
2. Kleine Version (ca. 1200 px) mit gleichem Namen nach `images/thumbs/` legen. Sie wird im Raster genutzt und macht die Seite schnell.
3. In `content.js` einen Eintrag in `photos` ergänzen. Die Reihenfolge dort ist die Reihenfolge auf der Seite.

Felder: `title`, `place`, `year`, `camera` (leer lassen = wird nicht angezeigt), `ratio` (Breite/Höhe, reserviert den Platz) und `hero: true` für das große, wechselnde Titelbild oben (am besten Querformat).

### Filmstills
Die Liste `films` ist leer, deshalb ist der Bereich „Films“ ausgeblendet. Sobald dort ein Film mit Stills steht, erscheint er automatisch (Beispiel im Kommentar in `content.js`).

## Lokal ansehen

```sh
python3 -m http.server 8080
```

Dann http://localhost:8080 öffnen.
