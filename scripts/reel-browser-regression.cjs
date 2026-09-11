const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const repo = path.resolve(__dirname, '..');
const outputDir = process.env.WORKSPACE_PREVIEW_DIR || path.join(require('os').tmpdir(), 'turma-workspace-v3-previews');
fs.mkdirSync(outputDir, {recursive:true});
const express = require(path.join(repo, 'node_modules/express'));
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { siteNavigation, canonicalPage } = require(path.join(repo, 'middleware/site-navigation'));
const { securityHeaders } = require(path.join(repo, 'middleware/security-headers'));
const publicDir = path.join(repo, 'public');
const app = express();
let fail = false;
const user = { nome:'Primo', acessoPremium:true, cargo:'aluno', plano:'black30', id:'test-fixture-user' };
app.use(securityHeaders);
app.use(siteNavigation);
app.get('/me', (req,res) => res.json({ usuario:user }));
app.get('/dashboard-premium/home', (req,res) => fail ? res.status(503).json({ erro:'Fixture unavailable' }) : res.json({ usuario:user, estatisticas:{ totalNotas:0,totalAvaliacoes:0,diasFoco:0 }, plano:{nome:'Mensal',validadeTexto:'Acesso ativo'},atividades:[] }));
app.post('/logout',(req,res)=>res.json({sucesso:true}));
app.use((req,res,next)=>{
  const page=canonicalPage(req.path);
  if(page===null) return next();
  const filename=page==='/'?'index.html':page==='/painel-admin'?'admin.html':`${page.slice(1)}.html`;
  const filepath=path.join(publicDir,filename);
  if(!fs.existsSync(filepath))return next();
  let html=fs.readFileSync(filepath,'utf8').replace(/<head>/i,'<head><script src="/page-navigation.js"></script><link rel="stylesheet" href="/content-protection.css"><script defer src="/content-protection.js"></script>');
  if(page==='/dashboard') html=html.replace('<body>','<body data-protected-content>');
  res.type('html').send(html);
});
app.use(express.static(publicDir));
app.use((req,res)=>res.status(404).json({erro:'Fixture route unavailable'}));

(async()=>{
const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});let browser;
try{
browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.stack));
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route=>route.abort());
await page.addInitScript(()=>sessionStorage.setItem('token','fixture-only'));
await page.goto('http://127.0.0.1:'+server.address().port+'/roleta-real');await page.locator('.real-start').click();await page.locator('body.reel-ready').waitFor();
assert.equal(await page.locator('.reel-cell').count(),37);
assert.equal(await page.locator('#mainNav a').last().textContent(),'Roleta Real');
assert.equal(await page.locator('#mainNav a').last().getAttribute('href'),'/roleta-real');
await page.locator('[data-view-panel="race"] [data-number="0"]').click();
await page.locator('[data-neighbor-step="1"]').click();
assert.equal(await page.locator('.real-selection-chips span').count(),3);
assert.equal(await page.locator('[data-view-panel="race"] [data-number="32"]').getAttribute('aria-pressed'),'true');
await page.locator('#reelSpin').click();assert.equal(await page.locator('#reelClear').isDisabled(),true);assert.equal(await page.locator('[data-race-tool]').evaluate(el=>el.inert),true);
await page.waitForFunction(()=>!document.getElementById('reelSpin').disabled);assert.match(await page.locator('#reelLastNumber').textContent(),/^([0-9]|[12][0-9]|3[0-6])$/);assert.equal(await page.locator('#reelHistory span').count(),1);
await page.locator('#reelClear').click();assert.equal(await page.locator('#reelLastNumber').textContent(),'--');assert.equal(await page.locator('#reelStatus').textContent(),'Pronta para girar');
for(const theme of ['dark','light']){
if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#reelThemeToggle').click();
assert.equal(await page.evaluate(()=>localStorage.getItem('turma.workspace.theme')),theme);
for(const width of [360,390,768,1024,1440]){await page.setViewportSize({width,height:1050});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow '+width);assert.ok(await page.locator('#reelWheel').evaluate(el=>{const w=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return w.left>=p.left&&w.right<=p.right}),'wheel overflow '+width);}
assert.equal(await page.locator("html").getAttribute("data-theme"),theme);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(outputDir,'roleta-reel-'+theme+'-desktop.png'),fullPage:true});
await page.setViewportSize({width:390,height:844});
assert.ok(await page.locator('[data-view-panel="race"] [data-number]').evaluateAll(buttons=>buttons.every(b=>{const r=b.getBoundingClientRect();return r.width>=40&&r.height>=44&&r.left>=0&&r.right<=innerWidth})), 'All mobile Race targets accessible');
await page.locator('[data-rt-view="racetrack"]').click();assert.equal(await page.locator('[data-view-panel="racetrack"]').isVisible(),true);
assert.ok(await page.locator('[data-view-panel="racetrack"] [data-number]').evaluateAll(buttons=>buttons.every(b=>{const r=b.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})), 'No clipped Racetrack targets');
await page.locator('[data-rt-view="race"]').click();await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(outputDir,'roleta-reel-'+theme+'-mobile.png'),fullPage:true});
}
await page.locator('#menuToggle').click();assert.equal(await page.locator('#menuToggle').getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await page.locator('#menuToggle').getAttribute('aria-expanded'),'false');
await page.locator('#menuToggle').click();await page.locator('#mainNav a').last().click();await page.locator('.real-start').waitFor();
assert.equal(await page.locator('h1').textContent(),'Roleta Real.');
await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(outputDir,'roleta-real-apresentacao-mobile.png'),fullPage:true});
await page.setViewportSize({width:1440,height:1050});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(outputDir,'roleta-real-apresentacao.png'),fullPage:true});
assert.deepEqual(errors,[]);console.log('PASS: spin, locking, reset, themes, 5 screen sizes and mobile menu');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
