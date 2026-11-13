// Real-browser smoke checks against local static GitHub Pages files.
// Run via npm run test:browser after installing Playwright + Chromium.
import {chromium} from "playwright";
import {rareQuestions} from "../src/data.js";
import assert from "node:assert/strict";

const browser = await chromium.launch({headless:true});
const url = process.env.OUTLIER_TEST_URL || "http://127.0.0.1:8000/";
const context = await browser.newContext({viewport:{width:1300,height:850},reducedMotion:"reduce"});
const page = await context.newPage();
page.setDefaultTimeout(12000);

async function runDaily() {
  await page.goto(url);
  await page.locator(".hero").waitFor();
  await page.locator("#tour-dialog").waitFor();
  for(let step=1;step<=4;step++){
    assert.match(await page.locator("#tour-dialog .eyebrow").innerText(),new RegExp("0"+step));
    await page.locator('button[data-action="tour-next"]').click();
  }
  assert.equal(await page.locator("#tour-dialog").count(),0,"intro should close");
  await page.locator(".season-panel").waitFor();
  await page.locator(".missions-panel").waitFor();
  await page.locator(".identity-preview").waitFor();
  await page.locator(".cosmetics-panel").waitFor();
  await page.locator(".beta-panel").waitFor();
  assert.equal(await page.locator(".theme-choice").count(),4);
  assert.match(await page.title(),/OUTLIER/);
  assert.match(await page.locator("h1").first().innerText(),/THINK/);
  await page.locator('button[data-action="daily"]').first().click();
  for(let round=1;round<=7;round++) {
    await page.locator(".question-card").waitFor();
    const text=await page.locator(".game-head h2").innerText();
    assert.match(text,new RegExp("Question\\s*"+round));
    const isFit=round%2===0;
    assert.equal(await page.locator(".question-card").getAttribute("class"),"card question-card "+(isFit?"fit":"rare"));
    if(round===1) {
      const initialTimer=await page.locator("#timer").innerText();
      await page.locator("#rare-answer").fill("this-answer-is-not-in-the-library-98765");
      await page.locator("#rare-form button[type=submit]").click();
      await page.locator("#answer-validation:not([hidden])").waitFor();
      assert.match(await page.locator("#retry-counter").innerText(),/1 guess/);
      await page.locator("#rare-answer").fill("another-impossible-name-8765");
      await page.locator("#rare-form button[type=submit]").click();
      assert.match(await page.locator("#retry-counter").innerText(),/2 guesses/);
      assert.match(await page.locator(".game-head h2").innerText(),/Question\s*1/);
      assert.equal(await page.locator(".feedback-card").count(),0,"rejected guess must not reveal the round");
      assert.equal(await page.locator(".game-score strong").innerText(),"0");
      assert.equal(await page.locator("#rare-answer").inputValue(),"","invalid answer should clear for a retry");
      const afterTimer=await page.locator("#timer").innerText();
      assert.ok(Number(afterTimer.split(":")[1])<=Number(initialTimer.split(":")[1]),
        "rejected answer must not reset timer");
    }
    await page.locator('button[data-action="skip"]').click();
    await page.locator(".feedback-card").waitFor();
    if (round===1) {
      const explorer = page.locator(".answer-explorer");
      await explorer.waitFor();
      await explorer.locator("summary").click();
      const count = await explorer.locator(".explorer-row").count();
      assert.ok(count >= 36,"expected a large Stand Out answer pool");
      const search = explorer.locator("#answer-explorer-filter");
      await search.fill("zzzz-nonexistent-answer");
      assert.equal(await explorer.locator(".explorer-row:visible").count(),0);
      await search.fill("");
      assert.equal(await explorer.locator(".explorer-row:visible").count(),count);
      console.log("PASS searchable expanded answer explorer with "+count+" valid responses");
    }
    await page.locator('button[data-action="next"]').click();
  }
  await page.locator(".result-scorecard").waitFor();
  const score=await page.locator(".result-number").innerText();
  assert.equal(score.trim(),"0");
  await page.locator('button[data-action="leaderboard"]').last().click();
  await page.locator(".badge-section").waitFor();
  await page.locator(".history-chart").waitFor();
  assert.match(await page.locator(".history-chart").innerText(),/28-DAY JOURNEY/);
  await page.locator(".knowledge-card").waitFor();
  await page.locator(".player-identity-panel").waitFor();
  await page.locator(".deep-knowledge").waitFor();
  assert.equal(await page.locator(".player-identity-panel .identity-choice").count(),10);
  assert.match(await page.locator(".missions-panel").first().innerText(),/WEEKLY KNOWLEDGE QUESTS/);
  assert.match(await page.locator(".badge-section").innerText(),/First Spark/);
  await page.reload();
  await page.locator(".hero").waitFor();
  assert.equal(await page.locator('button[data-action="result"]').count(),1);
  console.log("PASS desktop full daily, persistence, results, stats, badge UI");
}
async function runMobile() {
  await page.setViewportSize({width:390,height:844});
  await page.goto(url+"?beat=3800&day="+new Date().toISOString().slice(0,10));
  await page.locator(".hero").waitFor();
  assert.match(await page.locator(".friend-challenge").innerText(),/3,800/);
  const widths=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:window.innerWidth}));
  assert.ok(widths.scroll <= widths.viewport+2,"mobile horizontal overflow: "+JSON.stringify(widths));
  await page.locator('button[data-action="practice"]').first().click();
  await page.locator(".practice-grid").waitFor();
  assert.ok((await page.locator(".practice-option").count())>=10,"practice should have category options");
  assert.equal(await page.locator(".arcade-format").count(),3);
  await page.locator('[data-action="practice-format"][data-format="quick"]').click();
  await page.locator('button[data-action="start-practice"][data-group="music"]').click();
  await page.locator(".question-card").waitFor();
  assert.match(await page.locator(".session-pill").innerText(),/MUSIC/);
  for(let i=1;i<=3;i++){
    assert.match(await page.locator(".game-head h2").innerText(),new RegExp("Question\\s*"+i));
    if(i===1){
      const prompt=await page.locator(".question-prompt").innerText();
      const question=rareQuestions.find(q=>q.prompt===prompt);
      assert.ok(question,"practice prompt should exist in approved library");
      await page.locator("#rare-answer").fill("clearly-not-a-real-trivia-answer");
      await page.locator("#rare-form button[type=submit]").click();
      await page.locator("#answer-validation:not([hidden])").waitFor();
      assert.match(await page.locator(".game-head h2").innerText(),/Question\s*1/);
      await page.locator("#rare-answer").fill(question.answers[0][0]);
      await page.locator("#rare-form button[type=submit]").click();
      await page.locator(".feedback-card").waitFor();
      await page.locator(".scoring-insight").waitFor();
      await page.locator(".rare-moment").waitFor();
      assert.match(await page.locator(".rare-moment").innerText(),/curated answer scores|approved answer entries|vetted options/i);
      assert.match(await page.locator(".scoring-insight").innerText(),/APPROVED ANSWER SCORES/);
      assert.ok(Number((await page.locator(".feedback-points").innerText()).replace(/[^0-9]/g,""))>0,
        "valid library answer must finish the same question with points");
    }else{
      await page.locator('button[data-action="skip"]').click();
      await page.locator(".feedback-card").waitFor();
    }
    await page.locator('button[data-action="next"]').click();
  }
  await page.locator(".result-scorecard").waitFor();
  assert.match(await page.locator(".result-max").innerText(),/3,000/);
  await page.locator('button[data-action="practice"]').first().click();
  await page.locator('[data-action="practice-format"][data-format="rare-rush"]').click();
  await page.locator('button[data-action="start-practice"][data-group="sports"]').click();
  for(let i=1;i<=10;i++){
    await page.locator(".question-card.rare").waitFor();
    await page.locator('button[data-action="skip"]').click();
    await page.locator(".feedback-card").waitFor();
    await page.locator('button[data-action="next"]').click();
  }
  await page.locator(".result-scorecard").waitFor();
  assert.match(await page.locator(".result-max").innerText(),/10,000/);
  const widths2=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:window.innerWidth}));
  assert.ok(widths2.scroll<=widths2.viewport+2,"mobile game overflow: "+JSON.stringify(widths2));
  console.log("PASS mobile practice arcade Quick Hit (3 rounds), Rare Rush (10 rounds), score caps and viewport fit");
}

async function runSyntheticIdentity() {
  const context2=await browser.newContext({viewport:{width:440,height:850},reducedMotion:"reduce"});
  const seeded=await context2.newPage();
  const today=new Date().toISOString().slice(0,10);
  const dates=[0,1,2].map(offset=>{
    const date=new Date(today+"T12:00:00Z");
    date.setUTCDate(date.getUTCDate()-offset);
    return date.toISOString().slice(0,10);
  });
  const answers=[960,1000,700,1000,800,1000,400].map((points,i)=>({
    points,valid:true,type:i%2===0?"rare":"fit",category:"SCIENCE",
    accepted:i%2===0?"Rare answer "+i:"Top crowd "+i
  }));
  const days=Object.fromEntries(dates.map(day=>[day,{
    complete:true,answers,startedAt:Date.now()-86400000,
    questionIds:["test1","test2","test3","test4","test5","test6","test7"]
  }]));
  await seeded.addInitScript(value=>{
    localStorage.setItem("outlier-prototype-v1",JSON.stringify(value));
  },{days,arcade:{},sound:false,beta:{tutorial:true},theme:"nebula",player:{title:"",frame:""}});
  await seeded.goto(url);
  await seeded.locator(".identity-preview").waitFor();
  await seeded.locator('button[data-action="leaderboard"]').first().click();
  await seeded.locator(".player-identity-panel").waitFor();
  assert.equal(await seeded.locator('.identity-choice[data-id="seeker"]').isDisabled(),false);
  assert.equal(await seeded.locator('.identity-choice[data-id="diamond"]').isDisabled(),false);
  await seeded.locator('.identity-choice[data-id="seeker"]').click();
  await seeded.locator('.identity-choice[data-id="diamond"]').click();
  assert.match(await seeded.locator(".player-identity-panel").innerText(),/Knowledge Seeker/);
  assert.equal(await seeded.locator('.identity-choice[data-id="diamond"]').getAttribute("aria-pressed"),"true");
  await seeded.reload();
  await seeded.locator('button[data-action="leaderboard"]').first().click();
  assert.equal(await seeded.locator('.identity-choice[data-id="diamond"]').getAttribute("aria-pressed"),"true",
    "Cosmetic frame should persist across reloads");
  const widths=await seeded.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(widths.scroll<=widths.viewport+2,"mobile profile horizontal overflow: "+JSON.stringify(widths));
  await context2.close();
  console.log("PASS local title/frame unlocks, selection, persistence, and mobile player-card layout");
}

async function runAdminSafety() {
  await page.goto(new URL("admin.html",url).toString());
  await page.locator("#connection").waitFor();
  assert.equal(await page.locator("#workspace").isHidden(),true,"admin queue must remain locked");
  assert.match(await page.locator("#configuration").innerText(),/Supabase.*configured/i);
  assert.equal(await page.locator("#connect-button").isDisabled(),true);
  const input=await page.locator("#owner-token").inputValue();
  assert.equal(input,"","no owner secret should ever be embedded in the static page");
  console.log("PASS owner review studio blocks unconfigured public deployment");
}
try {
  await runDaily();
  await runMobile();
  await runSyntheticIdentity();
  await runAdminSafety();
} finally {
  await browser.close();
}
