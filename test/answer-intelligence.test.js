import test from "node:test";
import assert from "node:assert/strict";
import {normalizeAnswer,oneEditApart,inspectRareGuess,suggestedApprovedAnswers,auditQuestionAliases,rarityTier,approvedNameSpellings} from "../src/answer-intelligence.js";
import {matchRare,evaluate} from "../src/game.js";
import {rareQuestions} from "../src/data.js";
import {approvedAliases} from "../src/approved-aliases.js";

const question=id=>rareQuestions.find(q=>q.id===id);

test("Unicode normalization preserves meaning and distinguishes sex symbols",()=>{
  assert.equal(normalizeAnswer("Côte d’Ivoire"),"cotedivoire");
  assert.equal(normalizeAnswer("Straße"),"strasse");
  assert.equal(normalizeAnswer("L'œuvre"),"loeuvre");
  assert.equal(normalizeAnswer("Łódź"),"lodz");
  assert.equal(normalizeAnswer("İSTANBUL"),"istanbul");
  assert.equal(normalizeAnswer("Nidoran♀"),"nidoranfemale");
  assert.equal(normalizeAnswer("Nidoran♂"),"nidoranmale");
  assert.notEqual(normalizeAnswer("Nidoran♀"),normalizeAnswer("Nidoran♂"));
  assert.equal(normalizeAnswer("AC/DC"),"acdc");
  assert.equal(normalizeAnswer("Earth, Wind & Fire"),"earthwindandfire");
});
test("one-edit checker accepts only one true insertion deletion or substitution",()=>{
  assert.equal(oneEditApart("curry","currry"),true);
  assert.equal(oneEditApart("curry","curry"),false);
  assert.equal(oneEditApart("curry","cury"),true);
  assert.equal(oneEditApart("curry","curay"),true);
  assert.equal(oneEditApart("curry","kurry"),true);
  assert.equal(oneEditApart("curry","lebron"),false);
  assert.equal(oneEditApart("curry",""),false);
});
test("approved sports nicknames work without falsely recognizing other players",()=>{
  const mvp=question("pack-sports-nba-mvp");
  assert.equal(matchRare(mvp,"Steph Curry")?.label,"Stephen Curry");
  assert.equal(matchRare(mvp,"Chef Curry")?.label,"Stephen Curry");
  assert.equal(matchRare(mvp,"Shaq")?.label,"Shaquille O'Neal");
  assert.equal(matchRare(mvp,"Bob Pettit")?.label,"Bob Pettit");
  assert.equal(matchRare(mvp,"Bob Petit")?.label,"Bob Pettit");
  assert.equal(evaluate({...mvp,type:"rare"},"Stephen Curry").points,180);
  assert.equal(evaluate({...mvp,type:"rare"},"Steph Curry").points,180);
  assert.equal(matchRare(mvp,"Totally Fake Player"),null);
});
test("approved full titles, band nicknames and dog names",()=>{
  assert.equal(matchRare(question("pack-movies-all"),"Star Wars")?.label,
    "Star Wars: Episode IV - A New Hope");
  assert.equal(matchRare(question("pack-movies-all"),"Fellowship of the Ring")?.label,
    "The Lord of the Rings: The Fellowship of the Ring");
  assert.equal(matchRare(question("pack-music-artists"),"Guns and Roses")?.label,
    "Guns N' Roses");
  assert.equal(matchRare(question("pack-animals-dogs"),"GSD")?.label,
    "German Shepherd");
  assert.equal(matchRare(question("pack-history-scientists"),"Einstein")?.label,
    "Albert Einstein");
});
test("ambiguous shorthand is rejected and both Nidoran forms are supported",()=>{
  const teams=question("pack-sports-all");
  assert.equal(inspectRareGuess(teams,"Giants").status,"unrecognized");
  const pokemon=question("pack-games-pokemon");
  assert.equal(matchRare(pokemon,"Nidoran Female")?.label,"Nidoran♀");
  assert.equal(matchRare(pokemon,"Nidoran Male")?.label,"Nidoran♂");
  assert.equal(matchRare(pokemon,"Nidoran"),null);
  const deliberatelyAmbiguous={answers:[["Mars",100,["red planet"]],["Venus",250,["red planet"]]]};
  assert.equal(inspectRareGuess(deliberatelyAmbiguous,"red planet").status,"ambiguous");
  assert.equal(inspectRareGuess(deliberatelyAmbiguous,"Mars").status,"accepted");
  assert.equal(inspectRareGuess(deliberatelyAmbiguous,"Jupiter").status,"unrecognized");
});
test("one-character typos only match unique full-length approved answers",()=>{
  const mvp=question("pack-sports-nba-mvp");
  const detected=inspectRareGuess(mvp,"Stephen Currry");
  assert.equal(detected.status,"accepted");
  assert.equal(detected.match?.matchKind,"typo");
  assert.equal(inspectRareGuess(mvp,"MJ").status,"unrecognized");
  assert.equal(inspectRareGuess(mvp,"").status,"empty");
});
test("all 105 broad lists are audited for contradictory aliases and points",()=>{
  const broad=rareQuestions.filter(q=>q.bigPool && !q.arcadeOnly);
  assert.equal(broad.length,105);
  let slots=0;
  for(const q of broad){
    const audit=auditQuestionAliases(q);
    assert.deepEqual(audit.collisions,[],q.id);
    assert.deepEqual(audit.invalidPoints,[],q.id);
    assert.ok(audit.answerCount>=28,q.id);
    slots+=audit.answerCount;
  }
  assert.equal(slots,23619);
  assert.ok(Object.keys(approvedAliases).length>=7);
  assert.equal(rarityTier(870).id,"deep-cut");
});

test("indexed one-edit matcher handles large catalogs and rejects ambiguous close names",()=>{
  const q={answers:[["Akron",700],["Akran",710],["Zzxlongname",900]]};
  assert.equal(inspectRareGuess(q,"Akron").match?.label,"Akron");
  assert.equal(inspectRareGuess(q,"Akrin").status,"ambiguous");
  assert.equal(inspectRareGuess(q,"Zzxlongnam").match?.label,"Zzxlongname");
  assert.equal(inspectRareGuess(q,"Zzzxlongname").match?.label,"Zzxlongname");
  assert.equal(inspectRareGuess(q,"Zzxlongneme").match?.label,"Zzxlongname");
  assert.equal(inspectRareGuess(q,"Zzxloooooname").status,"unrecognized");
  assert.deepEqual(suggestedApprovedAnswers(q,"Zzxloooooname"),[]);
  assert.equal(inspectRareGuess(q,"frog").status,"unrecognized");
});

test("approved descriptive name variants recognize equivalent names but not invented facts",()=>{
  const q={answers:[
    ["The St. Louis Blues",610],
    ["Mount Rainier",820],
    ["Fort Collins",720],
    ["Robert Downey Jr.",450],
    ["Ada Lovelace",900],
    ["The Beatles",170]
  ]};
  assert.equal(inspectRareGuess(q,"Saint Louis Blues").match?.label,"The St. Louis Blues");
  assert.equal(inspectRareGuess(q,"Mt. Rainier").match?.label,"Mount Rainier");
  assert.equal(inspectRareGuess(q,"Ft Collins").match?.label,"Fort Collins");
  assert.equal(inspectRareGuess(q,"Robert Downey Junior").match?.label,"Robert Downey Jr.");
  assert.equal(inspectRareGuess(q,"Lovelace, Ada").match?.label,"Ada Lovelace");
  assert.equal(inspectRareGuess(q,"Beatles").match?.label,"The Beatles");
  assert.equal(inspectRareGuess(q,"Mount Kilimanjaro").status,"unrecognized");
  assert.equal(inspectRareGuess(q,"Scientifically plausible answer").status,"unrecognized");
  assert.ok(approvedNameSpellings("st louis blues").includes("thesaintlouisblues"));
});
test("approved name transformations never guess when two exact owners collide",()=>{
  const q={answers:[["The Example",500],["Example",850],["The Cobalt",200]]};
  assert.equal(inspectRareGuess(q,"Example").match?.label,"Example","exact unambiguous input wins");
  const ambiguity={answers:[["St. Mary",500],["Saint Mary",750]]};
  assert.equal(inspectRareGuess(ambiguity,"The St Mary").status,"ambiguous");
  assert.equal(inspectRareGuess(ambiguity,"St. Mary").match?.label,"St. Mary");
  assert.equal(inspectRareGuess(q,"Cobalt").match?.label,"The Cobalt");
});
