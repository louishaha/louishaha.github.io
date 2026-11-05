# louiskoller.cc

Fotografie-Portfolio. Reines HTML/CSS/JS ohne Build-Schritt, läuft auf Vercel (Branch `main`, jeder Push wird automatisch veröffentlicht). Der Code liegt auf GitHub.

## Inhalte pflegen: `/admin/`

Alles läuft über **louiskoller.cc/admin/** (Handy oder Computer). Einmal pro Gerät mit GitHub verbinden (gleicher Token wie beim Route-Admin, siehe unten), danach:

- **Fotos:** hochladen (mehrere auf einmal, am Computer auch per Drag & Drop). Der Admin verkleinert sie (Großansicht 2400 px, Raster 1200 px) und liest Kamera, Objektiv, Brennweite, Blende, Zeit, ISO und Jahr aus der Datei. Pro Foto: Titel, Ort, Größe im Raster (1 = klein, 2 = mittel, 3 = groß), ★ Auswahl (Startseite, gut sind 12–20), Startbild (großes Bild oben), Serien.
- **Serien:** anlegen, Reihenfolge, Titelbild, Bilder. Jede Serie hat eine eigene Seite unter `/serie/<name>`.
- **Film:** Clips direkt hochladen (MP4, am besten 1080p, unter 50 MB, max. 95 MB) oder längere Filme als YouTube-Link. Vorschaubild und Format (quer/hochkant) werden automatisch erkannt.
- **Info:** der Steckbrief auf der Startseite. `Text | https://…` in einer Zeile macht einen Link; solche Links erscheinen auch im Footer.
- **Einstellungen:** Gapyear-Modus an/aus (siehe unten), Auswahl mischen, Name.
- **Veröffentlichen** macht einen Commit ins Repo, nach ca. 1 Minute ist es online. Nicht veröffentlichte Änderungen (inkl. gewählter Dateien) überleben einen Neustart des Browsers.

Alle Inhalte stehen in **`data/site.json`** (lässt sich zur Not auch von Hand bearbeiten). Fotos liegen in `images/photos/` und `images/thumbs/`, Clips und Vorschaubilder in `media/film/`.

### Sprachen
Deutsch für deutsche Browser und deutschsprachige Zeitzonen, vereinfachtes Chinesisch für chinesische Browser, sonst Englisch. Umschalten oben mit **DE / EN / 中**. Texte in `site.json` können `{ "de": "…", "en": "…", "zh": "…" }` sein; ein einfacher Text gilt in allen Sprachen (z. B. Fototitel). Im Admin heißt das „Übersetzung (EN / 中文)“, leer = wie Deutsch. Alle festen Texte der Seite stehen in `assets/js/i18n.js`. Die chinesischen Texte sollte einmal jemand gegenlesen.

### Aufbau
- `index.html` + `assets/js/home.js`: Startseite (Startbilder, Auswahl, Serien, Info)
- `serie/` + `assets/js/series.js`: eine Serie (`vercel.json` leitet `/serie/<name>` dorthin)
- `film/` + `assets/js/film.js`: Clips mit eigenem Player; YouTube lädt erst nach Klick (youtube-nocookie) und läuft hinter eigenen Bedienelementen
- `assets/js/core.js`: alles Gemeinsame (Navigation, Footer, Sprache, Hell/Dunkel, Cursor, Lightbox mit Belichtungswerten, Fotoraster)
- `assets/js/warp.js`: WebGL-Verzerrung beim Scrollen und das „Entwickeln“ der Fotos (Desktop)
- `assets/js/lite.js`: leichte Version für langsame Geräte
- Schriften: Spectral (Titel) und Archivo (Rest), selbst gehostet in `assets/fonts/`

### Leichte Version
Für schwächere Geräte gibt es eine leichte Version ohne WebGL-Verzerrung, Glas-Cursor, animiertes Korn, Unschärfe und Einblend-Animationen (`assets/js/lite.js`, Regeln unter `.lite` in `style.css`). Wirkt ein Gerät langsam (wenig Kerne/Arbeitsspeicher, keine Grafikkarte oder die Seite ruckelt in den ersten Sekunden messbar), wird einmal unten gefragt, ob man wechseln will. Die Antwort wird gemerkt; im Footer lässt sich die leichte Version jederzeit an- und ausschalten.

Auf Handys und Tablets läuft die WebGL-Verzerrung nie, weil sie dort dem Scrollen hinterherruckelt. Stattdessen wandern die Fotos beim Scrollen leicht in ihrem Rahmen (reines CSS, läuft flüssig mit dem Finger mit).

## Impressum & Datenschutz

- `impressum/index.html` und `datenschutz/index.html`, verlinkt im Footer und in `/route/`.
- Die Seite setzt keine Cookies und lädt nichts von Google: Die Schriften liegen in `assets/fonts/` (eingebunden über `assets/css/fonts.css`). Einzige Ausnahme: YouTube-Filme auf der Film-Seite, und die erst nach Klick (steht in der Datenschutzerklärung).
- Besucherstatistik: **Vercel Web Analytics** (cookielos), eingebunden über zwei Script-Tags im `<head>` von `index.html`, `serie/`, `film/`, `impressum/`, `datenschutz/` und `route/index.html` (nicht in den Admins). Zählt nur, wenn Web Analytics im Vercel-Dashboard unter *Analytics* aktiviert ist. Neue Seiten bekommen das Snippet ebenfalls:
  ```html
  <script>
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  </script>
  <script defer src="/_vercel/insights/script.js"></script>
  ```
- **Wenn du etwas Externes einbaust** (Instagram-Embed, Analytics, Google Maps, Kontaktformular, neue Schrift aus dem Netz), trag es in die Datenschutzerklärung ein. Bei Tracking oder Analytics mit Cookies bzw. Wiedererkennung von Besuchern brauchst du außerdem einen Banner mit Einwilligung.
- Ändert sich Adresse oder E-Mail, beide Seiten anpassen (und die E-Mail im Admin unter Info).

## Lokal ansehen

```sh
python3 -m http.server 8080
```

Dann http://localhost:8080 öffnen.

## Track me / Gapyear (`/route/`)

**Gapyear-Modus** (Admin → Einstellungen): Ist er an, steht „Track me“ in der Navigation neben Fotografie und Film, die Route ist ohne Code für alle sichtbar und oben steht „Gerade in <Ort> · <Ortszeit>“ (Ort = aktueller Standort im Route-Admin, Zeitzone aus dem Land). Ist er aus, ist die Route nur über das Schloss mit Code erreichbar.

Karte, Route und Reise-Journal. Ohne Gapyear-Modus erreichbar über das Schloss oben rechts (Code `2301`) oder direkt unter `/route/`.

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
