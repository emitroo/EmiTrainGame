// Britain & Ireland: short hops, Highland and Pennine tunnels, and ferries across the Irish Sea and the Channel.
export default {
  id: 'britain',
  name: 'Britain & Ireland',
  blurb: 'Dense and tactical: short routes, Irish Sea ferries, Highland tunnels.',
  rules: { trains: 35, players: [2, 4], doubleMin: 4, deal: { short: 4, keep: 2 }, bonus: ['longest'] },
  bbox: [-10.8, 49.2, 2.6, 58.2],
  kmPerTrain: 62,
  cities: {
    inv: ['Inverness', -4.22, 57.48],
    abd: ['Aberdeen', -2.09, 57.15],
    fwm: ['Fort William', -5.11, 56.82],
    dun: ['Dundee', -2.97, 56.46],
    gla: ['Glasgow', -4.25, 55.86],
    edi: ['Edinburgh', -3.19, 55.95],
    str: ['Stranraer', -5.03, 54.9],
    crl: ['Carlisle', -2.93, 54.89],
    new: ['Newcastle', -1.61, 54.97],
    yor: ['York', -1.08, 53.96],
    lee: ['Leeds', -1.55, 53.8],
    man: ['Manchester', -2.24, 53.48],
    liv: ['Liverpool', -2.98, 53.41],
    hul: ['Hull', -0.33, 53.74],
    she: ['Sheffield', -1.47, 53.38],
    not: ['Nottingham', -1.15, 52.95],
    bir: ['Birmingham', -1.9, 52.49],
    hol: ['Holyhead', -4.63, 53.31],
    abe: ['Aberystwyth', -4.08, 52.42],
    swa: ['Swansea', -3.94, 51.62],
    cdf: ['Cardiff', -3.18, 51.48],
    bri: ['Bristol', -2.59, 51.45],
    pen: ['Penzance', -5.54, 50.12],
    ply: ['Plymouth', -4.14, 50.37],
    exe: ['Exeter', -3.53, 50.72],
    sou: ['Southampton', -1.4, 50.9],
    oxf: ['Oxford', -1.26, 51.75],
    lon: ['London', -0.13, 51.51],
    cam: ['Cambridge', 0.12, 52.21],
    nwi: ['Norwich', 1.3, 52.63],
    bgt: ['Brighton', -0.14, 50.82],
    dov: ['Dover', 1.31, 51.13],
    cls: ['Calais', 1.86, 50.95],
    lhv: ['Le Havre', 0.11, 49.49],
    dub: ['Dublin', -6.26, 53.35],
    bel: ['Belfast', -5.93, 54.6],
    der: ['Derry', -7.31, 55.0],
    gal: ['Galway', -9.05, 53.27],
    lim: ['Limerick', -8.63, 52.66],
    cor: ['Cork', -8.47, 51.9],
    ros: ['Rosslare', -6.34, 52.25],
  },
  routes: `
    inv abd 3
    inv fwm 3 t
    inv dun 4 t
    abd dun 2
    fwm gla 3 t
    dun edi 1
    dun gla 2
    gla edi 1 x2
    gla str 2
    gla crl 3
    edi crl 3 t
    edi new 3
    str bel 1 f1
    str crl 3
    crl new 2
    crl man 3 t
    new yor 2
    yor lee 1
    yor hul 1
    lee man 1 t x2
    lee she 1
    man liv 1 x2
    man she 1 t
    liv hol 2
    liv bir 2
    man bir 2
    hol dub 2 f2
    hol abe 2
    abe swa 2 t
    abe bir 3 t
    swa cdf 1
    swa ros 3 f2
    cdf bri 1
    cdf bir 3
    bri bir 2
    bri oxf 2
    bri exe 2
    exe ply 1
    ply pen 2
    exe sou 3
    sou oxf 2
    sou lon 2 x2
    sou bgt 2
    sou lhv 3 f2
    bgt lon 1
    bgt dov 2
    dov lon 2
    dov cls 1 f1 x2
    cls lhv 3
    lon oxf 1 x2
    lon cam 1
    lon bir 2
    cam nwi 2
    nwi hul 3 f1
    cam not 2
    not she 1
    not bir 1
    bir oxf 2
    hul she 1
    bel der 2
    bel dub 2 x2
    der gal 4
    gal lim 1
    gal dub 3
    dub ros 2
    dub lim 3
    lim cor 1
    cor ros 3
    cor pen 6 f2
  `,
  tickets: { bands: [[14, 3, 6], [16, 6, 10], [10, 10, 16]] },
};
