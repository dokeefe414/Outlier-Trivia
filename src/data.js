// OUTLIER prototype question bank.
// Stand Out points are editorial prototype tiers, not measured live rarity.
// Fit In shares are fictional calibrated examples, not real player survey results.
// Every Stand Out prompt deliberately asks for a finite, enumerated answer set.
export const rareQuestions = [
  {
    id: "countries-m", category: "GEOGRAPHY",
    prompt: "Name a sovereign country whose common English name starts with M.",
    detail: "18 accepted countries. Think beyond the obvious.",
    answers: [
      ["Mexico",120],["Morocco",180],["Malaysia",260],["Mongolia",340],
      ["Madagascar",450],["Myanmar",510,["Burma"]],["Maldives",590],
      ["Mali",610],["Malta",630],["Mozambique",650],["Monaco",690],
      ["Moldova",720],["Malawi",770],["Mauritius",820],
      ["Mauritania",850],["Montenegro",870],["Micronesia",930,["Federated States of Micronesia"]],
      ["Marshall Islands",970,["Republic of the Marshall Islands"]]
    ]
  },
  {
    id:"planets",category:"SPACE",prompt:"Name one of the eight planets in our solar system.",
    detail:"Only the eight officially recognized planets count.",
    answers:[["Earth",100],["Mars",180],["Jupiter",260],["Saturn",310],["Venus",410],["Mercury",570],["Neptune",770],["Uranus",900]]
  },
  {
    id:"g7",category:"WORLD",prompt:"Name one of the seven G7 member countries.",
    detail:"Answer with a country, not the European Union.",
    answers:[["United States",120,["USA","US","United States of America","America"]],["United Kingdom",230,["UK","Britain","Great Britain"]],["Canada",350],["France",430],["Germany",520],["Japan",640],["Italy",850]]
  },
  {
    id:"states-n",category:"USA",prompt:"Name a U.S. state that begins with the letter N.",
    detail:"There are eight possibilities.",
    answers:[["New York",130],["New Jersey",210],["North Carolina",310],["Nevada",400],["New Mexico",530],["New Hampshire",650],["Nebraska",800],["North Dakota",950]]
  },
  {
    id:"noble-gases",category:"SCIENCE",prompt:"Name a noble gas from group 18 of the periodic table.",
    detail:"Use the English element name.",
    answers:[["Helium",130],["Neon",240],["Argon",400],["Xenon",570],["Krypton",660],["Radon",810],["Oganesson",1000]]
  },
  {
    id:"continents",category:"GEOGRAPHY",prompt:"Name a continent in the seven-continent model.",
    detail:"Seven accepted answers; Australia is the continent label used here.",
    answers:[["Asia",160],["Europe",230],["Africa",310],["North America",400],["South America",500],["Australia",720,["Oceania"]],["Antarctica",940]]
  },
  {
    id:"great-lakes",category:"GEOGRAPHY",prompt:"Name one of North America's five Great Lakes.",
    detail:"A lake's name is enough.",
    answers:[["Lake Michigan",220,["Michigan"]],["Lake Superior",340,["Superior"]],["Lake Erie",500,["Erie"]],["Lake Ontario",640,["Ontario"]],["Lake Huron",900,["Huron"]]]
  },
  {
    id:"world-cup",category:"SPORTS",prompt:"Name a nation that has won the men's FIFA World Cup through 2022.",
    detail:"Eight national teams have won it.",
    answers:[["Brazil",110],["Argentina",180],["Germany",220],["France",300],["Italy",450],["Spain",580],["England",710],["Uruguay",950]]
  },
  {
    id:"dwarf-planets",category:"SPACE",prompt:"Name an IAU-recognized dwarf planet in our solar system.",
    detail:"There are five officially recognized dwarf planets.",
    answers:[["Pluto",100],["Ceres",510],["Eris",690],["Haumea",850],["Makemake",980]]
  },
  {
    id:"chess-pieces",category:"GAMES",prompt:"Name one of the six different kinds of chess piece.",
    detail:"The basic six piece types in standard chess.",
    answers:[["King",100],["Queen",180],["Pawn",350],["Rook",650,["Castle"]],["Knight",740,["Horse"]],["Bishop",900]]
  },
  {
    id:"grand-slams",category:"SPORTS",prompt:"Name one of tennis's four Grand Slam tournaments.",
    detail:"The four annual major tournaments count.",
    answers:[["Wimbledon",130,["The Championships Wimbledon"]],["US Open",320,["United States Open"]],["French Open",550,["Roland Garros"]],["Australian Open",900]]
  },
  {
    id:"elements-one-letter",category:"SCIENCE",prompt:"Name a chemical element whose symbol is exactly one letter.",
    detail:"Use the element name, not its one-letter symbol.",
    answers:[
      ["Hydrogen",110],["Oxygen",150],["Carbon",200],["Nitrogen",260],
      ["Sulfur",370,["Sulphur"]],["Fluorine",450],["Potassium",480],["Iodine",530],
      ["Phosphorus",570],["Boron",640],["Vanadium",760],["Uranium",800],
      ["Yttrium",900],["Tungsten",980]
    ]
  },
  {
    id:"un-security",category:"WORLD",prompt:"Name a permanent member of the UN Security Council.",
    detail:"There are five permanent members.",
    answers:[["United States",150,["USA","US","America","United States of America"]],["China",240,["People's Republic of China","PRC"]],["Russia",390,["Russian Federation"]],["United Kingdom",560,["UK","Britain","Great Britain"]],["France",820]]
  },
  {
    id:"rushmore",category:"HISTORY",prompt:"Name one of the four U.S. presidents on Mount Rushmore.",
    detail:"First and last name or last name both work.",
    answers:[["George Washington",160,["Washington"]],["Abraham Lincoln",280,["Lincoln"]],["Thomas Jefferson",630,["Jefferson"]],["Theodore Roosevelt",940,["Roosevelt","Teddy Roosevelt"]]]
  },
  {
    id:"greek-letters",category:"LANGUAGE",prompt:"Name a letter of the Greek alphabet.",
    detail:"All 24 Greek letter names are accepted.",
    answers:[
      ["Alpha",100],["Beta",150],["Gamma",210],["Delta",270],["Omega",310],["Pi",340],
      ["Sigma",380],["Theta",420],["Lambda",460],["Epsilon",500],["Phi",540],
      ["Mu",580],["Nu",610],["Kappa",650],["Rho",690],["Tau",730],
      ["Zeta",770],["Eta",800],["Iota",820],["Xi",850],["Omicron",880],
      ["Upsilon",900],["Chi",940],["Psi",980]
    ]
  },
  {
    id:"months-31",category:"EVERYDAY",prompt:"Name a month that has 31 days.",
    detail:"Seven months have 31 days.",
    answers:[["January",140],["December",210],["July",320],["August",430],["March",590],["October",730],["May",900]]
  }
];

export const fitQuestions = [
  {id:"lose",category:"EVERYDAY",prompt:"Name something people are always losing.",
   choices:[["Keys",38],["Phone",24],["Wallet",16],["Remote",10],["Glasses",7],["Charger",5]]},
  {id:"breakfast",category:"FOOD",prompt:"Name a classic breakfast food.",
   choices:[["Eggs",30],["Cereal",24],["Pancakes",18],["Toast",13],["Oatmeal",9],["Yogurt",6]]},
  {id:"zoo",category:"ANIMALS",prompt:"Name an animal people hope to see at the zoo.",
   choices:[["Lion",35],["Elephant",25],["Giraffe",16],["Monkey",12],["Tiger",8],["Zebra",4]]},
  {id:"vacation",category:"TRAVEL",prompt:"Name a place people go on vacation.",
   choices:[["Beach",35],["Mountains",20],["City",18],["Theme park",12],["Cruise",9],["Cabin",6]]},
  {id:"late",category:"EVERYDAY",prompt:"Name a reason someone arrives late.",
   choices:[["Traffic",34],["Overslept",27],["Missed bus",15],["Car trouble",11],["Bad weather",8],["Lost keys",5]]},
  {id:"beach",category:"TRAVEL",prompt:"Name something you'd pack for the beach.",
   choices:[["Towel",32],["Sunscreen",27],["Swimsuit",16],["Sunglasses",12],["Umbrella",8],["Cooler",5]]},
  {id:"bedtime",category:"EVERYDAY",prompt:"Name something people do right before bed.",
   choices:[["Brush teeth",37],["Check phone",25],["Read",14],["Shower",10],["Set alarm",9],["Drink water",5]]},
  {id:"forgot",category:"TRAVEL",prompt:"Name something people forget to pack.",
   choices:[["Phone charger",34],["Toothbrush",23],["Passport",15],["Socks",11],["Headphones",10],["Sunscreen",7]]},
  {id:"pizza",category:"FOOD",prompt:"Name a popular pizza topping.",
   choices:[["Pepperoni",36],["Extra cheese",27],["Mushrooms",14],["Sausage",11],["Olives",7],["Pineapple",5]]},
  {id:"subjects",category:"SCHOOL",prompt:"Name a common subject taught in school.",
   choices:[["Math",33],["English",25],["Science",18],["History",13],["Art",7],["PE",4]]},
  {id:"movies",category:"ENTERTAINMENT",prompt:"Name something you find at a movie theater.",
   choices:[["Popcorn",40],["Screen",22],["Seats",18],["Candy",10],["Tickets",6],["Soda",4]]},
  {id:"active",category:"FITNESS",prompt:"Name a way people like to stay active.",
   choices:[["Walking",34],["Running",20],["Gym",18],["Cycling",12],["Swimming",10],["Yoga",6]]},
  {id:"birthday",category:"PARTIES",prompt:"Name something you'd find at a birthday party.",
   choices:[["Cake",36],["Balloons",23],["Presents",19],["Candles",12],["Music",7],["Party hats",3]]},
  {id:"phone",category:"TECH",prompt:"Name an app category people use on their phones.",
   choices:[["Social media",39],["Messaging",26],["Games",14],["Music",10],["Maps",7],["Weather",4]]}
];

export const DAILY_PATTERN = ["rare","fit","rare","fit","rare","fit","rare"];
