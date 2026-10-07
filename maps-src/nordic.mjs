// Nordic countries: a compact map for 2 or 3 players, with fjord tunnels, Baltic ferries and the long haul to Murmansk.
export default {
  id: 'nordic',
  name: 'Nordic Countries',
  blurb: 'For 2–3 players. Ferries, tunnels, and the 9-car run to Murmansk.',
  rules: { trains: 40, players: [2, 3], doubleMin: 3, deal: { short: 5, keep: 2 }, bonus: ['globetrotter'], locos: 18 },
  bbox: [3.2, 54.6, 35.2, 71.6],
  kmPerTrain: 120,
  grayShare: 0.3,
  cities: {
    hon: ['Honningsvåg', 25.97, 70.98],
    kir: ['Kirkenes', 30.05, 69.73],
    mur: ['Murmansk', 33.08, 68.97],
    tro: ['Tromsø', 18.96, 69.65],
    nar: ['Narvik', 17.43, 68.44],
    krn: ['Kiruna', 20.23, 67.86],
    bod: ['Bodø', 14.4, 67.28],
    moi: ['Mo i Rana', 14.14, 66.31],
    bdn: ['Boden', 21.69, 65.83],
    tor: ['Tornio', 24.15, 65.85],
    rov: ['Rovaniemi', 25.73, 66.5],
    oul: ['Oulu', 25.47, 65.01],
    kaj: ['Kajaani', 27.73, 64.23],
    lie: ['Lieksa', 30.02, 63.32],
    vaa: ['Vaasa', 21.62, 63.1],
    ume: ['Umeå', 20.26, 63.83],
    sun: ['Sundsvall', 17.31, 62.39],
    ost: ['Östersund', 14.64, 63.18],
    trd: ['Trondheim', 10.4, 63.43],
    ale: ['Ålesund', 6.15, 62.47],
    lil: ['Lillehammer', 10.47, 61.12],
    ber: ['Bergen', 5.32, 60.39],
    sta: ['Stavanger', 5.73, 58.97],
    krs: ['Kristiansand', 8.0, 58.15],
    osl: ['Oslo', 10.75, 59.91],
    got: ['Göteborg', 11.97, 57.71],
    ore: ['Örebro', 15.21, 59.27],
    sto: ['Stockholm', 18.07, 59.33],
    nrk: ['Norrköping', 16.19, 58.59],
    kar: ['Karlskrona', 15.59, 56.16],
    kob: ['København', 12.57, 55.68],
    aar: ['Århus', 10.2, 56.16],
    aal: ['Aalborg', 9.92, 57.05],
    tur: ['Turku', 22.27, 60.45],
    tam: ['Tampere', 23.76, 61.5],
    hel: ['Helsinki', 24.94, 60.17],
    kuo: ['Kuopio', 27.68, 62.89],
    ima: ['Imatra', 28.77, 61.17],
    tal: ['Tallinn', 24.75, 59.44],
  },
  routes: `
    hon kir 4
    hon tro 4 f1
    kir mur 2
    mur lie 9
    mur rov 6
    kir rov 6
    tro nar 2
    nar krn 2 t x2
    nar bod 3 f1
    bod moi 2 t
    tro bod 4 f2
    krn bdn 3
    bdn tor 2
    bdn ume 3
    tor rov 2
    tor oul 2 x2
    rov oul 2
    oul kaj 2
    oul vaa 3
    kaj lie 2
    kaj kuo 2
    lie ima 3
    kuo ima 2
    kuo tam 3
    vaa ume 1 f1
    vaa tam 3
    vaa tur 3
    tam tur 2
    tam hel 2 x2
    tur hel 2
    hel ima 3
    hel tal 1 f1 x2
    tal sto 4 f2
    tur sto 3 f1
    ume sun 3
    ume ost 3
    sun ost 2
    sun sto 4
    sun ore 4
    ost trd 2 t
    moi trd 4 t
    trd ale 3 t
    trd lil 3 t
    ale lil 2 t
    ale ber 3 f1
    ber lil 3 t
    ber osl 4 t
    ber sta 2 f1
    sta krs 2
    krs osl 2
    krs aal 2 f2
    lil osl 2
    osl ore 3
    osl got 2 x2
    got ore 2
    got kob 2 x2
    got aal 2 f1
    ore sto 2
    ore nrk 1
    sto nrk 1 x2
    nrk kar 3
    kar kob 2
    kob aar 2 f1
    aar aal 1
    kar got 3
  `,
  tickets: { bands: [[16, 3, 7], [18, 7, 12], [12, 12, 20]] },
};
