// Broad CC0 Wikidata-derived film, TV, game, anime and manga questions.
// Source: Flightmussy filmmap-dataset snapshot of 2026-08-18.
// All content is guest practice/party only; ranked question keys stay sealed.
import {filmArchiveSnapshot} from "./universal-films-snapshot.js";
import {screenArchiveSnapshot} from "./universal-screen-snapshot.js";
import {makeSourceQuestion} from "./open-atlas-questions.js";
import {normalizeAnswer} from "./answer-intelligence.js";

const entries={film:filmArchiveSnapshot,...screenArchiveSnapshot};
const score=links=>links>=95?140:links>=75?250:links>=55?390:
  links>=40?520:links>=30?680:links>=20?820:920;
const record=([name,year,links,qid])=>({name,year,links,qid});
const media=Object.fromEntries(Object.entries(entries).map(([kind,rows])=>[
  kind, rows.map(record)
]));
const source="Wikidata-based 2026-08-18 film/location media snapshot; Wikimedia sitelinks proxy, not player frequency";
const prompts=[];
function add(kind,id,group,category,prompt,filter=()=>true) {
  const records=media[kind],name=row=>row.name+" ("+row.year+")";
  prompts.push(makeSourceQuestion({id:"v16-"+id,category,group,prompt,source,
    records,name,filter,score:row=>score(row.links),
    alias:row=>[row.name,row.name+" "+row.year]}));
}
const am=name=>/^[a-m]/i.test(name);
const nz=name=>/^[n-z]/i.test(name);
add("film","films-1950","movies","MOVIES",
  "Name a film released before 1950 from OUTLIER's archived 2026 Wikidata film list.",
  x=>x.year<1950);
add("film","films-1950-1979","movies","MOVIES",
  "Name a film released from 1950 through 1979 in our archived 2026 Wikidata film catalog.",
  x=>x.year>=1950&&x.year<=1979);
add("film","films-1980-1999","movies","MOVIES",
  "Name a film released from 1980 through 1999 in our archived 2026 Wikidata film catalog.",
  x=>x.year>=1980&&x.year<=1999);
add("film","films-2000-2014","movies","MOVIES",
  "Name a film released from 2000 through 2014 in our archived 2026 Wikidata film catalog.",
  x=>x.year>=2000&&x.year<=2014);
add("film","films-2015-2026","movies","MOVIES",
  "Name a film released from 2015 through 2026 in our archived 2026 Wikidata film catalog.",
  x=>x.year>=2015);
add("film","films-a-m","movies","MOVIES",
  "Name a film whose title begins A–M from OUTLIER's archived 2026 Wikidata film catalog.",
  x=>am(x.name));
add("film","films-n-z","movies","MOVIES",
  "Name a film whose title begins N–Z from OUTLIER's archived 2026 Wikidata film catalog.",
  x=>nz(x.name));

add("tv","tv-all","tv","TELEVISION",
  "Name a television series from our archived 2026 Wikidata production catalog.");
add("tv","tv-before-2000","tv","TELEVISION",
  "Name a television series first released before 2000 from our archived 2026 catalog.",
  x=>x.year<2000);
add("tv","tv-2000-2014","tv","TELEVISION",
  "Name a television series that debuted from 2000 through 2014 in our archived 2026 catalog.",
  x=>x.year>=2000&&x.year<=2014);
add("tv","tv-2015-2026","tv","TELEVISION",
  "Name a television series that debuted from 2015 through 2026 in our archived 2026 catalog.",
  x=>x.year>=2015);

add("game","videogames-all","games","VIDEO GAMES",
  "Name a video game from our archived 2026 Wikidata-based game catalog.");
add("game","videogames-before-2000","games","VIDEO GAMES",
  "Name a video game released before 2000 in our archived 2026 catalog.",
  x=>x.year<2000);
add("game","videogames-2000-2014","games","VIDEO GAMES",
  "Name a video game released between 2000 and 2014 from our archived 2026 catalog.",
  x=>x.year>=2000&&x.year<=2014);
add("game","videogames-2015-2026","games","VIDEO GAMES",
  "Name a video game released between 2015 and 2026 from our archived 2026 catalog.",
  x=>x.year>=2015);

add("anime","anime-all","tv","ANIME",
  "Name an anime title in our archived 2026 Wikidata-based anime collection.");
add("manga","manga-all","games","MANGA",
  "Name a manga title in our archived 2026 Wikidata-based manga collection.");

export const universalMediaQuestions=prompts;
export const universalMediaCounts=Object.freeze(
  Object.fromEntries(Object.entries(media).map(([kind,rows])=>[kind,rows.length]))
);
