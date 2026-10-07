// North America: the classic coast-to-coast race. No tunnels, ferries or stations; the longest route matters.
export default {
  id: 'usa',
  name: 'North America',
  blurb: 'The classic: coast to coast, long routes score big.',
  rules: { trains: 45, players: [2, 5], doubleMin: 4, deal: { short: 3, keep: 2 }, bonus: ['longest'] },
  bbox: [-127, 23.5, -66, 53.5],
  kmPerTrain: 205,
  cities: {
    van: ['Vancouver', -123.12, 49.28],
    sea: ['Seattle', -122.33, 47.61],
    por: ['Portland', -122.68, 45.52],
    sfo: ['San Francisco', -122.42, 37.77],
    lax: ['Los Angeles', -118.24, 34.05],
    sdg: ['San Diego', -117.16, 32.72],
    lvg: ['Las Vegas', -115.14, 36.17],
    phx: ['Phoenix', -112.07, 33.45],
    boi: ['Boise', -116.2, 43.62],
    slc: ['Salt Lake City', -111.89, 40.76],
    hel: ['Helena', -112.04, 46.59],
    cal: ['Calgary', -114.07, 51.05],
    win: ['Winnipeg', -97.14, 49.9],
    bil: ['Billings', -108.5, 45.78],
    den: ['Denver', -104.99, 39.74],
    abq: ['Albuquerque', -106.65, 35.08],
    elp: ['El Paso', -106.49, 31.76],
    sat: ['San Antonio', -98.49, 29.42],
    hou: ['Houston', -95.37, 29.76],
    dal: ['Dallas', -96.8, 32.78],
    okc: ['Oklahoma City', -97.52, 35.47],
    kc: ['Kansas City', -94.58, 39.1],
    oma: ['Omaha', -95.93, 41.26],
    msp: ['Minneapolis', -93.27, 44.98],
    chi: ['Chicago', -87.63, 41.88],
    stl: ['Saint Louis', -90.2, 38.63],
    mem: ['Memphis', -90.05, 35.15],
    nor: ['New Orleans', -90.07, 29.95],
    nas: ['Nashville', -86.78, 36.16],
    atl: ['Atlanta', -84.39, 33.75],
    jax: ['Jacksonville', -81.66, 30.33],
    mia: ['Miami', -80.19, 25.76],
    cha: ['Charleston', -79.93, 32.78],
    ral: ['Raleigh', -78.64, 35.78],
    was: ['Washington', -77.04, 38.91],
    pit: ['Pittsburgh', -79.99, 40.44],
    det: ['Detroit', -83.05, 42.33],
    tor: ['Toronto', -79.38, 43.65],
    mtl: ['Montréal', -73.57, 45.5],
    bos: ['Boston', -71.06, 42.36],
    nyc: ['New York', -74.01, 40.71],
  },
  routes: `
    van sea 1 g x2
    van cal 3
    sea cal 4
    sea hel 6
    sea por 1 g x2
    por boi 4
    por sfo 5 x2
    sfo lax 3 x2
    sfo slc 5 x2
    lax sdg 1 g
    lax lvg 2
    lax phx 3
    sdg phx 3
    lvg slc 3
    lvg phx 2
    phx abq 3
    phx elp 3
    abq den 3
    abq elp 2
    abq okc 4
    elp sat 4
    elp dal 4
    sat hou 2
    sat dal 2
    hou dal 1 g x2
    hou nor 2
    dal okc 2 x2
    dal mem 4
    okc kc 2 x2
    okc den 4
    den kc 4 x2
    den oma 4
    den slc 3 x2
    den bil 4
    slc boi 2
    boi hel 3
    hel bil 2
    hel cal 3
    cal win 6
    bil win 5
    bil msp 5
    win msp 3
    oma msp 2 x2
    msp chi 3
    msp tor 6
    oma chi 3
    oma kc 1 g x2
    kc stl 2 x2
    stl chi 2 x2
    stl mem 2
    stl nas 2
    mem nas 1
    mem nor 3
    nor atl 4 x2
    nor jax 4
    jax mia 3
    jax atl 2
    jax cha 2
    cha atl 2
    cha ral 2
    atl ral 2 x2
    atl nas 1
    nas pit 4
    nas ral 3
    pit was 2
    was ral 2 x2
    was nyc 2 x2
    nyc pit 2 x2
    nyc bos 2 x2
    bos mtl 2 x2
    mtl nyc 3
    mtl tor 3
    tor det 2
    det chi 2
    det pit 2
    tor pit 2
    chi pit 3
    mia nor 6 b-55
  `,
  tickets: { bands: [[12, 5, 9], [10, 9, 14], [8, 14, 22]] },
};
