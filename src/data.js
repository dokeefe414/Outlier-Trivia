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


// Extra curated prompts for a full no-repeat 7-day rotation (28 rare + 21 fit).
// Treat rarity scores as illustrative, editorial tiers until tested with players.
rareQuestions.push(
  {id:"states-a",category:"USA",prompt:"Name a U.S. state that begins with A.",
   detail:"There are four.",answers:[["Alabama",170],["Alaska",400],["Arizona",630],["Arkansas",950]]},
  {id:"states-i",category:"USA",prompt:"Name a U.S. state that begins with I.",
   detail:"There are four.",answers:[["Illinois",180],["Indiana",410],["Iowa",660],["Idaho",930]]},
  {id:"states-w",category:"USA",prompt:"Name a U.S. state that begins with W.",
   detail:"There are four.",answers:[["Washington",180],["Wisconsin",460],["West Virginia",720],["Wyoming",940]]},
  {id:"oceans",category:"GEOGRAPHY",prompt:"Name one of Earth's five oceans.",
   detail:"Use the five-ocean convention.",answers:[["Pacific Ocean",140,["Pacific"]],["Atlantic Ocean",260,["Atlantic"]],["Indian Ocean",480,["Indian"]],["Arctic Ocean",740,["Arctic"]],["Southern Ocean",970,["Southern","Antarctic Ocean"]]]},
  {id:"nordic",category:"GEOGRAPHY",prompt:"Name one of the five Nordic countries.",
   detail:"Only the five sovereign Nordic countries count.",answers:[["Sweden",180],["Norway",300],["Denmark",440],["Finland",680],["Iceland",920]]},
  {id:"un-languages",category:"LANGUAGE",prompt:"Name an official language of the United Nations.",
   detail:"There are six official UN languages.",answers:[["English",100],["Spanish",250],["French",370],["Chinese",520,["Mandarin","Mandarin Chinese"]],["Arabic",740],["Russian",930]]},
  {id:"apollo-landings",category:"HISTORY",prompt:"Name a NASA Apollo mission that landed humans on the Moon.",
   detail:"Write the Apollo mission number. Six landed crews.",answers:[["Apollo 11",110,["11"]],["Apollo 12",340,["12"]],["Apollo 13",0,[]],["Apollo 14",580,["14"]],["Apollo 15",710,["15"]],["Apollo 16",850,["16"]],["Apollo 17",970,["17"]]].filter(([,points])=>points>0)},
  {id:"roman-numerals",category:"HISTORY",prompt:"Name a symbol used as a Roman numeral.",
   detail:"There are seven basic symbols; type the letter.",answers:[["I",130],["V",230],["X",340],["L",550],["C",650],["D",820],["M",940]]},
  {id:"hogwarts-houses",category:"ENTERTAINMENT",prompt:"Name a Hogwarts house from the Harry Potter stories.",
   detail:"There are four houses.",answers:[["Gryffindor",130],["Slytherin",310],["Ravenclaw",650],["Hufflepuff",950]]},
  {id:"beatles",category:"MUSIC",prompt:"Name one of the four members of The Beatles.",
   detail:"Use a first or last name, or a full name.",answers:[["John Lennon",130,["John","Lennon"]],["Paul McCartney",300,["Paul","McCartney"]],["George Harrison",650,["George","Harrison"]],["Ringo Starr",940,["Ringo","Starr","Richard Starkey"]]]},
  {id:"olympic-rings",category:"SPORTS",prompt:"Name a color of one of the five Olympic rings.",
   detail:"The colored rings themselves, not the flag background.",answers:[["Blue",160],["Red",300],["Yellow",500],["Green",720],["Black",950]]},
  {id:"zodiac-signs",category:"CULTURE",prompt:"Name a sign of the Western zodiac.",
   detail:"There are twelve traditional signs.",answers:[["Leo",120],["Scorpio",190],["Aries",230],["Gemini",280],["Cancer",360],["Taurus",430],["Virgo",510],["Libra",580],["Sagittarius",690],["Aquarius",770],["Pisces",880],["Capricorn",960]]},
  {id:"uk-nations",category:"GEOGRAPHY",prompt:"Name a constituent country of the United Kingdom.",
   detail:"There are four constituent countries.",answers:[["England",130],["Scotland",400],["Wales",690],["Northern Ireland",950]]},
  {id:"caspian",category:"GEOGRAPHY",prompt:"Name a country whose territory borders the Caspian Sea.",
   detail:"Five countries share a Caspian Sea coast.",answers:[["Russia",190,["Russian Federation"]],["Iran",400],["Kazakhstan",560],["Azerbaijan",760],["Turkmenistan",950]]},
  {id:"ninja-turtles",category:"ENTERTAINMENT",prompt:"Name one of the four Teenage Mutant Ninja Turtles.",
   detail:"Just the turtle's first name is enough.",answers:[["Leonardo",170,["Leo"]],["Raphael",400,["Raph"]],["Michelangelo",690,["Mikey"]],["Donatello",940,["Donnie"]]]},
  {id:"pacman-ghosts",category:"GAMING",prompt:"Name one of the four classic Pac-Man ghosts.",
   detail:"Use their English character names.",answers:[["Blinky",220],["Pinky",410],["Inky",700],["Clyde",940]]}
);

fitQuestions.push(
  {id:"car-color",category:"EVERYDAY",prompt:"Name a color you see on cars all the time.",
   choices:[["Black",30],["White",28],["Silver",16],["Red",12],["Blue",9],["Green",5]]},
  {id:"superpowers",category:"IMAGINATION",prompt:"Pick the superpower people would most want.",
   choices:[["Flying",31],["Invisibility",26],["Teleportation",22],["Mind reading",10],["Super strength",7],["Time travel",4]]},
  {id:"restaurants",category:"FOOD",prompt:"Name something people order at a diner.",
   choices:[["Burger",32],["Pancakes",24],["Fries",18],["Eggs",12],["Milkshake",9],["Salad",5]]},
  {id:"transportation",category:"TRAVEL",prompt:"Pick a common way people get to work.",
   choices:[["Car",45],["Bus",20],["Train",14],["Walking",11],["Bicycle",7],["Carpool",3]]},
  {id:"free-hour",category:"EVERYDAY",prompt:"What would people most likely do with one free hour?",
   choices:[["Watch TV",30],["Scroll phone",28],["Take a nap",15],["Play a game",12],["Exercise",9],["Read",6]]},
  {id:"first-date",category:"LIFESTYLE",prompt:"Pick a popular first-date activity.",
   choices:[["Dinner",38],["Coffee",23],["Movies",18],["Walk",11],["Bowling",6],["Museum",4]]},
  {id:"pets",category:"ANIMALS",prompt:"Name a pet people would most like to have.",
   choices:[["Dog",41],["Cat",32],["Fish",10],["Bird",8],["Rabbit",6],["Hamster",3]]},
  {id:"sky",category:"NATURE",prompt:"Name something people notice when they look at the sky.",
   choices:[["Clouds",35],["Sun",26],["Moon",17],["Stars",12],["Airplane",7],["Rainbow",3]]},
  {id:"rainy",category:"EVERYDAY",prompt:"Name something people do when it rains all day.",
   choices:[["Watch a movie",30],["Sleep",25],["Read a book",17],["Play games",13],["Cook",9],["Clean",6]]}
);
