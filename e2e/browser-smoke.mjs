// Real-browser smoke checks against local static GitHub Pages files.
// Run via npm run test:browser after installing Playwright + Chromium.
import {chromium} from "playwright";
import assert from "node:assert/strict";

const browser = await chromium.launch({headless:true});
const url = process.env.OUTLIER_TEST_URL || "http://127.0.0.1:8000/";
const context = await browser.newContext({viewport:{width:1300,height:850},reducedMotion:"reduce"});
const page = await context.newPage();
page.setDefaultTimeout(12000);

async function runDaily() {
  await page.goto(url);
  await page.locator(".hero").waitFor();
  assert.match(await page.title(),/OUTLIER/);
  assert.match(await page.locator("h1").first().innerText(),/THINK/);
  await page.locator('button[data-action="daily"]').first().click();
  for(let round=1;round<=7;round++) {
    await page.locator(".question-card").waitFor();
    const text=await page.locator(".game-head h2").innerText();
    assert.match(text,new RegExp("Question\\s*"+round));
    const isFit=round%2===0;
    assert.equal(await page.locator(".question-card").getAttribute("class"),"card question-card "+(isFit?"fit":"rare"));
    await page.locator('button[data-action="skip"]').click();
    await page.locator(".feedback-card").waitFor();
    await page.locator('button[data-action="next"]').click();
  }
  await page.locator(".result-scorecard").waitFor();
  const score=await page.locator(".result-number").innerText();
  assert.equal(score.trim(),"0");
  await page.locator('button[data-action="leaderboard"]').last().click();
  await page.locator(".badge-section").waitFor();
  await page.locator(".knowledge-card").waitFor();
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
  await page.locator(".question-card").waitFor();
  const widths2=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:window.innerWidth}));
  assert.ok(widths2.scroll<=widths2.viewport+2,"mobile game overflow: "+JSON.stringify(widths2));
  console.log("PASS mobile friend challenge, practice game and viewport fit");
}

try {
  await runDaily();
  await runMobile();
} finally {
  await browser.close();
}
