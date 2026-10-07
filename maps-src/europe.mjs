// Europe, c. 1900: tunnels through the mountains, ferries across the seas, and stations.
export default {
  id: 'europe',
  name: 'Europe',
  blurb: 'Tunnels, ferries and stations, from Lisboa to Erzurum.',
  rules: { trains: 45, stations: 3, players: [2, 5], doubleMin: 4, deal: { long: 1, short: 3, keep: 2 }, bonus: ['longest'] },
  bbox: [-11, 34.4, 45.5, 62.6],
  kmPerTrain: 165,
  cities: {
    edi: ['Edinburgh', -3.19, 55.95],
    lon: ['London', -0.13, 51.51],
    ams: ['Amsterdam', 4.9, 52.37],
    bru: ['Bruxelles', 4.35, 50.85],
    par: ['Paris', 2.35, 48.86],
    bre: ['Brest', -4.49, 48.39],
    bor: ['Bordeaux', -0.58, 44.84],
    lyo: ['Lyon', 4.84, 45.76],
    mar: ['Marseille', 5.37, 43.3],
    pam: ['Pamplona', -1.64, 42.81],
    bar: ['Barcelona', 2.17, 41.39],
    mad: ['Madrid', -3.7, 40.42],
    lis: ['Lisboa', -9.14, 38.72],
    cad: ['Cádiz', -6.29, 36.53],
    ess: ['Essen', 7.01, 51.46],
    fra: ['Frankfurt', 8.68, 50.11],
    mun: ['München', 11.58, 48.14],
    zur: ['Zürich', 8.54, 47.38],
    ber: ['Berlin', 13.4, 52.52],
    kob: ['København', 12.57, 55.68],
    osl: ['Kristiania', 10.75, 59.91],
    sto: ['Stockholm', 18.07, 59.33],
    dan: ['Danzig', 18.65, 54.35],
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
    edi lon 4 x2
    lon ams 2 f2
    lon par 2 f1 x2
    bre par 3
    bre bor 4
    par bru 2 x2
    par fra 3 x2
    par zur 3 t
    par lyo 3
    par bor 3
    lyo mar 2
    lyo zur 2 t
    bor pam 2
    pam mad 3 t x2
    pam bar 2 t
    bar mar 4
    bar mad 2
    mad lis 3
    lis cad 2
    mad cad 3
    mar zur 3 t
    mar rom 4 t
    ams bru 1
    ams ess 2
    bru fra 2
    ess fra 2
    ess ber 2
    ess kob 3 f1 x2
    fra mun 2
    fra ber 3
    ber dan 4
    ber war 3 x2
    ber wie 3
    mun wie 3
    mun zur 2 t
    mun ven 2 t
    zur ven 2 t
    ven rom 2
    ven zag 2
    rom bri 2
    rom pal 4 f1
    pal bri 3 f1
    pal smy 6 f2 b+45
    bri ath 4 f1
    wie bud 1 x2
    wie zag 2
    wie war 4
    bud zag 2
    bud sar 3
    bud kyi 6 t
    bud buc 4 t
    zag sar 3
    sar ath 4
    sar sof 2 t
    ath sof 3
    ath smy 2 f1
    sof buc 2 t
    sof con 3
    buc con 3
    buc kyi 4
    buc sev 4
    con sev 4 f2
    con smy 2 t
    con ang 2 t
    smy ang 3 t
    ang erz 3
    erz soc 3 t
    sev soc 2 f1
    sev ros 4
    soc ros 2
    ros khr 2 x2
    khr kyi 4
    khr mos 4
    kyi wil 2
    kyi smo 3
    kyi war 4
    war wil 3
    war dan 2
    wil rig 4
    wil smo 3
    wil pet 4
    rig pet 4
    rig dan 3
    smo mos 2
    mos pet 4
    pet sto 8 t
    sto kob 3 x2
    osl sto 4
    osl kob 3 f2
  `,
  tickets: { long: 6, longRange: [18, 22], bands: [[14, 5, 8], [16, 8, 12], [10, 12, 14]] },
};
