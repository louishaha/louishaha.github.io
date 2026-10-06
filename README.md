# louiskoller.cc

Portfolio für Fotografie & Filmstills. Reines HTML/CSS/JS, kein Build-Schritt, läuft direkt auf GitHub Pages.

## Konzept: Dunkelkammer / Leuchttisch

- **Darkroom** (dunkel, Standard) und **Light table** (hell). Umschalten oben rechts.
- Hero: Der Name ist riesig gesetzt, dazwischen ein Panorama-Fenster, das durch deine Fotos wechselt (Verschluss-Animation).
- **(01) Photographs**: editoriales, asymmetrisches Raster. Alternativ als **Index**-Liste, beim Hovern folgt eine Vorschau dem Cursor.
- **(02) Film Stills**: horizontaler Filmstreifen mit Perforation, Timecode und Untertiteln, gesteuert durch normales Scrollen. Auf dem Handy wischt man ihn seitlich.
- Lightbox mit Pfeiltasten, Esc und Swipe, dazu Filmkorn-Overlay, eigener Cursor und ein Intro im Dunkelkammerlicht („Developing 000 → 100“).

## Inhalte pflegen

Alles Inhaltliche steht in **`assets/js/content.js`**: Name, Texte, Kontakt, Fotos, Filme.

1. Fotos nach `images/photos/` legen, Filmstills nach `images/stills/`.
   Empfehlung: JPG, lange Kante 2000–2400 px, unter ca. 600 KB.
2. In `content.js` beim jeweiligen Eintrag `src: "images/photos/dateiname.jpg"` eintragen.
3. Einträge mit leerem `src` zeigen einen generierten Platzhalter.

Hinweise:
- `hero: true` → das Foto erscheint im wechselnden Fenster im Hero.
- `ratio` → reserviert das Seitenverhältnis im Raster (`"3/2"`, `"2/3"`, `"4/5"`, …). Am besten passend zum echten Bild angeben.
- Filme: `aspect` bestimmt das Bildformat des Filmstreifens (`"2.39"`, `"1.85"`, `"1.33"`). `subtitle` bleibt leer, wenn kein Untertitel gezeigt werden soll.

## Lokal ansehen

```sh
npx http-server -p 8080
# oder
python3 -m http.server 8080
```

Dann http://localhost:8080 öffnen.
