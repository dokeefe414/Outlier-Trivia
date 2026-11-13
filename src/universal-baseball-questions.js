// OUTLIER v1.6 historical MLB answer coverage, sourced from the public
// Chadwick Baseball Bureau Persons Register (ODC-BY 1.0).
// https://github.com/chadwickbureau/register — imported 2026-11-13.
// These are historical source memberships, not up-to-date player standings.
import {mlbPlayersA} from "./mlb-players-a.js";
import {mlbPlayersB} from "./mlb-players-b.js";
import {mlbPlayersC} from "./mlb-players-c.js";
import {mlbPlayersD} from "./mlb-players-d.js";
import {makeSourceQuestion} from "./open-atlas-questions.js";
import {normalizeAnswer} from "./answer-intelligence.js";

const rows=[...mlbPlayersA,...mlbPlayersB,...mlbPlayersC,...mlbPlayersD]
  .map(([name,firstYear,key])=>({name,firstYear,key}))
  .filter(x=>x.firstYear>=1871&&x.firstYear<=2026);
const seen=new Set();
const players=rows.filter(row=>{
  if(seen.has(row.key))return false;
  seen.add(row.key);
  return true;
});
const legendary=new Map(Object.entries({
  "Babe Ruth":130,"Jackie Robinson":160,"Hank Aaron":180,
  "Willie Mays":160,"Mickey Mantle":180,"Ted Williams":180,
  "Joe DiMaggio":200,"Ken Griffey Jr.":190,"Derek Jeter":130,
  "Barry Bonds":190,"Mike Trout":170,"Shohei Ohtani":170,
  "Ichiro Suzuki":190,"David Ortiz":200,"Nolan Ryan":220,
  "Alex Rodriguez":210,"Albert Pujols":200,"Pedro Martinez":230,
  "Sandy Koufax":230,"Mariano Rivera":240,"Roger Clemens":280,
  "Pete Rose":250,"Lou Gehrig":220,"Stan Musial":270,
  "Bob Gibson":260,"Randy Johnson":230,"Rickey Henderson":260,
  "Roberto Clemente":250,"Tom Seaver":260,"Tony Gwynn":270,
  "Cy Young":240,"Ty Cobb":240,"Honus Wagner":270
}).map(([name,points])=>[normalizeAnswer(name),points]));
const nickname={
  "baberuth":["The Bambino","Sultan of Swat"],
  "alexrodriguez":["A-Rod"],
  "davidortiz":["Big Papi"],
  "stanmusial":["Stan the Man"],
  "ichirosuzuki":["Ichiro"],
  "rickyhenderson":["Man of Steal"]
};
const score=row=>legendary.get(normalizeAnswer(row.name))||800;
const alias=row=>[row.name,row.name+" "+row.firstYear,
  ...(nickname[normalizeAnswer(row.name)]||[])];
const source="Chadwick Baseball Bureau persons register (ODC-BY 1.0); full attribution in docs";
const eras=[
 ["1871-1919",1871,1919],
 ["1920-1949",1920,1949],
 ["1950-1979",1950,1979],
 ["1980-1999",1980,1999],
 ["2000-2014",2000,2014],
 ["2015-2026",2015,2026]
];
export const universalBaseballQuestions=eras.map(([label,start,end])=>
  makeSourceQuestion({
    id:"v16-mlb-"+label,category:"BASEBALL",group:"sports",
    prompt:"Name a player whose first MLB-listed playing season is between "+
      start+" and "+end+" in the historical Chadwick register.",
    source,records:players.filter(x=>x.firstYear>=start&&x.firstYear<=end),
    name:row=>row.name+" (first listed "+row.firstYear+")",
    score,alias
  })
);
export const universalBaseballCount=players.length;
