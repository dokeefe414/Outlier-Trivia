// OUTLIER Content Atlas v0.5: curated from CC0 Corpora snapshots.
// Lists are finite and named as such; unfamiliar names are not proof of measured rarity.
import { mediaFacts } from "./media-facts.js";
import { natureFacts } from "./nature-facts.js";
import { sportsFacts } from "./sports-facts.js";
import { hipHopArtists } from "./hiphop-facts.js";

const norm = s => String(s ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const unique = array => {
  const map = new Map();
  for (const value of array) {
    const label = String(value || "").trim();
    if (!label || label.length > 85) continue;
    const key = norm(label);
    if (key && !map.has(key)) map.set(key,label);
  }
  return [...map.values()];
};
const favorite = {
  movies:["The Godfather","Titanic","The Dark Knight","Star Wars","Forrest Gump","The Shawshank Redemption","The Matrix","Jurassic Park","Toy Story","The Lion King","Pulp Fiction","Jaws","Rocky","The Avengers","Avatar","The Wizard of Oz","Back to the Future","Home Alone","Goodfellas","Frozen"],
  tv:["Friends","The Office","Breaking Bad","Game of Thrones","Lost","Seinfeld","The Simpsons","Modern Family","The Big Bang Theory","South Park","The Walking Dead","Family Guy","Grey's Anatomy","Stranger Things","The Sopranos","The X-Files","Saturday Night Live"],
  music:["The Beatles","Michael Jackson","Elvis Presley","Madonna","Prince","Bob Dylan","Led Zeppelin","Queen","Aretha Franklin","Nirvana","Eminem","Drake","Kendrick Lamar","Kanye West","J. Cole","Lil Wayne","Snoop Dogg","Tupac Shakur"],
  sports:["Los Angeles Lakers","Boston Celtics","New York Yankees","Dallas Cowboys","Kansas City Chiefs","Chicago Bulls","New England Patriots","Los Angeles Dodgers","Golden State Warriors","Boston Red Sox","Pittsburgh Steelers","Philadelphia Eagles","Green Bay Packers","New York Knicks"],
  animals:["dog","cat","horse","cow","sheep","lion","tiger","elephant","giraffe","zebra","monkey","bear","wolf","deer","rabbit","shark","dolphin","eagle","penguin","chicken","duck","goose"],
  food:["apple","banana","orange","watermelon","strawberry","blueberry","grape","lemon","lime","mango","pineapple","carrot","potato","onion","tomato","lettuce","broccoli","cucumber","spinach"],
  games:["Monopoly","Chess","Scrabble","Checkers","Clue","Risk","Catan","Pokemon","Pikachu","Charizard","Bulbasaur","Mario"],
  history:["Albert Einstein","Isaac Newton","Marie Curie","Charles Darwin","Galileo Galilei","Nikola Tesla","Ada Lovelace","Alan Turing","Aristotle","Archimedes","Hippocrates"],
  people:["Taylor Swift","Beyoncé","Adele","Brad Pitt","Leonardo DiCaprio","Angelina Jolie","Tom Cruise","Jennifer Aniston","Emma Watson","Will Smith","Rihanna","Kim Kardashian"]
};
const favorites = Object.fromEntries(Object.entries(favorite).map(([k,values])=>[k,new Set(values.map(norm))]));

function score(name,group,index,ordered = false) {
  const n = norm(name);
  if (favorites[group]?.has(n)) return 170;
  // Popular films in this source are intentionally given in broad notability
  // order. All other lists are alphabetical, so do NOT use array order as rarity.
  if (ordered && index < 35) return 340;
  if (ordered && index < 85) return 550;
  // Editorial familiarity heuristics, NOT crowd response percentages.
  if (name.length <= 5) return 540;
  if (name.length <= 10) return 680;
  if (name.length <= 18) return 820;
  return 930;
}
function namesFromMovies() {
  const rows=[];
  for (const raw of mediaFacts.movies) {
    const match=String(raw).match(/^(.*)\s+\((\d{4})\)$/);
    const name=match ? match[1].trim() : raw.trim();
    if (name) rows.push({name,year:match ? Number(match[2]) : null,aliases:match ? [raw] : []});
  }
  const map=new Map();
  for(const r of rows) if(!map.has(norm(r.name)))map.set(norm(r.name),r);
  return [...map.values()];
}
const movies=namesFromMovies();
const tv=unique(mediaFacts.tv);
const musicians=unique([...mediaFacts.artists,...hipHopArtists]);
const genres=unique(mediaFacts.genres);
const instruments=unique(mediaFacts.instruments);
const celebrities=unique(mediaFacts.celebrities);
const scientists=unique(mediaFacts.scientists);
const animals=unique(natureFacts.animals);
const birds=unique(natureFacts.birds);
const dogs=unique(natureFacts.dogs);
const fruits=unique(natureFacts.fruits);
const vegetables=unique(natureFacts.vegetables);
const pokemon=unique(natureFacts.pokemon);
const boardGames=unique(mediaFacts.boardGames);
const gods=unique(natureFacts.greekGods);
const teams=unique([...sportsFacts.nba,...sportsFacts.nfl,...sportsFacts.mlb,...sportsFacts.nhl]);
const hoops=unique(sportsFacts.mvp);
const foods=unique([...fruits,...vegetables]);

const templates = [];
function add(group,name,category,prompt,items,which=()=>true,note="",ordered=false) {
  const rows=items.filter(which);
  if(rows.length<28) throw new Error("Not enough accepted answers for "+name+" ("+rows.length+")");
  const normSeen=new Set();
  const answers=[];
  for (let i=0;i<rows.length;i++) {
    const item=rows[i];
    const label=String(item.name || item).trim();
    const key=norm(label);
    if(normSeen.has(key))continue;
    normSeen.add(key);
    const aliases=(item.aliases||[]).filter(alias=>norm(alias)!==key);
    answers.push([label,score(label,group,i,ordered),aliases]);
  }
  if(answers.length<28)throw new Error("Too few distinct answers "+name);
  templates.push({
    id:"pack-"+group+"-"+name, poolGroup:group, bigPool:true,
    category,prompt,
    detail:answers.length+" approved answers in our reviewed "+(note||"name")+" collection. Scores are estimated rarity tiers.",
    answers
  });
}
const am=s=>/^[a-m]/i.test(s);
const nz=s=>/^[n-z]/i.test(s);
const long=s=>String(s).replace(/[^a-z]/gi,"").length>=10;
const words=s=>String(s).includes(" ");
const startsThe=s=>/^the\s/i.test(s);
const containsE=s=>String(s).toLowerCase().includes("e");
const name = item => item.name||item;

// FILM (titles from a historical 256-film curated selection).
add("movies","all","MOVIES","Name a movie from our classic-and-popular film collection.",movies,undefined,"movie",true);
add("movies","pre2000","MOVIES","Name a film in our collection released before 2000.",movies,r=>r.year!==null&&r.year<2000,"movie",true);
add("movies","post1970","MOVIES","Name a film in our collection released in or after 1970.",movies,r=>r.year!==null&&r.year>=1970,"movie",true);
add("movies","am","MOVIES","Name a movie from our list that starts with A–M (ignoring 'The').",movies,r=>am(r.name.replace(/^The\s+/i,"")),"movie",true);
add("movies","nz","MOVIES","Name a movie from our list that starts with N–Z (ignoring 'The').",movies,r=>nz(r.name.replace(/^The\s+/i,"")),"movie",true);
add("movies","long","MOVIES","Name a movie title from our collection with at least ten letters.",movies,r=>long(r.name),"movie",true);
add("movies","two-words","MOVIES","Name a movie from our collection with a multi-word title.",movies,r=>words(r.name),"movie",true);

// TV.
add("tv","all","TELEVISION","Name a television series from our curated TV-show list.",tv);
add("tv","am","TELEVISION","Name a show in our catalog beginning with A–M.",tv,s=>am(s));
add("tv","nz","TELEVISION","Name a show in our catalog beginning with N–Z.",tv,s=>nz(s));
add("tv","long","TELEVISION","Name a TV-show title in our collection with 10+ letters.",tv,s=>long(s));
add("tv","multiword","TELEVISION","Name a TV series in our list with two or more words.",tv,s=>words(s));
add("tv","with-e","TELEVISION","Name a television series in our collection containing the letter E.",tv,s=>containsE(s));

// MUSIC: hall of fame performers, XXL Freshmen, genres, instruments.
add("music","artists","MUSIC","Name a musician or band in our Rock Hall / XXL performer collection.",musicians);
add("music","artists-am","MUSIC","Name a performer on our music list beginning with A–M (ignore 'The').",musicians,s=>am(s.replace(/^The\s+/i,"")));
add("music","artists-nz","MUSIC","Name a performer on our music list beginning with N–Z (ignore 'The').",musicians,s=>nz(s.replace(/^The\s+/i,"")));
add("music","rock-hall","MUSIC","Name a Rock & Roll Hall of Fame performer in our archived list.",unique(mediaFacts.artists));
add("music","xxl","HIP-HOP","Name a musician who appeared in our XXL Freshman lists (2007–2025).",unique(hipHopArtists));
add("music","genres","MUSIC","Name a music genre in our curated genre reference.",genres);
add("music","genres-long","MUSIC","Name a music genre in our list with at least ten letters.",genres,s=>long(s));
add("music","genres-am","MUSIC","Name a music genre in our list beginning A–M.",genres,s=>am(s));
add("music","genres-nz","MUSIC","Name a music genre in our list beginning N–Z.",genres,s=>nz(s));
add("music","instruments","MUSIC","Name a musical instrument from our curated collection.",instruments);

// SPORTS (historical roster snapshots, not current standings).
add("sports","all","SPORTS","Name an NBA, NFL, MLB or NHL team in our 2016–2020 roster snapshots.",teams);
add("sports","football","SPORTS","Name a 2020 NFL franchise from our historical team list.",unique(sportsFacts.nfl));
add("sports","basketball","SPORTS","Name an NBA franchise in our 2016-era team list.",unique(sportsFacts.nba));
add("sports","baseball","SPORTS","Name an MLB franchise in our 2016-era team list.",unique(sportsFacts.mlb));
add("sports","hockey","SPORTS","Name an NHL franchise in our 2016-era team list.",unique(sportsFacts.nhl));
add("sports","nba-mvp","BASKETBALL","Name an NBA MVP award winner between 1956 and 2017.",hoops);
add("sports","east-west","SPORTS","Name a 2016–2020 MLB, NBA, NFL or NHL team with a multi-word name.",teams,s=>words(s));
add("sports","teams-am","SPORTS","Name a team in our four-league archive beginning with A–M.",teams,s=>am(s));
add("sports","teams-nz","SPORTS","Name a team in our four-league archive beginning with N–Z.",teams,s=>nz(s));

// NATURE.
add("animals","common","ANIMALS","Name an animal from our common-animal reference list.",animals);
add("animals","common-am","ANIMALS","Name a common animal in our list beginning A–M.",animals,s=>am(s));
add("animals","common-nz","ANIMALS","Name a common animal in our list beginning N–Z.",animals,s=>nz(s));
add("animals","birds","ANIMALS","Name a North American bird listed on our archived bird checklist.",birds);
add("animals","birds-am","BIRDS","Name a bird from our North American list beginning A–M.",birds,s=>am(s));
add("animals","birds-nz","BIRDS","Name a bird from our North American list beginning N–Z.",birds,s=>nz(s));
add("animals","birds-long","BIRDS","Name a bird on our list whose name has at least ten letters.",birds,s=>long(s));
add("animals","birds-multi","BIRDS","Name a North American bird with a multi-word name in our list.",birds,s=>words(s));
add("animals","dogs","DOGS","Name a dog breed from our 453-breed reference.",dogs);
add("animals","dogs-am","DOGS","Name a dog breed from our list beginning A–M.",dogs,s=>am(s));
add("animals","dogs-nz","DOGS","Name a dog breed from our list beginning N–Z.",dogs,s=>nz(s));
add("animals","dogs-long","DOGS","Name a dog breed with 10+ letters in our list.",dogs,s=>long(s));

// FOOD.
add("food","fruits","FOOD","Name a fruit in our curated fruit collection.",fruits);
add("food","vegetables","FOOD","Name a vegetable in our curated vegetable collection.",vegetables);
add("food","produce","FOOD","Name a fruit or vegetable from our combined produce lists.",foods);
add("food","produce-am","FOOD","Name a fruit or vegetable in our list beginning A–M.",foods,s=>am(s));
add("food","produce-nz","FOOD","Name a fruit or vegetable in our list beginning N–Z.",foods,s=>nz(s));
add("food","produce-long","FOOD","Name a fruit or vegetable from our list with 10+ letters.",foods,s=>long(s));

// GAMING AND BOARD GAMES.
add("games","pokemon","GAMING","Name a Pokémon species in our archived Pokédex collection.",pokemon);
add("games","pokemon-am","GAMING","Name a Pokémon in our list beginning A–M.",pokemon,s=>am(s));
add("games","pokemon-nz","GAMING","Name a Pokémon in our list beginning N–Z.",pokemon,s=>nz(s));
add("games","pokemon-long","GAMING","Name a Pokémon in our list with at least ten letters.",pokemon,s=>long(s));
add("games","board-games","GAMES","Name a board game from our curated game collection.",boardGames);
add("games","board-am","GAMES","Name a board game from our list beginning A–M.",boardGames,s=>am(s));
add("games","board-nz","GAMES","Name a board game from our list beginning N–Z.",boardGames,s=>nz(s));

// HISTORY, SCIENCE, CULTURE.
add("history","scientists","HISTORY","Name a historical scientist or inventor in our reference collection.",scientists);
add("history","scientists-am","HISTORY","Name a scientist in our list whose name begins A–M.",scientists,s=>am(s));
add("history","scientists-nz","HISTORY","Name a scientist in our list whose name begins N–Z.",scientists,s=>nz(s));
add("history","scientists-long","HISTORY","Name a scientist or inventor with a 10+ letter name in our collection.",scientists,s=>long(s));
add("history","greek-mythology","MYTHOLOGY","Name a Greek deity from our 31-name reference list.",gods);
add("people","celebrities","PEOPLE","Name a celebrity in our curated pop-culture collection.",celebrities);
add("people","celeb-am","PEOPLE","Name a celebrity in our reference list whose name begins A–M.",celebrities,s=>am(s));
add("people","celeb-nz","PEOPLE","Name a celebrity in our reference list whose name begins N–Z.",celebrities,s=>nz(s));
add("people","celeb-long","PEOPLE","Name a celebrity in our list whose full name has 10+ letters.",celebrities,s=>long(s));

export const contentPackQuestions = templates;
export const contentPackCatalogCounts = Object.freeze({
  films:movies.length,tv:tv.length,musicians:musicians.length,
  genres:genres.length,instruments:instruments.length,teams:teams.length,
  animals:animals.length,birds:birds.length,dogs:dogs.length,
  fruits:fruits.length,vegetables:vegetables.length,
  pokemon:pokemon.length,boardGames:boardGames.length,
  scientists:scientists.length,celebrities:celebrities.length
});
