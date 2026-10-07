// India: Himalayan and Ghat tunnels, river ferries, and the Mandala bonus for joining a ticket's cities two separate ways.
export default {
  id: 'india',
  name: 'India',
  blurb: 'Mandala bonus: link a ticket’s cities by two separate paths.',
  rules: { trains: 45, players: [2, 4], doubleMin: 4, deal: { short: 4, keep: 2 }, bonus: ['mandala', 'globetrotter'] },
  bbox: [67.5, 7.2, 96.5, 35.4],
  kmPerTrain: 195,
  cities: {
    srn: ['Srinagar', 74.8, 34.08],
    ama: ['Amritsar', 74.87, 31.63],
    chd: ['Chandigarh', 76.78, 30.73],
    deh: ['Dehradun', 78.03, 30.32],
    del: ['Delhi', 77.21, 28.61],
    bik: ['Bikaner', 73.31, 28.02],
    jai: ['Jaipur', 75.79, 26.91],
    jod: ['Jodhpur', 73.02, 26.24],
    udp: ['Udaipur', 73.71, 24.58],
    bhu: ['Bhuj', 69.67, 23.24],
    ahm: ['Ahmedabad', 72.57, 23.02],
    sur: ['Surat', 72.83, 21.17],
    mum: ['Mumbai', 72.88, 19.08],
    pun: ['Pune', 73.86, 18.52],
    aur: ['Aurangabad', 75.34, 19.88],
    goa: ['Goa', 73.83, 15.49],
    man: ['Mangaluru', 74.86, 12.91],
    koc: ['Kochi', 76.27, 9.93],
    tvm: ['Thiruvananthapuram', 76.94, 8.52],
    mad: ['Madurai', 78.12, 9.93],
    che: ['Chennai', 80.27, 13.08],
    ben: ['Bengaluru', 77.59, 12.97],
    hyd: ['Hyderabad', 78.49, 17.39],
    vij: ['Vijayawada', 80.65, 16.51],
    viz: ['Visakhapatnam', 83.22, 17.69],
    nag: ['Nagpur', 79.09, 21.15],
    ind: ['Indore', 75.86, 22.72],
    bho: ['Bhopal', 77.41, 23.26],
    jab: ['Jabalpur', 79.93, 23.18],
    agr: ['Agra', 78.01, 27.18],
    luc: ['Lucknow', 80.95, 26.85],
    var: ['Varanasi', 82.97, 25.32],
    pat: ['Patna', 85.14, 25.59],
    ktm: ['Kathmandu', 85.32, 27.72],
    ran: ['Ranchi', 85.31, 23.34],
    rai: ['Raipur', 81.63, 21.25],
    bbs: ['Bhubaneswar', 85.82, 20.3],
    kol: ['Kolkata', 88.36, 22.57],
    sil: ['Siliguri', 88.4, 26.73],
    guw: ['Guwahati', 91.74, 26.14],
    dha: ['Dhaka', 90.41, 23.81],
    imp: ['Imphal', 93.94, 24.82],
  },
  routes: `
    srn ama 3 t
    srn chd 4 t
    ama chd 1
    ama bik 3
    chd del 2
    chd deh 1 t
    deh del 1
    deh luc 4
    del agr 1 x2
    del jai 2 x2
    del bik 3
    bik jod 2
    jod jai 2
    jod udp 1
    bhu jod 3
    bhu ahm 2
    jai udp 3
    jai agr 2
    udp ind 2
    udp ahm 1
    ahm sur 1 x2
    ahm ind 2
    sur mum 1 x2
    ind bho 1
    ind aur 2
    bho agr 3
    bho jab 2
    bho nag 2
    agr luc 2
    luc ktm 3 t
    luc var 2
    var pat 1
    var jab 3
    pat ktm 2 t
    pat ran 2
    pat sil 3
    ran kol 2
    ran rai 3
    jab nag 1
    nag rai 1
    rai bbs 3
    rai viz 3 t
    nag hyd 3
    nag aur 3
    aur mum 2
    aur pun 1
    aur hyd 3
    mum pun 1 x2
    pun hyd 3
    pun goa 2 t
    mum goa 3
    goa man 2
    goa ben 3 t
    hyd ben 3
    hyd vij 2
    vij viz 2
    vij che 2
    viz bbs 2
    bbs kol 2 x2
    kol dha 2 f1
    kol sil 3
    sil guw 2
    sil ktm 2 t
    guw dha 2 t
    guw imp 3 t
    dha imp 3
    man ben 2 t
    man koc 2
    ben che 2 x2
    ben mad 2
    koc mad 2 t
    koc tvm 1
    tvm mad 1
    mad che 3
    bhu mum 4 f2
  `,
  tickets: { bands: [[14, 4, 8], [18, 8, 13], [12, 13, 20]] },
};
