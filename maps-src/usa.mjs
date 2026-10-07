// USA: the original board's 36 cities, 100 routes (78 connections) and 30 destination tickets, with the base rules:
// 2-5 players, 45 trains, double routes open with 4-5 players, 3 tickets dealt (keep 2), longest path +10.
// Sources: route data from github.com/Rob217/TicketToRideAnalysis and the ticket list from the Ticket to Ride wiki,
// each route colour checked against a photo of the board. Cities sit at their real positions.
export default {
  id: 'usa',
  name: 'USA',
  blurb: 'The original board: coast to coast for 2–5 players, long routes score big.',
  rules: { trains: 45, players: [2, 5], doubleMin: 4, deal: { short: 3, keep: 2 }, bonus: ['longest'], tie: ['tickets', 'longest'] },
  bbox: [-127, 23.5, -66, 53.5],
  kmPerTrain: 205,
  cities: {
    vancouver: ["Vancouver", -123.12, 49.28],
    seattle: ["Seattle", -122.33, 47.61],
    portland: ["Portland", -122.68, 45.52],
    sanfrancisco: ["San Francisco", -122.42, 37.77],
    losangeles: ["Los Angeles", -118.24, 34.05],
    lasvegas: ["Las Vegas", -115.14, 36.17],
    phoenix: ["Phoenix", -112.07, 33.45],
    saltlakecity: ["Salt Lake City", -111.89, 40.76],
    helena: ["Helena", -112.04, 46.59],
    calgary: ["Calgary", -114.07, 51.05],
    winnipeg: ["Winnipeg", -97.14, 49.9],
    denver: ["Denver", -104.99, 39.74],
    santafe: ["Santa Fe", -105.94, 35.69],
    elpaso: ["El Paso", -106.49, 31.76],
    oklahomacity: ["Oklahoma City", -97.52, 35.47],
    kansascity: ["Kansas City", -94.58, 39.1],
    omaha: ["Omaha", -95.93, 41.26],
    duluth: ["Duluth", -92.1, 46.79],
    saultstmarie: ["Sault St. Marie", -84.35, 46.5],
    chicago: ["Chicago", -87.63, 41.88],
    saintlouis: ["Saint Louis", -90.2, 38.63],
    littlerock: ["Little Rock", -92.29, 34.75],
    dallas: ["Dallas", -96.8, 32.78],
    houston: ["Houston", -95.37, 29.76],
    neworleans: ["New Orleans", -90.07, 29.95],
    nashville: ["Nashville", -86.78, 36.16],
    atlanta: ["Atlanta", -84.39, 33.75],
    charleston: ["Charleston", -79.93, 32.78],
    miami: ["Miami", -80.19, 25.76],
    raleigh: ["Raleigh", -78.64, 35.78],
    washington: ["Washington", -77.04, 38.91],
    pittsburgh: ["Pittsburgh", -79.99, 40.44],
    newyork: ["New York", -74.01, 40.71],
    boston: ["Boston", -71.06, 42.36],
    montreal: ["Montréal", -73.57, 45.5],
    toronto: ["Toronto", -79.38, 43.65],
  },
  routes: `
    vancouver calgary 3 gray
    vancouver seattle 1 gray/gray x2
    seattle calgary 4 gray
    seattle helena 6 yellow
    seattle portland 1 gray/gray x2
    portland saltlakecity 6 blue
    portland sanfrancisco 5 green/purple x2
    sanfrancisco saltlakecity 5 orange/white x2
    sanfrancisco losangeles 3 yellow/purple x2
    losangeles lasvegas 2 gray
    losangeles phoenix 3 gray
    losangeles elpaso 6 black
    calgary winnipeg 6 white
    calgary helena 4 gray
    helena winnipeg 4 blue
    helena saltlakecity 3 purple
    helena denver 4 green
    helena duluth 6 orange
    helena omaha 5 red
    saltlakecity denver 3 red/yellow x2
    lasvegas saltlakecity 3 orange
    phoenix denver 5 white
    phoenix santafe 3 gray
    phoenix elpaso 3 gray
    winnipeg saultstmarie 6 gray
    winnipeg duluth 4 black
    duluth saultstmarie 3 gray
    duluth toronto 6 purple
    duluth chicago 3 red
    duluth omaha 2 gray/gray x2
    omaha chicago 4 blue
    omaha kansascity 1 gray/gray x2
    kansascity saintlouis 2 blue/purple x2
    kansascity oklahomacity 2 gray/gray x2
    oklahomacity littlerock 2 gray
    oklahomacity dallas 2 gray/gray x2
    dallas littlerock 2 gray
    dallas houston 1 gray/gray x2
    houston neworleans 2 gray
    elpaso houston 6 green
    elpaso dallas 4 red
    elpaso oklahomacity 5 yellow
    elpaso santafe 2 gray
    santafe oklahomacity 3 blue
    oklahomacity denver 4 red
    santafe denver 2 gray
    denver kansascity 4 black/orange x2
    denver omaha 4 purple
    neworleans miami 6 red
    neworleans atlanta 4 orange/yellow x2
    neworleans littlerock 3 green
    littlerock nashville 3 white
    littlerock saintlouis 2 gray
    saintlouis nashville 2 gray
    saintlouis pittsburgh 5 green
    saintlouis chicago 2 green/white x2
    chicago pittsburgh 3 black/orange x2
    chicago toronto 4 white
    saultstmarie montreal 5 black
    toronto montreal 3 gray
    saultstmarie toronto 2 gray
    toronto pittsburgh 2 gray
    pittsburgh newyork 2 white/green x2
    pittsburgh washington 2 gray
    pittsburgh raleigh 2 gray
    nashville raleigh 3 black
    nashville atlanta 1 gray
    nashville pittsburgh 4 yellow
    atlanta miami 5 blue
    atlanta charleston 2 gray
    atlanta raleigh 2 gray/gray x2
    charleston miami 4 purple
    raleigh charleston 2 gray
    raleigh washington 2 gray/gray x2
    washington newyork 2 orange/black x2
    newyork boston 2 yellow/red x2
    newyork montreal 3 blue
    boston montreal 2 gray/gray x2
  `,
  tickets: {
    list: [
      ["boston", "miami", 12],
      ["calgary", "phoenix", 13],
      ["calgary", "saltlakecity", 7],
      ["chicago", "neworleans", 7],
      ["chicago", "santafe", 9],
      ["dallas", "newyork", 11],
      ["denver", "elpaso", 4],
      ["denver", "pittsburgh", 11],
      ["duluth", "elpaso", 10],
      ["duluth", "houston", 8],
      ["helena", "losangeles", 8],
      ["kansascity", "houston", 5],
      ["losangeles", "chicago", 16],
      ["losangeles", "miami", 20],
      ["losangeles", "newyork", 21],
      ["montreal", "atlanta", 9],
      ["montreal", "neworleans", 13],
      ["newyork", "atlanta", 6],
      ["portland", "nashville", 17],
      ["portland", "phoenix", 11],
      ["sanfrancisco", "atlanta", 17],
      ["saultstmarie", "nashville", 8],
      ["saultstmarie", "oklahomacity", 9],
      ["seattle", "losangeles", 9],
      ["seattle", "newyork", 22],
      ["toronto", "miami", 10],
      ["vancouver", "montreal", 20],
      ["vancouver", "santafe", 13],
      ["winnipeg", "houston", 12],
      ["winnipeg", "littlerock", 11],
    ],
  },
};
