/* ==========================================================================
   CONTENT — hier pflegst du alles, was auf der Seite steht.
   --------------------------------------------------------------------------
   Bilder hinzufügen:
   1. Foto nach images/photos/ (bzw. Filmstill nach images/stills/) kopieren
      – am besten als .jpg, lange Kante ca. 2000–2400 px, < 600 KB.
   2. Unten bei `src` den Pfad eintragen, z.B. "images/photos/faehre.jpg".
   Solange `src` leer ist, zeichnet die Seite einen Platzhalter.

   ratio  -> Seitenverhältnis (nur für Platzhalter wichtig), z.B. "3/2", "2/3", "4/5"
   tone   -> Farbstimmung des Platzhalters: dusk, fog, sodium, sea, neon, desert, moss
   ========================================================================== */

window.PORTFOLIO = {
  name: ["Louis", "Koller"],
  role: "Photography & Film",
  location: "Berlin",
  coords: "52.52° N — 13.40° E",
  timezone: "Europe/Berlin",
  email: "hello@louiskoller.cc",
  links: [
    { label: "Instagram", url: "https://instagram.com/" },
    { label: "Vimeo", url: "https://vimeo.com/" },
  ],

  about: {
    statement:
      "I make quiet pictures of loud places — and loud pictures of quiet ones. Mostly on film, mostly at the edges of the day.",
    body: [
      "Louis Koller is a photographer and cinematographer. His work moves between documentary, portraiture and narrative film, with a soft spot for available light and long walks.",
      "Available for commissions, editorials and collaborations on short films and music videos.",
    ],
    details: [
      { label: "Practice", items: ["Photography", "Cinematography", "Colour"] },
      { label: "Formats", items: ["35 mm", "120", "Digital Cinema"] },
      { label: "Selected for", items: ["Placeholder Magazine", "Studio Name", "Festival Name"] },
    ],
  },

  /* ---------------------------------------------------------------- Fotos */
  photos: [
    { src: "", title: "Last Ferry", place: "Lisbon", year: 2025, camera: "Contax T2 · Portra 400", ratio: "3/2", tone: "dusk", hero: true },
    { src: "", title: "Fog Study I", place: "Dolomites", year: 2024, camera: "Mamiya 7 · HP5", ratio: "4/5", tone: "fog", hero: true },
    { src: "", title: "Night Shift", place: "Berlin-Wedding", year: 2025, camera: "Leica M6 · Cinestill 800T", ratio: "2/3", tone: "sodium", hero: true },
    { src: "", title: "Low Tide", place: "Sylt", year: 2023, camera: "Mamiya 7 · Ektar 100", ratio: "3/2", tone: "sea", hero: true },
    { src: "", title: "Waiting Room", place: "Tokyo", year: 2024, camera: "Fuji GW690 · Pro 400H", ratio: "16/9", tone: "neon", hero: true },
    { src: "", title: "Heat", place: "Almería", year: 2023, camera: "Contax T2 · Gold 200", ratio: "4/5", tone: "desert" },
    { src: "", title: "Understory", place: "Black Forest", year: 2024, camera: "Pentax 67 · Portra 160", ratio: "3/2", tone: "moss", hero: true },
    { src: "", title: "Blue Hour, Platform 4", place: "Leipzig", year: 2025, camera: "Leica M6 · Portra 800", ratio: "2/3", tone: "dusk" },
    { src: "", title: "Fog Study II", place: "Dolomites", year: 2024, camera: "Mamiya 7 · HP5", ratio: "3/2", tone: "fog" },
    { src: "", title: "Kiosk", place: "Marseille", year: 2025, camera: "Contax T2 · Cinestill 800T", ratio: "4/5", tone: "sodium" },
    { src: "", title: "Swimmers", place: "Lake Garda", year: 2023, camera: "Pentax 67 · Ektar 100", ratio: "3/2", tone: "sea" },
    { src: "", title: "Afterparty", place: "Berlin-Mitte", year: 2025, camera: "Ricoh GR III", ratio: "2/3", tone: "neon" },
  ],

  /* ---------------------------------------------------- Filme / Standbilder
     aspect -> Bildformat des Films: "2.39", "1.85", "1.66", "1.33" ...      */
  films: [
    {
      title: "Night Swim",
      year: 2025,
      kind: "Short Film",
      runtime: "14 min",
      role: "Director of Photography",
      stock: "ARRI Alexa Mini · Cooke S4",
      aspect: "2.39",
      note: "Two sisters, one summer night, a lake that is colder than promised.",
      stills: [
        { src: "", timecode: "00:02:14:07", subtitle: "Du hast gesagt, das Wasser wäre warm.", tone: "sodium" },
        { src: "", timecode: "00:06:41:19", subtitle: "", tone: "sea" },
        { src: "", timecode: "00:09:03:02", subtitle: "Bleib einfach hier. Nur noch kurz.", tone: "dusk" },
        { src: "", timecode: "00:12:58:11", subtitle: "", tone: "neon" },
      ],
    },
    {
      title: "Ostwind",
      year: 2024,
      kind: "Documentary",
      runtime: "38 min",
      role: "Camera & Colour",
      stock: "Sony FX6 · Zeiss Super Speed",
      aspect: "1.85",
      note: "A season with the last ferrymen on the Oder.",
      stills: [
        { src: "", timecode: "00:01:22:00", subtitle: "Früher sind hier jeden Tag zwanzig rüber.", tone: "fog" },
        { src: "", timecode: "00:17:45:13", subtitle: "", tone: "moss" },
        { src: "", timecode: "00:31:10:21", subtitle: "Und jetzt? Jetzt warte ich.", tone: "fog" },
      ],
    },
    {
      title: "Glasshouse",
      year: 2023,
      kind: "Music Video",
      runtime: "4 min",
      role: "Cinematography",
      stock: "16 mm · Kodak Vision3 7219",
      aspect: "1.33",
      note: "For an artist whose name goes here.",
      stills: [
        { src: "", timecode: "00:00:48:05", subtitle: "", tone: "desert" },
        { src: "", timecode: "00:02:11:16", subtitle: "", tone: "neon" },
        { src: "", timecode: "00:03:30:09", subtitle: "", tone: "dusk" },
      ],
    },
  ],
};
