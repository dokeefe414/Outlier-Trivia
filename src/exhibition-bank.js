// OUTLIER exhibition-only library builder. Uses historically archived,
 // explicitly source-bounded CC0 lists already shipped in the guest game.
 // DO NOT mix these public identities with the *future ranked* private daily
 // question bank. Scores are editorial, never measured crowd frequencies.
import {rareQuestions} from "./data.js";
import {normalizeAnswer,auditQuestionAliases} from "./answer-intelligence.js";
// Prefer a broad, bounded library of independently sourced, unranked prompts.
// A prompt retains its FULL original answer set; we never silently truncate
// a historical reference list just to make imports faster. Very large archived
// inventories remain available in guest Big List but are intentionally excluded
// from synchronous multiplayer answer adjudication for predictable latency.
export const EXHIBITION_RARE_IDS=Object.freeze(rareQuestions
  .filter(q=>q.arcadeOnly===true && q.bigPool===true &&
    q.id.startsWith("open-") && q.answers?.length>=28 && q.answers.length<=2500)
  .map(q=>q.id));

// Weighted editorial preference mini-games; NOT observed popularity. Deliberate
// distinct identities/wording from the ranked daily Fit In library.
const fitSamples=[
  ["sky","SKY","Which skywatching scene is weighted highest in OUTLIER's editorial game-night list?",
    ["Sunset","Stargazing","Rainbow","Lightning","Meteor shower","Moonrise"]],
  ["trail","OUTDOORS","Which trail outing would the OUTLIER editors pick first?",
    ["Waterfall hike","Lake loop","Forest boardwalk","Mountain overlook","Canyon walk","Wildflower trail"]],
  ["museum","CULTURE","Which unusual museum theme is most favored in our editorial game-night list?",
    ["Dinosaurs","Space exploration","Vintage arcade","Railroads","Natural history","Movie props"]],
  ["retro","GAMING","What retro-game setting leads our fictional game-night preference board?",
    ["Space station","Haunted mansion","Underwater city","Robot factory","Desert planet","Ancient temple"]],
  ["snacks","FOOD","Which snack table centerpiece tops OUTLIER's editorial game-night picks?",
    ["Popcorn bowls","Pretzel twists","Fruit skewers","Mini tacos","Cheese crackers","Granola bites"]],
  ["camp","OUTDOORS","Which camp-night activity leads our editorial preference weights?",
    ["Campfire stories","Stargazing","Board games","Night hike","Marshmallow roasting","Ghost tales"]],
  ["transport","CITY","Which imaginary city transport ride would the editors choose first?",
    ["Cable car","Ferry","Streetcar","Monorail","Funicular","Water taxi"]],
  ["fossils","SCIENCE","Which exhibit would an OUTLIER editor visit first in a fossil hall?",
    ["Tyrannosaurus skull","Trilobites","Amber insects","Mammoth tusk","Giant ammonite","Ancient footprints"]],
  ["studio","CREATIVE","Which creative studio activity wins our editorial game-night ranking?",
    ["Stop-motion film","Clay modeling","Pixel-art game","Screen printing","Collage wall","Music remix"]],
  ["boardwalk","TRAVEL","Which imaginary boardwalk booth is the editorial top pick?",
    ["Ring toss","Photo booth","Mini golf","Arcade cabinet","Kite stall","Puzzle booth"]]
];
// Original, deliberately fictional editorial prompts: never present their
// weights as collected responses or as statistically representative.
fitSamples.push(...[
  [
  "arcade",
  "GAMES",
  "Which arcade attraction takes the editor's first game-night token?",
  [
    "Skee ball",
    "Pinball",
    "Dance battle",
    "Racing simulator",
    "Claw machine",
    "Air hockey"
  ]
  ],
  [
  "planet",
  "SCIENCE",
  "Which cosmic destination would our fictional explorer visit first?",
  [
    "Saturn's rings",
    "Mars canyon",
    "Jupiter's moon",
    "Venus clouds",
    "Neptune storms",
    "Mercury crater"
  ]
  ],
  [
  "garden",
  "NATURE",
  "Which garden feature would OUTLIER put on the cover?",
  [
    "Wildflower field",
    "Koi pond",
    "Herb maze",
    "Stone arch",
    "Butterfly house",
    "Bamboo walk"
  ]
  ],
  [
  "concert",
  "MUSIC",
  "Which concert moment would our editors replay first?",
  [
    "Opening guitar riff",
    "Drum solo",
    "Crowd singalong",
    "Acoustic encore",
    "Bass drop",
    "Final bow"
  ]
  ],
  [
  "library",
  "BOOKS",
  "Which library corner should get OUTLIER's spotlight?",
  [
    "Mystery shelves",
    "Graphic novels",
    "Science essays",
    "Fantasy maps",
    "Poetry nook",
    "Travel guides"
  ]
  ],
  [
  "cinema",
  "MOVIES",
  "What makes our fictional cinema night feel most special?",
  [
    "Outdoor screen",
    "Old projector",
    "Director Q&A",
    "Costume contest",
    "Silent film",
    "Midnight premiere"
  ]
  ],
  [
  "zoo",
  "ANIMALS",
  "Which conservation center tour sounds best to our editors?",
  [
    "Big cats",
    "Nocturnal house",
    "Penguin habitat",
    "Bird aviary",
    "Reptile wing",
    "Insectarium"
  ]
  ],
  [
  "campus",
  "CAMPUS",
  "What would our editorial campus club organize first?",
  [
    "Trivia championship",
    "Film marathon",
    "Food festival",
    "Hackathon",
    "Hiking club",
    "Board games"
  ]
  ],
  [
  "weather",
  "SCIENCE",
  "Which dramatic weather scene gets the most editorial votes?",
  [
    "Northern lights",
    "Snowy sunrise",
    "Lightning storm",
    "Foggy valley",
    "Double rainbow",
    "Meteor shower"
  ]
  ],
  [
  "carnival",
  "TRAVEL",
  "Which fairground memory leads our fictional highlight reel?",
  [
    "Ferris wheel",
    "Carousel",
    "Fireworks",
    "Haunted house",
    "Bumper cars",
    "Photo booth"
  ]
  ],
  [
  "beach",
  "TRAVEL",
  "Which beach-day tradition wins our internal game-night poll?",
  [
    "Sunset picnic",
    "Shell collecting",
    "Sandcastle contest",
    "Beach volleyball",
    "Snorkeling",
    "Paddleboarding"
  ]
  ],
  [
  "pizza",
  "FOOD",
  "What pizza-night addition would our editors order first?",
  [
    "Garlic knots",
    "Extra basil",
    "Spicy honey",
    "Fresh mozzarella",
    "Roasted peppers",
    "Pesto drizzle"
  ]
  ],
  [
  "puzzle",
  "GAMES",
  "Which puzzle challenge is our fictional team favorite?",
  [
    "Escape room",
    "Logic grid",
    "Crossword",
    "Jigsaw puzzle",
    "Riddle hunt",
    "Sudoku"
  ]
  ],
  [
  "robot",
  "SCIENCE",
  "Which robot assistant would our editors build for a party?",
  [
    "Snack server",
    "Trivia host",
    "Dance coach",
    "Photo printer",
    "Music mixer",
    "Scorekeeper"
  ]
  ],
  [
  "sports",
  "SPORTS",
  "Which stadium moment would OUTLIER replay on the big screen?",
  [
    "Overtime winner",
    "Walk-off hit",
    "Last-lap sprint",
    "Penalty save",
    "Game-winning shot",
    "Photo finish"
  ]
  ],
  [
  "hiking",
  "OUTDOORS",
  "Which trail landmark tops our fictional adventure board?",
  [
    "Waterfall",
    "Summit overlook",
    "Suspension bridge",
    "Hidden cave",
    "Wildflower meadow",
    "Lakeside dock"
  ]
  ],
  [
  "coffee",
  "FOOD",
  "Which cafe detail would our editors remember most?",
  [
    "Latte art",
    "Fresh croissants",
    "Book exchange",
    "Live music",
    "Garden patio",
    "Board-game shelf"
  ]
  ],
  [
  "museum-night",
  "CULTURE",
  "Which museum-after-dark event would OUTLIER attend first?",
  [
    "Planetarium show",
    "Dinosaur tour",
    "Art restoration",
    "Science demo",
    "Historical mystery",
    "Interactive games"
  ]
  ],
  [
  "winter",
  "SEASONS",
  "Which winter weekend plan feels most OUTLIER?",
  [
    "Snowy cabin",
    "Ice skating",
    "Hot chocolate crawl",
    "Snow tubing",
    "Board-game night",
    "Winter hike"
  ]
  ],
  [
  "summer",
  "SEASONS",
  "Which summer-night event tops our editorial board?",
  [
    "Outdoor movie",
    "Meteor watch",
    "Firefly walk",
    "Street festival",
    "Rooftop dinner",
    "Campfire songs"
  ]
  ],
  [
  "language",
  "CULTURE",
  "Which language-learning activity would our editors choose?",
  [
    "Conversation cafe",
    "Film subtitles",
    "Recipe exchange",
    "Song translations",
    "Language games",
    "Travel diary"
  ]
  ],
  [
  "history",
  "HISTORY",
  "Which historical exhibit would our fictional team visit first?",
  [
    "Ancient maps",
    "Medieval armor",
    "Early computers",
    "Space race",
    "Maritime artifacts",
    "Vintage radios"
  ]
  ],
  [
  "game-dev",
  "GAMING",
  "Which indie-game mechanic gets our editors most excited?",
  [
    "Time loop",
    "Base building",
    "Co-op puzzles",
    "Dialogue branches",
    "Physics sandbox",
    "Rhythm action"
  ]
  ],
  [
  "dessert",
  "FOOD",
  "Which dessert-table centerpiece wins our editorial vote?",
  [
    "Ice cream sundae",
    "Mini cheesecakes",
    "Brownie tower",
    "Fruit tart",
    "Churros",
    "Macarons"
  ]
  ],
  [
  "night-sky",
  "SCIENCE",
  "Which stargazing gadget would OUTLIER pack first?",
  [
    "Telescope",
    "Star chart",
    "Binoculars",
    "Red flashlight",
    "Meteor camera",
    "Moon filter"
  ]
  ],
  [
  "roadtrip",
  "TRAVEL",
  "Which road-trip stop gets first pick on our fictional route?",
  [
    "National park",
    "Retro diner",
    "Coastal overlook",
    "Odd museum",
    "Historic lighthouse",
    "Mountain town"
  ]
  ],
  [
  "art",
  "CREATIVE",
  "Which hands-on art workshop would our editors try first?",
  [
    "Pottery wheel",
    "Watercolor",
    "Printmaking",
    "Glass painting",
    "Mural making",
    "Digital collage"
  ]
  ],
  [
  "tech",
  "TECH",
  "Which futuristic invention should headline our editorial expo?",
  [
    "Personal drone",
    "Solar house",
    "Ocean robot",
    "Smart garden",
    "Wearable translator",
    "3D food printer"
  ]
  ],
  [
  "team",
  "SPORTS",
  "Which team celebration would our editors choose?",
  [
    "Victory lap",
    "Confetti shower",
    "Team photo",
    "Locker-room chant",
    "Trophy lift",
    "High-five tunnel"
  ]
  ],
  [
  "retro-movie",
  "MOVIES",
  "Which retro theater feature gets our game-night vote?",
  [
    "Double feature",
    "Classic posters",
    "Balcony seats",
    "Live organ",
    "Film trivia",
    "Vintage tickets"
  ]
  ],
  [
  "music-studio",
  "MUSIC",
  "Which music-studio room sounds best for an editorial tour?",
  [
    "Analog synths",
    "Recording booth",
    "Drum room",
    "Mixing desk",
    "Vinyl library",
    "Live stage"
  ]
  ],
  [
  "wildlife",
  "ANIMALS",
  "Which wildlife documentary scene grabs the editor first?",
  [
    "Whale migration",
    "Wolf pack",
    "Turtle hatchlings",
    "Snow leopard",
    "Bird courtship",
    "Coral reef"
  ]
  ]
]);
const weights=[31,23,18,12,9,7]; // exactly 100, openly editorial.
export const EXHIBITION_FIT_SAMPLES=Object.freeze(fitSamples.map(([id,category,prompt,names])=>({
  id:"v19-exhibition-fit-"+id,kind:"fit",category,prompt,
  detail:"Predict OUTLIER's editorial preference weights, not a measured player survey.",
  answers:[],choices:names.map((name,i)=>[name,weights[i]]),
  source:"Original OUTLIER editorial game-night preference example; fictional calibration"
})));
export function buildExhibitionBank(){
  const seen=new Set();
  const rares=EXHIBITION_RARE_IDS.map(id=>{
    const q=rareQuestions.find(entry=>entry.id===id);
    if(!q||!q.arcadeOnly||!q.bigPool||q.answers?.length<28)
      throw new Error("Missing vetted exhibition-only CC0 prompt: "+id);
    const a=auditQuestionAliases(q);
    if(a.collisions.length||a.invalidPoints.length)
      throw new Error("Unverified alias/points in "+id);
    return {id:"exhibition_"+q.id,kind:"rare",category:q.category,
      prompt:q.prompt,detail:q.detail||"",answers:q.answers,choices:[],
      source:q.source||"See OUTLIER v1.6 CC0 Corpora sources"};
  });
  const all=[...rares,...EXHIBITION_FIT_SAMPLES];
  for(const q of all){
    if(seen.has(q.id))throw new Error("Repeated exhibition ID: "+q.id);
    seen.add(q.id);
    if(q.kind==="fit" && (q.choices.length!==6||
      q.choices.reduce((n,x)=>n+x[1],0)!==100||
      new Set(q.choices.map(x=>normalizeAnswer(x[0]))).size!==6))
      throw new Error("Invalid editorial choices: "+q.id);
    if(q.id.length>100||q.prompt.length<10||q.prompt.length>240)
      throw new Error("Unsupported exhibition row: "+q.id);
  }
  if(all.length<100)throw new Error(`Game Night 2.0 requires at least 100 vetted questions; found ${all.length}`);
  return all;
}
