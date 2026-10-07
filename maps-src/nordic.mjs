// Nordic Countries: the official board's 39 cities, 70 routes (81 lanes) and 46 destination tickets, with its rules:
// 2-3 players, 40 trains, locomotives only on tunnels and ferries, any 3 cards for a ferry locomotive, any 4 cards
// for one card on Murmansk-Lieksa, 5 tickets dealt (keep 2), returned tickets leave the game, Globetrotter +10.
// Sources: the official rulebook (Days of Wonder, 2015) and the Ticket to Ride wiki's city/route/ticket lists
// (ticket-to-ride.fandom.com), checked against a photo of the board. City positions are the board's (x, y in %).
export default {
  id: 'nordic',
  name: 'Nordic Countries',
  blurb: 'Official 2–3 player board: locomotives only on tunnels and ferries, and the 9-car run to Murmansk.',
  rules: { trains: 40, players: [2, 3], doubleMin: 3, deal: { short: 5, keep: 2 }, draw: { n: 3, keep: 1 }, ticketReturn: 'box', locoUse: 'tunnelFerry', locoDrawFree: true, ferrySub: 3, bonus: ['globetrotter'], tie: ['tickets', 'longest'] },
  layout: { kind: 'board', aspect: 1.49 },
  width: 700, // drawn smaller than the other boards so its cars come out the standard size
  bbox: [2, 54, 36, 72],
  cities: {
    bergen: ["Bergen", 5.32, 60.39, 10.8, 76.0],
    boden: ["Boden", 21.69, 65.83, 51.9, 30.2],
    goteborg: ["Göteborg", 11.97, 57.71, 46.0, 84.4],
    helsinki: ["Helsinki", 24.94, 60.17, 82.5, 58.4],
    honningsvag: ["Honningsvåg", 25.97, 70.98, 47.0, 4.1],
    imatra: ["Imatra", 28.77, 61.17, 92.2, 46.8],
    kajaani: ["Kajaani", 27.73, 64.23, 78.4, 32.2],
    karlskrona: ["Karlskrona", 15.59, 56.16, 65.8, 90.0],
    kirkenes: ["Kirkenes", 30.05, 69.73, 57.7, 8.7],
    kiruna: ["Kiruna", 20.23, 67.86, 35.8, 24.7],
    kristiansand: ["Kristiansand", 8.0, 58.15, 30.0, 85.0],
    kuopio: ["Kuopio", 27.68, 62.89, 83.5, 40.1],
    kbenhavn: ["København", 12.57, 55.68, 52.0, 94.6],
    lahti: ["Lahti", 25.66, 60.98, 82.2, 52.4],
    lieksa: ["Lieksa", 30.02, 63.32, 85.7, 34.9],
    lillehammer: ["Lillehammer", 10.47, 61.12, 29.0, 68.0],
    moirana: ["Mo i Rana", 14.14, 66.31, 25.9, 36.6],
    murmansk: ["Murmansk", 33.08, 68.97, 72.4, 6.3],
    narvik: ["Narvik", 17.43, 68.44, 28.4, 23.3],
    norrkoping: ["Norrköping", 16.19, 58.59, 62.4, 76.7],
    oslo: ["Oslo", 10.75, 59.91, 35.7, 76.7],
    oulu: ["Oulu", 25.47, 65.01, 65.1, 33.4],
    rovaniemi: ["Rovaniemi", 25.73, 66.5, 60.6, 24.1],
    stavanger: ["Stavanger", 5.73, 58.97, 16.9, 84.3],
    stockholm: ["Stockholm", 18.07, 59.33, 63.1, 69.9],
    sundsvall: ["Sundsvall", 17.31, 62.39, 49.6, 54.9],
    tallinn: ["Tallinn", 24.75, 59.44, 85.1, 64.9],
    tampere: ["Tampere", 23.76, 61.5, 73.9, 52.4],
    tornio: ["Tornio", 24.15, 65.85, 59.5, 29.4],
    troms: ["Tromsø", 18.96, 69.65, 32.3, 15.1],
    trondheim: ["Trondheim", 10.4, 63.43, 25.8, 56.8],
    turku: ["Turku", 22.27, 60.45, 73.6, 58.3],
    umea: ["Umeå", 20.26, 63.83, 55.1, 42.7],
    vaasa: ["Vaasa", 21.62, 63.1, 61.4, 46.1],
    alborg: ["Ålborg", 9.92, 57.05, 38.9, 90.1],
    andalsnes: ["Åndalsnes", 7.69, 62.57, 19.0, 61.3],
    arhus: ["Århus", 10.2, 56.16, 43.1, 95.1],
    orebro: ["Örebro", 15.21, 59.27, 48.8, 72.9],
    ostersund: ["Östersund", 14.64, 63.18, 37.4, 53.2],
  },
  routes: `
    bergen oslo 4 blue/red x2 t
    bergen stavanger 2 purple f1
    boden umea 3 white/red x2
    goteborg kbenhavn 2 black f1
    goteborg norrkoping 3 gray
    goteborg alborg 2 gray f1
    helsinki tallinn 2 purple f1
    honningsvag kirkenes 2 green f1
    honningsvag troms 4 purple f2
    imatra helsinki 3 red
    kajaani kuopio 2 green
    kajaani lieksa 1 blue
    kirkenes murmansk 3 white f1
    kirkenes rovaniemi 5 blue
    kiruna boden 3 black/orange x2
    kristiansand oslo 2 black
    kristiansand alborg 2 red f1
    kuopio imatra 2 purple
    kuopio lieksa 1 black
    kbenhavn karlskrona 2 green/blue x2 f1
    lahti helsinki 1 black
    lahti imatra 2 yellow
    lahti kuopio 3 white
    moirana trondheim 6 red f2
    moirana trondheim 5 green t
    murmansk lieksa 9 gray s4
    narvik kiruna 1 purple/white x2 t
    narvik moirana 4 orange f2
    norrkoping karlskrona 3 white/yellow x2
    oslo goteborg 2 orange
    oslo lillehammer 2 purple t
    oslo alborg 3 white f1
    oslo orebro 2 yellow/green x2
    oulu kajaani 2 yellow
    oulu kuopio 3 gray
    oulu vaasa 3 black
    rovaniemi oulu 2 orange
    rovaniemi tornio 1 red
    stavanger kristiansand 3 orange f1
    stavanger kristiansand 2 green t
    stockholm helsinki 4 yellow f1
    stockholm helsinki 4 gray f2
    stockholm norrkoping 1 orange/red x2
    stockholm tallinn 4 green f2
    stockholm turku 3 blue f1
    sundsvall stockholm 4 gray/gray x2
    sundsvall orebro 4 orange
    tampere helsinki 1 orange
    tampere lahti 1 blue
    tornio boden 1 green
    tornio oulu 1 white
    troms narvik 3 yellow f1
    trondheim lillehammer 3 orange t
    trondheim andalsnes 2 white f1
    trondheim ostersund 2 black t
    turku helsinki 1 white
    turku tampere 1 red
    umea sundsvall 3 purple/yellow x2
    umea vaasa 1 gray f1
    vaasa kuopio 4 gray
    vaasa sundsvall 3 blue f1
    vaasa tampere 2 purple
    alborg arhus 1 purple
    andalsnes bergen 5 gray f2
    andalsnes lillehammer 2 yellow t
    arhus kbenhavn 1 gray f1
    orebro goteborg 2 blue
    orebro norrkoping 2 gray
    orebro stockholm 2 purple/black x2
    ostersund sundsvall 2 green
  `,
  tickets: {
    list: [
      ["alborg", "norrkoping", 5],
      ["alborg", "umea", 11],
      ["arhus", "lillehammer", 6],
      ["bergen", "narvik", 16],
      ["bergen", "kbenhavn", 8],
      ["bergen", "trondheim", 7],
      ["bergen", "tornio", 17],
      ["goteborg", "andalsnes", 6],
      ["goteborg", "oulu", 12],
      ["goteborg", "turku", 7],
      ["helsinki", "bergen", 12],
      ["helsinki", "kirkenes", 13],
      ["helsinki", "kiruna", 10],
      ["helsinki", "kbenhavn", 10],
      ["helsinki", "lieksa", 5],
      ["helsinki", "ostersund", 8],
      ["kbenhavn", "murmansk", 24],
      ["kbenhavn", "narvik", 18],
      ["kbenhavn", "oulu", 14],
      ["kristiansand", "moirana", 12],
      ["narvik", "murmansk", 12],
      ["narvik", "tallinn", 13],
      ["norrkoping", "boden", 11],
      ["orebro", "kuopio", 10],
      ["oslo", "helsinki", 8],
      ["oslo", "honningsvag", 21],
      ["oslo", "kbenhavn", 4],
      ["oslo", "moirana", 10],
      ["oslo", "stavanger", 4],
      ["oslo", "stockholm", 4],
      ["oslo", "vaasa", 9],
      ["stavanger", "karlskrona", 8],
      ["stavanger", "rovaniemi", 18],
      ["stockholm", "bergen", 8],
      ["stockholm", "imatra", 7],
      ["stockholm", "kajaani", 10],
      ["stockholm", "kbenhavn", 6],
      ["stockholm", "troms", 17],
      ["stockholm", "umea", 7],
      ["sundsvall", "lahti", 6],
      ["tampere", "boden", 6],
      ["tampere", "kristiansand", 10],
      ["tampere", "tallinn", 3],
      ["troms", "vaasa", 11],
      ["tornio", "imatra", 6],
      ["turku", "trondheim", 10],
    ],
  },
};
