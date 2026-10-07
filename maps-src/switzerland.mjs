// Switzerland: the official board's 34 cities and 17 border crossings, 76 routes (88 lanes) and 46 destination
// tickets including 12 country tickets, with its rules: 2-3 players, 40 trains, double routes open with 3 players,
// locomotives only on tunnels (a face-up locomotive counts as one card), 5 tickets dealt (keep 2), longest path +10.
// Country tickets score the best country reached, or lose the smallest value if none is.
// Sources: the Ticket to Ride wiki's lists and rules pages (ticket-to-ride.fandom.com) and Board Game Arena's map help,
// checked against a photo of the board. City positions are the board's (x, y in %).
export default {
  id: 'switzerland',
  name: 'Switzerland',
  blurb: 'Official 2–3 player board: Alpine tunnels, locomotives only for tunnels, and tickets to neighbouring countries.',
  rules: { trains: 40, players: [2, 3], doubleMin: 3, deal: { short: 5, keep: 2 }, locoUse: 'tunnel', locoDrawFree: true, bonus: ['longest'], tie: ['tickets', 'longest'] },
  layout: { kind: 'board', aspect: 0.666 },
  bbox: [5.3, 45.4, 11.0, 48.2],
  lakes: 'all',
  tints: true, // the Swiss board tints the neighbouring countries
  countries: { de: 'Deutschland', fr: 'France', it: 'Italia', at: 'Österreich' },
  cities: {
    baden: ["Baden", 8.31, 47.47, 48.2, 20.9],
    basel: ["Basel", 7.59, 47.56, 35.6, 17.9],
    bellinzona: ["Bellinzona", 9.02, 46.19, 65.7, 79.6],
    bern: ["Bern", 7.45, 46.95, 32.3, 46.0],
    brig: ["Brig", 7.99, 46.32, 43.3, 72.7],
    brusio: ["Brusio", 10.12, 46.26, 86.3, 75.6],
    chur: ["Chur", 9.53, 46.85, 74.3, 50.5],
    davos: ["Davos", 9.84, 46.8, 83.9, 50.5],
    delemont: ["Delémont", 7.34, 47.36, 28.2, 27.1],
    fribourg: ["Fribourg", 7.16, 46.8, 27.8, 52.7],
    geneve: ["Genève", 6.14, 46.2, 5.8, 79.3],
    interlaken: ["Interlaken", 7.86, 46.69, 41.2, 58.9],
    kreuzlingen: ["Kreuzlingen", 9.18, 47.65, 67.8, 13.4],
    lachauxdefonds: ["La Chaux-de-fonds", 6.83, 47.1, 17.4, 37.6],
    lausanne: ["Lausanne", 6.63, 46.52, 17.2, 63.5],
    locarno: ["Locarno", 8.8, 46.17, 59.9, 81.4],
    lugano: ["Lugano", 8.95, 46.0, 64.6, 87.9],
    luzern: ["Luzern", 8.31, 47.05, 49.4, 41.1],
    martigny: ["Martigny", 7.07, 46.1, 23.7, 84.6],
    neuchatel: ["Neuchâtel", 6.93, 46.99, 21.9, 44.0],
    olten: ["Olten", 7.9, 47.35, 40.9, 29.1],
    pfaffikon: ["Pfäffikon", 8.78, 47.2, 60.4, 35.1],
    sargans: ["Sargans", 9.44, 47.05, 71.6, 42.6],
    schaffhausen: ["Schaffhausen", 8.63, 47.7, 55.1, 9.4],
    schwyz: ["Schwyz", 8.65, 47.02, 56.2, 43.5],
    sion: ["Sion", 7.36, 46.23, 31.2, 76.4],
    solothurn: ["Solothurn", 7.54, 47.21, 33.9, 31.1],
    stgallen: ["St.Gallen", 9.37, 47.42, 70.8, 21.9],
    vaduz: ["Vaduz", 9.52, 47.14, 75.2, 35.1],
    wassen: ["Wassen", 8.6, 46.71, 57.0, 57.7],
    winterthur: ["Winterthur", 8.72, 47.5, 57.9, 17.9],
    yverdon: ["Yverdon", 6.64, 46.78, 16.2, 53.0],
    zug: ["Zug", 8.52, 47.17, 54.0, 35.1],
    zurich: ["Zürich", 8.54, 47.38, 53.9, 25.8],
    de_basel: ["Deutschland", 7.62, 47.68, 36.1, 9.2, "de"],
    de_kreuzlingeneast: ["Deutschland", 9.3, 47.75, 71.9, 6.9, "de"],
    de_kreuzlingenwest: ["Deutschland", 9.08, 47.78, 65.1, 5.2, "de"],
    de_schaffhausen: ["Deutschland", 8.62, 47.85, 59.6, 4.9, "de"],
    de_stgallen: ["Deutschland", 9.62, 47.62, 78.6, 14.2, "de"],
    fr_delemont: ["France", 7.08, 47.45, 29.4, 12.9, "fr"],
    fr_geneve: ["France", 5.98, 46.12, 4.8, 87.9, "fr"],
    fr_lachauxdefonds: ["France", 6.62, 47.18, 8.9, 31.3, "fr"],
    fr_martigny: ["France", 6.92, 45.95, 17.6, 95.1, "fr"],
    it_brig: ["Italia", 8.12, 46.08, 51.0, 89.3, "it"],
    it_brusio: ["Italia", 10.2, 46.08, 91.1, 87.8, "it"],
    it_davos: ["Italia", 10.32, 46.55, 96.6, 54.7, "it"],
    it_locarno: ["Italia", 8.72, 46.0, 57.3, 94.8, "it"],
    it_lugano: ["Italia", 8.98, 45.84, 70.2, 92.1, "it"],
    at_davos: ["Österreich", 10.3, 46.92, 96.0, 44.3, "at"],
    at_stgallen: ["Österreich", 9.75, 47.42, 86.6, 30.9, "at"],
    at_vaduz: ["Österreich", 9.68, 47.2, 81.3, 34.1, "at"],
  },
  routes: `
    baden zurich 1 yellow
    basel baden 3 red t
    basel delemont 2 yellow t
    basel de_basel 1 blue t
    basel olten 2 orange t
    bellinzona lugano 1 red/yellow x2 t
    bern interlaken 3 blue
    bern luzern 4 gray/gray x2
    bern solothurn 2 black
    brig interlaken 2 white t
    brig it_brig 3 green t
    brig locarno 6 gray t
    brig wassen 4 red t
    brusio it_brusio 2 green t
    chur brusio 5 gray t
    chur davos 2 purple t
    chur wassen 5 gray t
    davos brusio 4 blue t
    davos it_davos 3 gray t
    davos at_davos 3 gray t
    delemont fr_delemont 2 black t
    delemont lachauxdefonds 3 white t
    delemont solothurn 1 purple t
    fribourg bern 1 orange/yellow x2
    geneve fr_geneve 1 yellow
    geneve lausanne 4 blue/white x2
    interlaken luzern 4 purple
    kreuzlingen de_kreuzlingeneast 1 white
    kreuzlingen de_kreuzlingenwest 1 orange
    kreuzlingen stgallen 1 green
    lachauxdefonds fr_lachauxdefonds 2 green t
    lachauxdefonds neuchatel 1 orange t
    lachauxdefonds yverdon 3 yellow t
    lausanne fribourg 3 red/purple x2
    lausanne martigny 4 orange t
    locarno bellinzona 1 black t
    locarno it_locarno 2 orange t
    locarno lugano 1 purple t
    lugano it_lugano 2 white t
    luzern schwyz 1 blue
    martigny fr_martigny 2 gray t
    martigny sion 2 green t
    neuchatel bern 2 red
    neuchatel lausanne 4 gray
    neuchatel solothurn 4 green
    neuchatel yverdon 2 black
    olten baden 2 purple
    olten luzern 3 green
    olten zurich 3 white
    pfaffikon sargans 3 yellow t
    pfaffikon schwyz 1 purple
    pfaffikon stgallen 3 orange
    sargans chur 1 white t
    sargans davos 3 black t
    schaffhausen de_schaffhausen 1 yellow
    schaffhausen kreuzlingen 3 purple
    schaffhausen winterthur 1 white/black x2
    schaffhausen zurich 3 orange
    schwyz wassen 2 green/yellow x2 t
    sion brig 3 black t
    solothurn olten 1 blue
    stgallen de_stgallen 2 gray
    stgallen vaduz 2 blue t
    stgallen at_stgallen 4 gray t
    vaduz sargans 1 orange t
    vaduz at_vaduz 1 red t
    wassen bellinzona 4 gray/gray x2 t
    winterthur kreuzlingen 2 yellow
    winterthur stgallen 3 red
    winterthur zurich 1 blue/purple x2
    yverdon geneve 6 gray
    zug luzern 1 orange/yellow x2
    zug schwyz 1 white/black x2
    zurich pfaffikon 2 blue
    zurich stgallen 4 black
    zurich zug 1 red/green x2
  `,
  tickets: {
    list: [
      ["basel", "bern", 5],
      ["basel", "brig", 10],
      ["basel", "geneve", 13],
      ["basel", "stgallen", 8],
      ["basel", "zurich", 4],
      ["bern", "chur", 10],
      ["bern", "geneve", 8],
      ["bern", "lachauxdefonds", 3],
      ["bern", "lugano", 12],
      ["bern", "schwyz", 5],
      ["bern", "zurich", 6],
      ["brusio", "stgallen", 9],
      ["brusio", "zurich", 11],
      ["chur", "lugano", 10],
      ["fribourg", "luzern", 5],
      ["geneve", "sion", 10],
      ["geneve", "zurich", 14],
      ["interlaken", "lausanne", 7],
      ["interlaken", "winterthur", 7],
      ["kreuzlingen", "zurich", 3],
      ["lachauxdefonds", "luzern", 7],
      ["lachauxdefonds", "zurich", 8],
      ["lausanne", "luzern", 8],
      ["lausanne", "stgallen", 13],
      ["lugano", "zurich", 9],
      ["luzern", "vaduz", 6],
      ["luzern", "zurich", 2],
      ["martigny", "schaffhausen", 15],
      ["neuchatel", "winterthur", 9],
      ["olten", "schaffhausen", 5],
      ["schaffhausen", "stgallen", 4],
      ["schaffhausen", "zug", 3],
      ["schwyz", "winterthur", 3],
      ["vaduz", "zurich", 6],
      {"from": "bern", "opts": [["@fr", 5], ["@de", 6], ["@it", 8], ["@at", 11]]},
      {"from": "chur", "opts": [["@at", 3], ["@it", 5], ["@de", 6], ["@fr", 12]]},
      {"from": "lugano", "opts": [["@it", 2], ["@de", 12], ["@at", 13], ["@fr", 14]]},
      {"from": "zurich", "opts": [["@de", 3], ["@fr", 7], ["@at", 7], ["@it", 11]]},
      {"from": "@de", "opts": [["@fr", 5], ["@at", 5], ["@it", 13]]},
      {"from": "@de", "opts": [["@fr", 5], ["@at", 5], ["@it", 13]]},
      {"from": "@fr", "opts": [["@de", 5], ["@it", 11], ["@at", 14]]},
      {"from": "@fr", "opts": [["@de", 5], ["@it", 11], ["@at", 14]]},
      {"from": "@it", "opts": [["@at", 6], ["@fr", 11], ["@de", 13]]},
      {"from": "@it", "opts": [["@at", 6], ["@fr", 11], ["@de", 13]]},
      {"from": "@at", "opts": [["@de", 5], ["@it", 6], ["@fr", 14]]},
      {"from": "@at", "opts": [["@de", 5], ["@it", 6], ["@fr", 14]]},
    ],
  },
};
