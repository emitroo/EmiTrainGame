// Europe, c. 1901: the 47 cities, 90 connections and 46 destination tickets of the classic Europe board,
// with tunnels, ferries and stations. Positions are real coordinates; the generator lays the routes out.
export default {
  id: 'europe',
  name: 'Europe',
  blurb: 'The classic board: tunnels, ferries and stations, from Edinburgh to Erzurum.',
  rules: { trains: 45, stations: 3, players: [2, 5], doubleMin: 4, deal: { long: 1, short: 3, keep: 2 }, bonus: ['longest'] },
  bbox: [-11.2, 34.6, 45.2, 61.8],
  kmPerTrain: 165,
  cities: {
    edi: ['Edinburgh', -3.19, 55.95],
    lon: ['London', -0.13, 51.51, -22, -10],
    die: ['Dieppe', 1.08, 49.92, -14, 4],
    bre: ['Brest', -4.49, 48.39],
    par: ['Paris', 2.35, 48.86, 12, 14],
    ams: ['Amsterdam', 4.9, 52.37, -14, -16],
    bru: ['Bruxelles', 4.35, 50.85, -8, 2],
    ess: ['Essen', 7.01, 51.46, 14, -6],
    fra: ['Frankfurt', 8.68, 50.11, 10, 6],
    mun: ['München', 11.58, 48.14],
    zur: ['Zürich', 8.54, 47.38],
    mar: ['Marseille', 5.37, 43.3],
    pam: ['Pamplona', -1.64, 42.81],
    bar: ['Barcelona', 2.17, 41.39],
    mad: ['Madrid', -3.7, 40.42],
    lis: ['Lisboa', -9.14, 38.72],
    cad: ['Cádiz', -6.29, 36.53],
    kob: ['København', 12.57, 55.68],
    sto: ['Stockholm', 18.07, 59.33],
    ber: ['Berlin', 13.4, 52.52, -6, 0],
    dan: ['Danzic', 18.65, 54.35],
    war: ['Warszawa', 21.01, 52.23],
    wie: ['Wien', 16.37, 48.21],
    bud: ['Budapest', 19.04, 47.5],
    zag: ['Zagrab', 15.98, 45.81],
    ven: ['Venezia', 12.33, 45.44],
    rom: ['Roma', 12.5, 41.9],
    pal: ['Palermo', 13.36, 38.12],
    bri: ['Brindisi', 17.94, 40.63],
    sar: ['Sarajevo', 18.41, 43.86],
    ath: ['Athina', 23.73, 37.98],
    sof: ['Sofia', 23.32, 42.7],
    buc: ['Bucuresti', 26.1, 44.43],
    con: ['Constantinople', 28.98, 41.01],
    smy: ['Smyrna', 27.14, 38.42],
    ang: ['Angora', 32.86, 39.93],
    erz: ['Erzurum', 41.27, 39.9],
    sev: ['Sevastopol', 33.52, 44.62],
    soc: ['Sochi', 39.73, 43.6],
    ros: ['Rostov', 39.7, 47.24],
    khr: ['Kharkov', 36.23, 49.99],
    kyi: ['Kyiv', 30.52, 50.45],
    wil: ['Wilno', 25.28, 54.69],
    rig: ['Riga', 24.11, 56.95],
    pet: ['Petrograd', 30.31, 59.94],
    smo: ['Smolensk', 32.05, 54.78],
    mos: ['Moskva', 37.62, 55.76],
  },
  routes: `
    edi lon 4 black/orange x2
    lon die 2 f1 x2
    lon ams 2 f2
    die bre 2 orange
    die par 1 purple
    die bru 2 green
    bre par 3 black
    bre pam 4 purple
    par bru 2 yellow/red x2
    par fra 3 white/orange x2
    par pam 4 blue/green x2
    par mar 4 gray
    par zur 3 gray t
    pam mad 3 black/white t x2
    pam bar 2 gray t
    pam mar 4 red
    mad lis 3 purple
    mad cad 3 orange
    mad bar 2 yellow
    lis cad 2 blue
    bar mar 4 gray
    mar zur 2 gray t
    mar rom 4 gray t
    bru ams 1 black
    bru fra 2 blue
    ams ess 3 yellow
    ams fra 2 white
    fra ess 2 green
    fra mun 2 purple
    fra ber 3 black/red x2
    ess ber 2 blue
    ess kob 3 f1 x2
    kob sto 3 yellow/white x2
    sto pet 8 gray t
    ber dan 4 gray
    ber war 4 purple/yellow x2
    ber wie 3 green
    mun wie 3 orange
    mun zur 2 yellow t
    mun ven 2 blue t
    zur ven 2 green t
    ven rom 2 black
    ven zag 2 gray
    rom bri 2 white
    rom pal 4 f1
    pal bri 3 f1
    pal smy 6 f2 b+40
    bri ath 4 f1
    wie bud 1 red/white x2
    wie zag 2 gray
    wie war 4 blue
    zag bud 2 orange
    zag sar 3 red
    bud sar 3 purple
    bud kyi 6 gray t
    bud buc 4 gray t
    sar ath 4 green
    sar sof 2 gray t
    ath sof 3 purple
    ath smy 2 f1
    sof buc 2 gray t
    sof con 3 blue
    buc con 3 yellow
    buc kyi 4 gray
    buc sev 4 white
    con sev 4 f2
    con smy 2 gray t
    con ang 2 gray t
    smy ang 3 orange t
    ang erz 3 black
    erz soc 3 red t
    erz sev 4 f2
    sev soc 2 f1
    sev ros 4 gray
    soc ros 2 gray
    ros khr 2 green
    khr kyi 4 gray
    khr mos 4 gray
    kyi war 4 gray
    kyi wil 2 gray
    kyi smo 3 red
    war dan 2 gray
    war wil 3 red
    dan rig 3 black
    rig wil 4 green
    rig pet 4 gray
    wil pet 4 blue
    wil smo 3 yellow
    smo mos 2 orange
    mos pet 4 white
  `,
  tickets: {
    list: [
      ['pal', 'mos', 20, 1], ['bre', 'pet', 20, 1], ['lis', 'dan', 20, 1], ['edi', 'ath', 21, 1], ['cad', 'sto', 21, 1], ['kob', 'erz', 21, 1],
      ['ven', 'con', 10], ['lon', 'wie', 10], ['ang', 'khr', 10], ['ess', 'kyi', 10], ['rig', 'buc', 10], ['sto', 'wie', 10],
      ['ath', 'wil', 11], ['ams', 'wil', 12], ['ber', 'mos', 12], ['fra', 'smo', 13],
      ['rom', 'smy', 8], ['mad', 'zur', 8], ['par', 'wie', 8], ['bre', 'ven', 8], ['pal', 'con', 8], ['mad', 'die', 8], ['ber', 'buc', 8], ['bar', 'bru', 8],
      ['ber', 'rom', 9], ['bru', 'dan', 9],
      ['par', 'zag', 7], ['ams', 'pam', 7], ['lon', 'ber', 7], ['bre', 'mar', 7], ['edi', 'par', 7],
      ['mar', 'ess', 8], ['smo', 'ros', 8], ['bar', 'mun', 8], ['sar', 'sev', 8], ['kyi', 'soc', 8],
      ['ath', 'ang', 5], ['sof', 'smy', 5], ['fra', 'kob', 5], ['bud', 'sof', 5], ['ros', 'erz', 5],
      ['war', 'smo', 6], ['zur', 'bri', 6], ['zag', 'bri', 6], ['kyi', 'pet', 6], ['zur', 'bud', 6],
    ],
  },
};
