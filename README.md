# louiskoller.cc

Fotografie-Portfolio. Reines HTML/CSS/JS ohne Build-Schritt, läuft direkt auf GitHub Pages (Branch `main`).

## Inhalte pflegen

Alle Inhalte stehen in **`assets/js/content.js`**: Name, Texte, Kontakt, Fotos und (optional) Filme.

### Neues Foto
1. Große Version (lange Kante ca. 2400 px, JPG, Qualität ~80) nach `images/photos/` legen.
2. Kleine Version (ca. 1200 px) mit gleichem Namen nach `images/thumbs/` legen. Sie wird im Raster genutzt und macht die Seite schnell.
3. In `content.js` einen Eintrag in `photos` ergänzen.

Felder: `title`, `place`, `year`, `camera` (leer lassen = wird nicht angezeigt), `ratio` (Breite/Höhe, reserviert den Platz), `size` (1 = klein, 2 = mittel, 3 = groß) und `hero: true` für das wechselnde Panorama-Fenster oben.

`size` ist nur ein Richtwert: Jedes Bild bekommt etwas Zufall dazu, und wie groß es am Ende wird, hängt auch davon ab, mit welchen Bildern es in einer Reihe landet. Die Anordnung steuert `shuffle` in `content.js`: `true` = bei jedem Besuch neu gemischt, eine Zahl = feste zufällige Anordnung (andere Zahl = andere Anordnung), `false` = Reihenfolge wie in der Liste.

### Filmstills
Die Liste `films` ist leer, deshalb ist der Bereich „Film Stills“ ausgeblendet. Sobald dort ein Film mit Stills steht, erscheint er automatisch (Beispiel im Kommentar in `content.js`).

## Impressum & Datenschutz

- `impressum/index.html` und `datenschutz/index.html`, verlinkt im Footer und in `/route/`.
- Die Seite setzt keine Cookies und lädt nichts von Google: Die Schriften liegen in `assets/fonts/` (eingebunden über `assets/css/fonts.css`).
- **Wenn du etwas Externes einbaust** (Instagram-Embed, Analytics, Google Maps, Kontaktformular, neue Schrift aus dem Netz), trag es in die Datenschutzerklärung ein. Bei Tracking oder Analytics brauchst du außerdem einen Cookie-Banner mit Einwilligung.
- Ändert sich Adresse oder E-Mail, beide Seiten anpassen (und `email` in `content.js`).

## Lokal ansehen

```sh
python3 -m http.server 8080
```

Dann http://localhost:8080 öffnen.

## Route / Gapyear (`/route/`)

Privater Bereich mit Karte, Route und Reise-Journal. Erreichbar über das Schloss oben rechts auf der Startseite (Code `2301`) oder direkt unter `/route/`.

> Der Code ist nur ein Vorhang gegen Zufallsbesucher: Die Seite liegt öffentlich auf GitHub Pages, wer den Quellcode oder einen Bild-Link kennt, kommt ran. Nichts wirklich Privates einstellen.

### Bearbeiten (nur du)
1. `/route/admin.html` öffnen (in der Ansicht erscheint danach oben ein „Bearbeiten“-Knopf).
2. Einmal pro Gerät mit GitHub verbinden: [Fine-grained token erstellen](https://github.com/settings/personal-access-tokens/new), nur dieses Repo, Permission **Contents: Read and write**, Ablauf nach Reiseende. Der Token bleibt nur im Browser.
3. Orte anlegen (Suche oder auf die Karte tippen), Reihenfolge = Route, „Anreise mit“ = Verkehrsmittel.
4. Unter **Standort** einstellen, wo du gerade bist: Alles davor ist „gereist“ (rote Linie), alles danach „geplant“ (gestrichelt). Optional GPS-Live-Position.
5. Beiträge schreiben, Fotos/Videos anhängen (Fotos werden automatisch auf 2000 px verkleinert, Videos max. 95 MB, längere als YouTube-Link).
6. **Veröffentlichen** → ein Commit ins Repo, nach ca. 1 Minute online. Unveröffentlichte Änderungen (inkl. Fotos) überleben einen Neustart des Browsers.

### Dateien
- `route/data/trip.json`: alle Daten (Orte, Beiträge, aktueller Standort), wird vom Admin geschrieben.
- `route/media/<beitrag>/`: hochgeladene Fotos, Vorschaubilder, Videos.
- `route/vendor/`: MapLibre GL JS 5.24.0 (lokal, kein CDN nötig). Satellitenbilder: Esri World Imagery.
