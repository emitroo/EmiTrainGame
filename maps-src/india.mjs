// India, 1911: the official board's 39 cities, 80 routes and 58 destination tickets, with its rules: 2-4 players,
// 45 trains, double routes open only with 4 players, ferries, 4 tickets dealt (keep 2), Indian Express (longest path)
// +10 and the Mandala bonus for tickets joined by two separate paths (5, 10, 20, 30, 40).
// Sources: the official rulebook (Days of Wonder, 2018) and the Ticket to Ride wiki's lists (ticket-to-ride.fandom.com),
// checked against a photo of the board. City positions are the board's (x, y in %).
export default {
  id: 'india',
  name: 'India',
  blurb: 'Official 1911 board for 2–4: Mandala bonus for joining a ticket\u2019s cities two separate ways.',
  rules: { trains: 45, players: [2, 4], doubleMin: 4, deal: { short: 4, keep: 2 }, bonus: ['longest', 'mandala'], tie: ['tickets', 'longest'] },
  layout: { kind: 'board', aspect: 1.333 },
  bbox: [60, 5, 98, 37],
  cities: {
    agra: ["Agra", 78.01, 27.18, 42.4, 38.8],
    ahmadabad: ["Ahmadabad", 72.57, 23.02, 22.0, 45.0],
    ambala: ["Ambala", 76.78, 30.38, 42.0, 20.7],
    bareilly: ["Bareilly", 79.43, 28.37, 49.6, 28.3],
    bezwada: ["Bezwada", 80.65, 16.51, 51.3, 62.8],
    bhatinda: ["Bhatinda", 74.95, 30.21, 28.0, 20.9],
    bhopal: ["Bhopal", 77.41, 23.26, 42.0, 44.3],
    bilaspur: ["Bilaspur", 82.14, 22.08, 55.4, 44.3],
    bombay: ["Bombay", 72.88, 19.08, 24.0, 57.6],
    calcutta: ["Calcutta", 88.36, 22.57, 77.4, 45.9],
    calicut: ["Calicut", 75.78, 11.26, 32.5, 77.2],
    chittagong: ["Chittagong", 91.83, 22.36, 90.6, 44.4],
    delhi: ["Delhi", 77.21, 28.61, 40.9, 29.9],
    dhubri: ["Dhubri", 89.99, 26.02, 82.1, 37.3],
    erode: ["Erode", 77.72, 11.34, 50.9, 78.0],
    guntakal: ["Guntakal", 77.38, 15.17, 39.0, 66.3],
    indur: ["Indur", 78.09, 18.67, 49.9, 54.1],
    jacobabad: ["Jacobabad", 68.44, 28.28, 14.2, 22.8],
    jaipur: ["Jaipur", 75.79, 26.91, 33.5, 37.2],
    jodhpur: ["Jodhpur", 73.02, 26.24, 23.5, 32.9],
    jorhat: ["Jorhat", 94.2, 26.75, 93.6, 32.4],
    karachi: ["Karachi", 67.0, 24.86, 6.4, 36.9],
    katni: ["Katni", 80.39, 23.83, 56.1, 38.9],
    khandwa: ["Khandwa", 76.35, 21.82, 32.7, 49.9],
    lahore: ["Lahore", 74.34, 31.55, 23.6, 12.2],
    lucknow: ["Lucknow", 80.95, 26.85, 53.4, 33.9],
    madras: ["Madras", 80.27, 13.08, 52.1, 68.5],
    mangalore: ["Mangalore", 74.86, 12.91, 30.5, 71.6],
    manmad: ["Manmad", 74.44, 20.25, 32.0, 55.2],
    mormugao: ["Mormugao", 73.8, 15.4, 25.1, 63.4],
    patna: ["Patna", 85.14, 25.59, 68.8, 37.3],
    peshawar: ["Peshawar", 71.58, 34.01, 14.9, 10.8],
    poona: ["Poona", 73.86, 18.52, 32.0, 60.6],
    quilon: ["Quilon", 76.61, 8.89, 38.0, 85.4],
    raipur: ["Raipur", 81.63, 21.25, 53.9, 49.7],
    ratlam: ["Ratlam", 75.04, 23.33, 29.6, 42.2],
    rohri: ["Rohri", 68.9, 27.69, 18.9, 27.7],
    wadi: ["Wadi", 76.99, 17.06, 40.4, 61.0],
    waltain: ["Waltair", 83.3, 17.72, 64.7, 59.1],
  },
  routes: `
    agra bhopal 1 purple/red x2
    agra delhi 2 orange
    agra jaipur 1 blue/white x2
    agra katni 2 green
    agra lucknow 2 gray
    ahmadabad bombay 3 white
    ahmadabad jodhpur 3 black/purple x2
    ahmadabad khandwa 2 yellow
    ahmadabad ratlam 1 green
    ambala bareilly 2 orange
    ambala bhatinda 2 white/yellow x2
    ambala delhi 2 gray/gray x2
    ambala lahore 4 black
    bareilly delhi 1 white
    bareilly lucknow 1 gray
    bareilly patna 4 green
    bezwada guntakal 2 blue
    bezwada indur 2 green/yellow x2
    bezwada madras 1 red
    bezwada waltain 2 black/orange x2
    bhatinda delhi 3 blue
    bhatinda jodhpur 3 green
    bhatinda lahore 2 gray/gray x2
    bhatinda rohri 2 purple
    bhopal bilaspur 2 gray/gray x2
    bhopal khandwa 2 blue
    bhopal ratlam 2 black
    bilaspur calcutta 4 yellow
    bilaspur katni 1 purple/white x2
    bilaspur raipur 1 red/black x2
    bombay calicut 6 gray f2 b+38
    bombay karachi 6 gray/gray x2 f2 b+30
    bombay manmad 1 black
    bombay mormugao 1 green
    bombay poona 1 blue
    calcutta chittagong 2 gray/gray x2 f1
    calcutta dhubri 2 gray/gray x2
    calcutta madras 8 gray f2 b-70
    calcutta patna 2 purple
    calcutta raipur 4 blue
    calcutta waltain 4 red
    calicut erode 3 red/blue x2
    calicut mangalore 1 yellow/white x2
    calicut quilon 2 gray/gray x2 f1
    chittagong dhubri 2 white
    chittagong jorhat 3 gray
    delhi jaipur 2 purple
    delhi lucknow 2 yellow
    dhubri jorhat 2 gray/gray x2
    dhubri patna 2 blue/red x2
    erode madras 2 green/orange x2
    erode quilon 4 gray
    guntakal madras 2 white
    guntakal mangalore 2 gray
    guntakal mormugao 2 red
    guntakal wadi 1 purple/black x2
    indur manmad 3 purple
    indur wadi 2 gray
    jacobabad karachi 4 white
    jacobabad lahore 3 red
    jacobabad peshawar 3 orange/yellow x2
    jacobabad rohri 1 green/blue x2
    jaipur jodhpur 2 red
    jaipur ratlam 1 orange/yellow x2
    jodhpur karachi 3 orange
    karachi rohri 3 black
    katni lucknow 1 black/blue x2
    katni patna 2 gray/gray x2
    khandwa manmad 1 red
    khandwa raipur 4 orange
    khandwa ratlam 2 gray
    lahore peshawar 1 purple/green x2
    madras mangalore 4 purple
    madras waltain 3 yellow
    mangalore mormugao 2 black
    manmad poona 1 gray
    mormugao poona 1 gray
    mormugao wadi 2 gray
    poona wadi 1 orange
    raipur waltain 3 green/white x2
  `,
  tickets: {
    list: [
      ["agra", "jorhat", 8],
      ["ahmadabad", "calicut", 7],
      ["ambala", "mormugao", 10],
      ["ambala", "ratlam", 5],
      ["ambala", "waltain", 9],
      ["bareilly", "ahmadabad", 5],
      ["bareilly", "calcutta", 6],
      ["bareilly", "guntakal", 10],
      ["bhatinda", "bezwada", 13],
      ["bhatinda", "bilaspur", 7],
      ["bhatinda", "manmad", 9],
      ["bhopal", "calcutta", 6],
      ["bhopal", "mormugao", 5],
      ["bilaspur", "calicut", 10],
      ["bilaspur", "dhubri", 5],
      ["bombay", "bezwada", 5],
      ["bombay", "quilon", 6],
      ["calcutta", "erode", 9],
      ["calcutta", "indur", 8],
      ["chittagong", "wadi", 11],
      ["delhi", "calicut", 11],
      ["delhi", "chittagong", 9],
      ["delhi", "indur", 9],
      ["dhubri", "mangalore", 12],
      ["guntakal", "raipur", 7],
      ["jacobabad", "bombay", 10],
      ["jacobabad", "calcutta", 13],
      ["jacobabad", "ratlam", 9],
      ["jaipur", "patna", 5],
      ["jaipur", "poona", 5],
      ["jaipur", "raipur", 5],
      ["jodhpur", "guntakal", 9],
      ["jodhpur", "khandwa", 5],
      ["jodhpur", "lucknow", 5],
      ["jorhat", "bombay", 13],
      ["karachi", "ahmadabad", 6],
      ["karachi", "delhi", 7],
      ["karachi", "poona", 7],
      ["katni", "khandwa", 5],
      ["katni", "wadi", 8],
      ["katni", "waltain", 5],
      ["khandwa", "chittagong", 10],
      ["lahore", "delhi", 5],
      ["lahore", "dhubri", 12],
      ["lahore", "wadi", 13],
      ["lucknow", "bombay", 7],
      ["lucknow", "erode", 11],
      ["madras", "quilon", 6],
      ["manmad", "erode", 7],
      ["patna", "madras", 9],
      ["patna", "mormugao", 10],
      ["peshawar", "bhopal", 9],
      ["peshawar", "madras", 17],
      ["raipur", "manmad", 5],
      ["ratlam", "bezwada", 8],
      ["rohri", "agra", 7],
      ["rohri", "mangalore", 12],
      ["waltain", "mangalore", 6],
    ],
  },
};
