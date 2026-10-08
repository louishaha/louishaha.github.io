/* ==========================================================================
   CONTENT — hier pflegst du alles, was auf der Seite steht.
   --------------------------------------------------------------------------
   Neues Foto hinzufügen:
   1. Bild nach images/photos/ kopieren (lange Kante ca. 2400 px, JPG)
      und eine kleinere Version (ca. 1200 px) nach images/thumbs/.
   2. Unten einen Eintrag ergänzen. `thumb` ist optional – fehlt er,
      wird `src` auch im Raster verwendet.

   ratio  -> Breite/Höhe in Pixeln, z.B. "6000/4000" – reserviert den Platz
   hero   -> true = erscheint im großen, wechselnden Titelbild oben
   Leere Felder (place, year, camera) werden einfach nicht angezeigt.
   Die Reihenfolge hier = Reihenfolge auf der Seite.
   ========================================================================== */

window.PORTFOLIO = {
  name: ["Louis", "Koller"],
  role: "Photography",
  location: "",            // z.B. "Berlin" – erscheint neben der Uhrzeit
  timezone: "Europe/Berlin",
  email: "hello@louiskoller.cc",
  links: [
    // { label: "Instagram", url: "https://instagram.com/DEIN_NAME" },
  ],

  about: {
    statement:
      "Fog, first light and animals that won’t sit still — pictures from mountains, forests and cities.",
    body: [
      "Louis Koller is a photographer. His work moves between landscape, wildlife and the street, with a soft spot for bad weather and early mornings.",
      "Available for commissions and collaborations.",
    ],
    details: [
      { label: "Subjects", items: ["Landscape", "Wildlife", "City"] },
      { label: "Equipment", items: ["Canon EOS 6D Mark II", "EF 24–70 mm f/2.8L II", "Tamron 70–200 mm f/2.8", "DJI Drone"] },
    ],
  },

  /* ---------------------------------------------------------------- Fotos */
  photos: [
    { src: "images/photos/01-into-the-fog.jpg", thumb: "images/thumbs/01-into-the-fog.jpg", title: "Into the Fog", place: "", year: 2025, camera: "Canon EOS 6D Mark II", ratio: "6137/3452", hero: true },
    { src: "images/photos/02-breaking-light.jpg", thumb: "images/thumbs/02-breaking-light.jpg", title: "Breaking Light", place: "", year: 2025, camera: "Canon EOS 6D Mark II · EF 24–70 mm f/2.8L II", ratio: "3185/4777" },
    { src: "images/photos/03-two-strays.jpg", thumb: "images/thumbs/03-two-strays.jpg", title: "Two Strays", place: "", year: 2018, camera: "Canon EOS 650D · EF-S 18–135 mm", ratio: "5184/3456" },
    { src: "images/photos/04-victoria-harbour.jpg", thumb: "images/thumbs/04-victoria-harbour.jpg", title: "Victoria Harbour", place: "Hong Kong", year: 2026, camera: "Canon EOS 6D Mark II · EF 24–70 mm f/2.8L II", ratio: "5991/3994", hero: true },
    { src: "images/photos/05-breakwater.jpg", thumb: "images/thumbs/05-breakwater.jpg", title: "Breakwater", place: "", year: 2025, camera: "Canon EOS 6D Mark II", ratio: "4637/2608", hero: true },
    { src: "images/photos/06-platform.jpg", thumb: "images/thumbs/06-platform.jpg", title: "Platform", place: "Hong Kong", year: 2026, camera: "Canon EOS 6D Mark II · EF 24–70 mm f/2.8L II", ratio: "5083/2859" },
    { src: "images/photos/07-dusk-grass.jpg", thumb: "images/thumbs/07-dusk-grass.jpg", title: "Dusk Grass", place: "", year: "", camera: "", ratio: "1333/2000" },
    { src: "images/photos/08-blue-ridges.jpg", thumb: "images/thumbs/08-blue-ridges.jpg", title: "Blue Ridges", place: "", year: 2026, camera: "Canon EOS 6D Mark II · Tamron SP 70–200 mm f/2.8", ratio: "6034/4023", hero: true },
    { src: "images/photos/09-victoria-peak.jpg", thumb: "images/thumbs/09-victoria-peak.jpg", title: "Victoria Peak", place: "Hong Kong", year: 2026, camera: "DJI Drone", ratio: "4032/2268", hero: true },
    { src: "images/photos/10-court-below.jpg", thumb: "images/thumbs/10-court-below.jpg", title: "Court Below", place: "", year: "", camera: "", ratio: "1125/2000" },
    { src: "images/photos/11-young-buck.jpg", thumb: "images/thumbs/11-young-buck.jpg", title: "Young Buck", place: "", year: 2023, camera: "Canon EOS 6D Mark II · Tamron SP 70–200 mm f/2.8", ratio: "6042/3399" },
    { src: "images/photos/12-two-lights.jpg", thumb: "images/thumbs/12-two-lights.jpg", title: "Two Lights", place: "", year: 2024, camera: "Canon EOS 6D Mark II · Tamron SP 70–200 mm f/2.8", ratio: "6174/4116", hero: true },
    { src: "images/photos/13-mouflons.jpg", thumb: "images/thumbs/13-mouflons.jpg", title: "Mouflons", place: "", year: "", camera: "", ratio: "2000/1125" },
    { src: "images/photos/14-above-the-clouds.jpg", thumb: "images/thumbs/14-above-the-clouds.jpg", title: "Above the Clouds", place: "", year: 2025, camera: "Canon EOS 6D Mark II · EF 24–70 mm f/2.8L II", ratio: "2179/2179" },
    { src: "images/photos/15-heart-stone.jpg", thumb: "images/thumbs/15-heart-stone.jpg", title: "Heart Stone", place: "", year: "", camera: "", ratio: "2000/1125" },
    { src: "images/photos/16-gull.jpg", thumb: "images/thumbs/16-gull.jpg", title: "Gull", place: "", year: 2026, camera: "Canon EOS 6D Mark II · Tamron SP 70–200 mm f/2.8", ratio: "4760/2678" },
    { src: "images/photos/17-macau-tower.jpg", thumb: "images/thumbs/17-macau-tower.jpg", title: "Macau Tower", place: "Macau", year: 2026, camera: "Canon EOS 6D Mark II · EF 24–70 mm f/2.8L II", ratio: "5937/3958" },
    { src: "images/photos/18-polar-bear.jpg", thumb: "images/thumbs/18-polar-bear.jpg", title: "Polar Bear", place: "", year: "", camera: "", ratio: "3315/4930" },
    { src: "images/photos/19-reeds.jpg", thumb: "images/thumbs/19-reeds.jpg", title: "Reeds", place: "", year: "", camera: "", ratio: "2000/1333" },
    { src: "images/photos/20-the-long-bridge.jpg", thumb: "images/thumbs/20-the-long-bridge.jpg", title: "The Long Bridge", place: "Hong Kong", year: 2026, camera: "Canon EOS 6D Mark II · EF 24–70 mm f/2.8L II", ratio: "5290/2976" },
    { src: "images/photos/21-valley-morning.jpg", thumb: "images/thumbs/21-valley-morning.jpg", title: "Valley Morning", place: "", year: 2026, camera: "Canon EOS 6D Mark II · EF 24–70 mm f/2.8L II", ratio: "6232/3506", hero: true },
    { src: "images/photos/22-the-balcony.jpg", thumb: "images/thumbs/22-the-balcony.jpg", title: "The Balcony", place: "", year: "", camera: "", ratio: "1333/2000" },
    { src: "images/photos/23-green-tree-python.jpg", thumb: "images/thumbs/23-green-tree-python.jpg", title: "Green Tree Python", place: "", year: 2017, camera: "Canon EOS 650D · EF-S 18–135 mm", ratio: "5184/3456" },
    { src: "images/photos/24-haze-over-the-bay.jpg", thumb: "images/thumbs/24-haze-over-the-bay.jpg", title: "Haze over the Bay", place: "Hong Kong", year: 2026, camera: "Canon EOS 6D Mark II · EF 24–70 mm f/2.8L II", ratio: "5615/3158" },
    { src: "images/photos/25-morning-road.jpg", thumb: "images/thumbs/25-morning-road.jpg", title: "Morning Road", place: "", year: "", camera: "", ratio: "2000/1333", hero: true },
    { src: "images/photos/26-goldenrod.jpg", thumb: "images/thumbs/26-goldenrod.jpg", title: "Goldenrod", place: "", year: 2021, camera: "Canon EOS 650D · EF-S 18–135 mm", ratio: "4800/3200" },
    { src: "images/photos/27-branches.jpg", thumb: "images/thumbs/27-branches.jpg", title: "Branches", place: "", year: 2024, camera: "Canon EOS 6D Mark II · Tamron SP 70–200 mm f/2.8", ratio: "6240/3510" },
    { src: "images/photos/28-siesta.jpg", thumb: "images/thumbs/28-siesta.jpg", title: "Siesta", place: "", year: 2024, camera: "Canon EOS 6D Mark II · EF 24–70 mm f/2.8L II", ratio: "5515/3102" },
    { src: "images/photos/29-crossing.jpg", thumb: "images/thumbs/29-crossing.jpg", title: "Crossing", place: "", year: "", camera: "", ratio: "2000/1125" },
    { src: "images/photos/30-cheeky.jpg", thumb: "images/thumbs/30-cheeky.jpg", title: "Cheeky", place: "", year: "", camera: "", ratio: "2000/1125" },
    { src: "images/photos/31-gorge.jpg", thumb: "images/thumbs/31-gorge.jpg", title: "Gorge", place: "", year: "", camera: "", ratio: "2000/1125" },
    { src: "images/photos/32-reed-study.jpg", thumb: "images/thumbs/32-reed-study.jpg", title: "Reed Study", place: "", year: "", camera: "", ratio: "2000/1333" },
    { src: "images/photos/33-summit.jpg", thumb: "images/thumbs/33-summit.jpg", title: "Summit", place: "", year: "", camera: "", ratio: "2000/1442" },
    { src: "images/photos/34-hiding.jpg", thumb: "images/thumbs/34-hiding.jpg", title: "Hiding", place: "", year: "", camera: "", ratio: "5184/3456" },
    { src: "images/photos/35-asleep.jpg", thumb: "images/thumbs/35-asleep.jpg", title: "Asleep", place: "", year: "", camera: "", ratio: "2000/1125" },
    { src: "images/photos/36-green-study.jpg", thumb: "images/thumbs/36-green-study.jpg", title: "Green Study", place: "", year: "", camera: "", ratio: "2000/1125" },
    { src: "images/photos/37-last-light.jpg", thumb: "images/thumbs/37-last-light.jpg", title: "Last Light", place: "", year: 2024, camera: "Canon EOS 6D Mark II · EF 24–70 mm f/2.8L II", ratio: "5543/3118" },
    { src: "images/photos/38-red-sun.jpg", thumb: "images/thumbs/38-red-sun.jpg", title: "Red Sun", place: "", year: "", camera: "", ratio: "2000/1500" },
  ],

  /* ---------------------------------------------------- Filme / Standbilder
     Solange die Liste leer ist, wird der Bereich "Film Stills" ausgeblendet.
     Beispiel-Eintrag:
     {
       title: "Night Swim", year: 2025, kind: "Short Film", runtime: "14 min",
       role: "Director of Photography", stock: "ARRI Alexa Mini", aspect: "2.39",
       note: "Kurzbeschreibung.",
       stills: [
         { src: "images/stills/night-swim-1.jpg", timecode: "00:02:14:07", subtitle: "Untertitel oder leer" },
       ],
     },
  */
  films: [],
};
