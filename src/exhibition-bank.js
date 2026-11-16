// OUTLIER exhibition-only library builder. Uses historically archived,
 // explicitly source-bounded CC0 lists already shipped in the guest game.
 // DO NOT mix these public identities with the *future ranked* private daily
 // question bank. Scores are editorial, never measured crowd frequencies.
import {rareQuestions} from "./data.js";
import {normalizeAnswer,auditQuestionAliases} from "./answer-intelligence.js";
export const EXHIBITION_RARE_IDS=Object.freeze([
  "open-v16-cc0-actors-all","open-v16-cc0-rock-all","open-v16-cc0-rpg-all",
  "open-v16-cc0-apples-all","open-v16-cc0-sandwiches-all","open-v16-cc0-plants-all",
  "open-v16-cc0-rivers-all","open-v16-cc0-horses-all","open-v16-cc0-teas-all",
  "open-v16-cc0-herbs-all","open-v16-cc0-programming-all","open-v16-cc0-colors-all",
  "open-v16-cc0-cats-all","open-v16-cc0-egyptian-all","open-v16-cc0-occupations-all",
  "open-v16-cc0-sports-all","open-v16-cc0-books-all","open-v16-cc0-weather-all"
]);
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
    if(!q||!q.arcadeOnly||!q.bigPool||q.answers?.length<20)
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
  return all;
}
