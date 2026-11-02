# louiskoller.cc

Fotografie-Portfolio. Reines HTML/CSS/JS ohne Build-Schritt, läuft auf Vercel (Branch `main`, jeder Push wird automatisch veröffentlicht). Der Code liegt auf GitHub.

## Inhalte pflegen

Alle Inhalte stehen in **`assets/js/content.js`**: Name, Texte, Kontakt, Fotos und (optional) Filme.

### Neues Foto
1. Große Version (lange Kante ca. 2400 px, JPG, Qualität ~80) nach `images/photos/` legen.
2. Kleine Version (ca. 1200 px) mit gleichem Namen nach `images/thumbs/` legen. Sie wird im Raster genutzt und macht die Seite schnell.
3. In `content.js` einen Eintrag in `photos` ergänzen.

Felder: `title`, `place`, `year`, `camera` (leer lassen = wird nicht angezeigt), `ratio` (Breite/Höhe, reserviert den Platz), `size` (1 = klein, 2 = mittel, 3 = groß) und `hero: true` für das wechselnde Panorama-Fenster oben.

`size` ist nur ein Richtwert: Jedes Bild bekommt etwas Zufall dazu, und wie groß es am Ende wird, hängt auch davon ab, mit welchen Bildern es in einer Reihe landet. Die Anordnung steuert `shuffle` in `content.js`: `true` = bei jedem Besuch neu gemischt, eine Zahl = feste zufällige Anordnung (andere Zahl = andere Anordnung), `false` = Reihenfolge wie in der Liste.

### Deutsch / Englisch
Texte in `content.js` können zweisprachig sein: `{ de: "…", en: "…" }`. Ein einfacher Text ohne Klammern gilt für beide Sprachen (z.B. die Fototitel). Alle festen Texte der Seite (Navigation, Buttons, Lightbox …) stehen in `assets/js/i18n.js`.

Wer die Seite sieht: Deutsch, wenn der Browser auf Deutsch steht oder das Gerät in deutscher, österreichischer oder Schweizer Zeitzone läuft, sonst Englisch. Oben in der Navigation lässt sich mit **DE / EN** umschalten, die Wahl wird gemerkt. Impressum und Datenschutz bleiben deutsch.

### Leichte Version
Für schwächere Geräte gibt es eine leichte Version ohne WebGL-Verzerrung, Glas-Cursor, animiertes Korn, Unschärfe und Einblend-Animationen (`assets/js/lite.js`, Regeln unter `.lite` in `style.css`). Wirkt ein Gerät langsam (wenig Kerne/Arbeitsspeicher, keine Grafikkarte oder die Seite ruckelt in den ersten Sekunden messbar), wird einmal unten eingeblendet gefragt, ob man wechseln will. Die Antwort wird gemerkt; im Footer lässt sich die leichte Version jederzeit an- und ausschalten.

Auf Handys und Tablets läuft die WebGL-Verzerrung nie, weil sie dort dem Scrollen hinterherruckelt. Stattdessen wandern die Fotos beim Scrollen leicht in ihrem Rahmen (reines CSS, läuft flüssig mit dem Finger mit).

### Filmstills
Die Liste `films` ist leer, deshalb ist der Bereich „Film Stills“ ausgeblendet. Sobald dort ein Film mit Stills steht, erscheint er automatisch (Beispiel im Kommentar in `content.js`).

## Impressum & Datenschutz

- `impressum/index.html` und `datenschutz/index.html`, verlinkt im Footer und in `/route/`.
- Die Seite setzt keine Cookies und lädt nichts von Google: Die Schriften liegen in `assets/fonts/` (eingebunden über `assets/css/fonts.css`).
- Besucherstatistik: **Vercel Web Analytics** (cookielos), eingebunden über zwei Script-Tags im `<head>` von `index.html`, `impressum/`, `datenschutz/` und `route/index.html` (nicht im Admin). Zählt nur, wenn Web Analytics im Vercel-Dashboard unter *Analytics* aktiviert ist. Neue Seiten bekommen das Snippet ebenfalls:
  ```html
  <script>
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  </script>
  <script defer src="/_vercel/insights/script.js"></script>
  ```
- **Wenn du etwas Externes einbaust** (Instagram-Embed, Analytics, Google Maps, Kontaktformular, neue Schrift aus dem Netz), trag es in die Datenschutzerklärung ein. Bei Tracking oder Analytics mit Cookies bzw. Wiedererkennung von Besuchern brauchst du außerdem einen Banner mit Einwilligung.
- Ändert sich Adresse oder E-Mail, beide Seiten anpassen (und `email` in `content.js`).

## Lokal ansehen

```sh
python3 -m http.server 8080
```

Dann http://localhost:8080 öffnen.

## Route / Gapyear (`/route/`)

Privater Bereich mit Karte, Route und Reise-Journal. Erreichbar über das Schloss oben rechts auf der Startseite (Code `2301`) oder direkt unter `/route/`.

> Der Code ist nur ein Vorhang gegen Zufallsbesucher: Die Seite und das Repo sind öffentlich, wer den Quellcode oder einen Bild-Link kennt, kommt ran. Nichts wirklich Privates einstellen.

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
