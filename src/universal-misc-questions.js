// OUTLIER v1.6: source-scoped high-coverage prompts in EVERY trivia topic.
// Data from Darius Kazemi's Corpora, CC0 public domain compilation.
// https://github.com/dariusk/corpora (snapshot imported 2026-11-13).
// These are explicitly bounded historical inventories, not every answer
// that can logically fit a broad colloquial category.
import {universalArtsSnapshot as arts} from "./universal-arts-snapshot.js";
import {universalNatureSnapshot as nature} from "./universal-nature-snapshot.js";
import {universalGeneralSnapshot as general} from "./universal-general-snapshot.js";
import {makeSourceQuestion} from "./open-atlas-questions.js";
import {normalizeAnswer} from "./answer-intelligence.js";

const lists={...arts,...nature,...general};
const spec={
  actors:["people","ACTORS","British actors","humans/britishActors.json"],
  wealth:["people","PEOPLE","historic wealthiest-people sample","humans/richpeople.json"],
  rock:["music","MUSIC","Rock and Roll Hall of Fame inductees archive","music/rock_hall_of_fame.json"],
  xxl:["music","HIP-HOP","XXL Freshman lists 2007–2025","music/xxl_freshman.json"],
  mtv:["music","MUSIC","MTV's first-day music-video artists","music/mtv_day_one.json"],
  mtvSongs:["music","MUSIC","MTV's first-day video song titles","music/mtv_day_one.json"],
  milb:["sports","BASEBALL","archived Minor League Baseball team names","sports/milb_teams.json"],
  sports:["sports","SPORTS","sports and athletic activities","sports/sports.json"],
  books:["history","BOOKS","historical bestseller titles","books/bestsellers.json"],
  rpg:["games","GAMES","tabletop role-playing game titles","games/rpg/rpg_games.json"],
  guitarists:["music","MUSIC","female classical guitarists","music/female_classical_guitarists.json"],
  apples:["food","FOOD","apple cultivars","foods/apple_cultivars.json"],
  sandwiches:["food","FOOD","sandwich names","foods/sandwiches.json"],
  plants:["wild","PLANTS","plant common names","plants/plants.json"],
  rivers:["geo","GEOGRAPHY","river names","geography/rivers.json"],
  horses:["animals","ANIMALS","horse breeds and types","animals/horses.json"],
  england:["geo","GEOGRAPHY","English towns and cities","geography/english_towns_cities.json"],
  airports:["geo","GEOGRAPHY","U.S. airport-served city/state pairs","geography/us_airport_codes.json"],
  teas:["food","FOOD","tea varieties and product names","foods/tea.json"],
  herbs:["food","FOOD","herbs, spices and spice blends","foods/herbs_n_spices.json"],
  menu:["food","FOOD","historical menu-item terms","foods/menuItems.json"],
  programming:["science","SCIENCE","programming languages","technology/programming_languages.json"],
  minorPlanets:["science","ASTRONOMY","the numbered minor planets in the first 1,000-name archive","science/minor_planets.json"],
  colors:["wild","COLORS","named colors","colors/wikipedia.json"],
  weather:["science","SCIENCE","meteorological terms","science/meteorology.json"],
  cats:["animals","ANIMALS","cat breeds","animals/cats.json"],
  egyptian:["history","MYTHOLOGY","Egyptian deities","mythology/egyptian_gods.json"],
  occupations:["wild","JOBS","occupation names","humans/occupations.json"],
  subjects:["science","SCIENCE","academic subjects","books/academic_subjects.json"],
  authors:["history","LITERATURE","author surnames (not full names)","humans/authors.json"],
  rpgDesigners:["games","GAMES","tabletop RPG designers","games/rpg/rpg_designers.json"]
};
const common=new Map(Object.entries({
  "emmawatson":150,"juliandrews":230,"maggiesmith":250,
  "billgates":170,"warrenbuffett":200,
  "chuckberry":210,"jamesbrown":230,"raycharles":220,
  "jcole":160,"liluzivert":220,"future":230,
  "thebeatles":160,"thebangles":280,
  "basketball":160,"baseball":170,"soccer":170,"football":150,
  "tennis":200,"marathon":230,"10krun":260,
  "dungeonsanddragons":190,"pathfinder":290,
  "bagel":180,"pizza":150,"sandwich":200,"coffee":190,
  "basil":240,"cinnamon":240,"oregano":250,
  "rose":210,"oak":240,"pine":260,
  "nile":180,"amazon":180,"thames":230,
  "python":140,"javascript":160,"java":170,"cplusplus":190,"csharp":200,
  "ceres":270,"pluto":180,
  "blue":130,"red":130,"green":140,
  "doctor":220,"teacher":200,"programmer":290
}));
const rank=name=>common.get(normalizeAnswer(name))||800;
const questions=[];
const am=x=>/^[a-m]/i.test(x);
const nz=x=>/^[n-z]/i.test(x);
function add(key,name,filter=()=>true,label="") {
  const def=spec[key];
  if(!def)throw new Error("Unknown CC0 category: "+key);
  const [group,category,subject,path]=def;
  const description=label||subject;
  const source="CC0 Corpora archived "+subject+" list (https://github.com/dariusk/corpora/blob/master/data/"+path+")";
  questions.push(makeSourceQuestion({
    id:"v16-cc0-"+key+"-"+name,group,category,source,
    prompt:"Name "+(key==="authors"?"an author surname":"an entry")+
      " from OUTLIER's archived "+description+" reference list.",
    records:lists[key],name:x=>x,score:rank,alias:()=>[],filter
  }));
}
// Every original player-facing category receives additional source-backed
// inventory; the user sees exact scope in the question instead of a
// misleading promise that the list represents every item in the world.
for(const key of Object.keys(spec))add(key,"all");
for(const key of ["actors","rock","xxl","rpg","apples","plants","england",
  "teas","menu","programming","colors","occupations","minorPlanets","sports"]){
  // Numbered minor planets start with a numeric designation; instead of a
  // meaningless first-letter filter, segment by list identity elsewhere.
  if(key==="minorPlanets")continue;
  add(key,"am",x=>am(x),spec[key][2]+" beginning A–M");
  add(key,"nz",x=>nz(x),spec[key][2]+" beginning N–Z");
}
export const universalMiscQuestions=questions;
export const universalMiscCounts=Object.freeze(
  Object.fromEntries(Object.entries(lists).map(([key,values])=>[key,values.length]))
);
export const universalMiscSourceCount=Object.values(lists).reduce((n,a)=>n+a.length,0);
