"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  os = require("node:os");
const express = require("express"),
  { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { installStore } = require("./helpers/study-memory-store.cjs");
const store = installStore(),
  M = require("../public/study-state-model");
const alpha = "1".repeat(24),
  beta = "2".repeat(24);
const account = (req) =>
  /study_account=beta/.test(req.headers.cookie || "") ? beta : alpha;
const auth = (req, res, next) => {
  if (/study_account=none/.test(req.headers.cookie || ""))
    return res.status(401).json({ erro: "Entre na sua conta" });
  req.usuario = {
    id: account(req),
    nome: "Primo",
    cargo: /study_admin=yes/.test(req.headers.cookie || "") ? "superadmin" : "aluno",
    acessoPremium: !/study_account=free/.test(req.headers.cookie || ""),
  };
  next();
};
require.cache[require.resolve("../middleware/auth")] = {
  exports: {
    auth,
    requirePremium: (req, res, next) =>
      req.usuario.acessoPremium
        ? next()
        : res.status(403).json({ erro: "Premium necessário" }),
  },
};
const permissions=require("../middleware/permissions");
permissions.temPermissaoEfetiva=async()=>true;
const service = require("../services/study-state"),
  router = require("../routes/study-state");
const {
    siteNavigation,
    canonicalPage,
  } = require("../middleware/site-navigation"),
  { securityHeaders } = require("../middleware/security-headers");
const root = path.resolve(__dirname, "../public"),
  output =
    process.env.STUDY_PREVIEW_DIR ||
    path.join(os.tmpdir(), "turma-learning-previews");
fs.mkdirSync(output, { recursive: true });
let fail = false;
const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(securityHeaders);
app.use(siteNavigation);
app.get("/me", auth, (req, res) =>
  fail
    ? res.status(503).json({ erro: "Fixture unavailable" })
    : res.json({ usuario: req.usuario }),
);
app.use("/study", router);
app.use("/learning",require("../routes/learning-content"));
app.get("/dashboard-premium/home", auth, async (req, res) => {
  const { state } = await service.update(req.usuario.id);
  res.json({
    estatisticas: { ...M.summary(state), totalNotas: 0, totalAvaliacoes: 0 },
    atividades: [],
    plano: { nome: "Premium", validadeTexto: "Acesso ativo" },
  });
});
app.get("/notificacoes", (req, res, next) =>
  req.get("Accept")?.includes("text/html")
    ? next()
    : res.json({ notificacoes: [], naoLidas: 0 }),
);
app.post("/logout", (req, res) => res.json({ ok: true }));
app.use((req, res, next) => {
  const page = canonicalPage(req.path);
  if (page === null) return next();
  if (page === "/")
    return res.send(
      '<!doctype html><html><head><script src="/page-navigation.js"></script></head><body>Login de teste</body></html>',
    );
  const file = path.join(root, page.slice(1) + ".html");
  if (!fs.existsSync(file)) return next();
  let html = fs
    .readFileSync(file, "utf8")
    .replace(
      /<head>/i,
      '<head><script src="/page-navigation.js"></script><link rel="stylesheet" href="/content-protection.css"><script defer src="/content-protection.js"></script>',
    );
  if (
    !html.includes("study-workspace.css") &&
    !html.includes("dashboard-premium-workspace.css")
  )
    html = html.replace(
      "</head>",
      '<link rel="stylesheet" href="/responsive-global.css"></head>',
    );
  res
    .type("html")
    .send(html.replace(/<body\b/, "<body data-protected-content"));
});
app.get(["/__premium/modulos","/__premium/modulos.html"],auth,(req,res)=>res.sendFile(path.join(root,"modulos.html")));
app.use(express.static(root));
(async()=>{
  const server=await new Promise(resolve=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s));});
  let browser;
  try{
    const mod=require(process.env.STUDY_CHROMIUM_PACKAGE||"/tmp/turma-study-browser/node_modules/@sparticuz/chromium/build/index.js"),binary=mod.default||mod;
    browser=await chromium.launch({headless:true,executablePath:await binary.executablePath(),args:binary.args.filter(a=>!["--single-process","--disable-web-security","--allow-running-insecure-content"].includes(a))});
    const base=`http://127.0.0.1:${server.address().port}`,context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    const goto=async(route,target=page)=>{await target.goto(base+route);await target.locator(route.startsWith("/modulos")?"#modulesApp":route.startsWith("/estudo")?"#studyApp":"#reelRace").waitFor({state:"visible"});};
    const capture=async(name,selector,target=page)=>{await target.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});await target.locator(selector).screenshot({path:path.join(output,name)});};
    async function boardCheck(target=page,selector="#demoBoard"){
      await target.waitForFunction(selector=>{const r=document.querySelector(selector),b=r?.querySelector("[data-number]");return r&&r.clientWidth&&b&&(r.dataset.layout==="table"||parseFloat(b.style.top)>0);},selector);
      await target.evaluate(()=>new Promise(requestAnimationFrame));
      const result=await target.locator(selector).evaluate(root=>{const box=root.getBoundingClientRect(),buttons=[...root.querySelectorAll('[data-number]')],rects=buttons.map(b=>{const r=b.getBoundingClientRect();return {n:b.dataset.number,left:r.left,top:r.top,right:r.right,bottom:r.bottom};}),fail=[];for(const r of rects){if(r.left<box.left-1||r.right>box.right+1)fail.push(`clipped ${r.n}`);for(const q of rects)if(r.n!==q.n&&Math.min(r.right,q.right)-Math.max(r.left,q.left)>1&&Math.min(r.bottom,q.bottom)-Math.max(r.top,q.top)>1)fail.push(`overlap ${r.n}/${q.n}`);}return {fail,unique:new Set(buttons.map(b=>b.dataset.number)).size,overflow:document.documentElement.scrollWidth-innerWidth};});
      assert.equal(result.unique,37);assert.deepEqual(result.fail,[]);assert(result.overflow<=1,`page overflow ${result.overflow}`);
    }
    await goto("/estudo-triangulacao#exemplo");
    for(const width of [360,390,650,768,1024,1440]){await page.setViewportSize({width,height:1000});await boardCheck();await page.locator('[data-board-mode="grid"][data-board-name="demo"]').click();await boardCheck();await page.locator('[data-board-mode="race"][data-board-name="demo"]').click();console.log("Race and table fit",width);}
    await page.setViewportSize({width:390,height:1050});
    await page.locator('[data-action="demo-next"]').click();await page.locator('[data-action="demo-next"]').click();
    await capture("race-estudo-mobile.png",".learn-board-wrap");
    await page.locator('[data-board-mode="grid"][data-board-name="demo"]').click();await capture("numeros-estudo-mobile.png",".learn-board-wrap");
    await page.locator("#studyTheme").click();await capture("numeros-estudo-claro.png",".learn-board-wrap");
    await page.setViewportSize({width:1440,height:1100});
    const C=require("../public/study-curriculum");
    for(const m of C.modules){await goto(`/estudo-${m.route}#explicacao`);await page.locator('[data-guide-answer="1"]').click();assert.match(await page.locator("#guideAnswer").textContent(),/Vamos revisar/);await page.locator('[data-guide-answer="0"]').click();assert.match(await page.locator("#guideAnswer").textContent(),/Isso mesmo/);await page.locator("#tab-exemplo").click();while(await page.locator('[data-action="demo-next"]').isEnabled())await page.locator('[data-action="demo-next"]').click();assert(await page.locator("#demoTrace .learn-trace-row").count()>0);await boardCheck();}
    await goto("/roleta-reel");
    await page.waitForFunction(()=>window.TurmaRace?.getState());
    for(const width of [360,390,768,1440]){await page.setViewportSize({width,height:1000});await boardCheck(page,'#reelRace [data-layout="race"]');await page.locator('[data-rt-view="racetrack"]').click();await boardCheck(page,'#reelRace [data-layout="table"]');await page.locator('[data-rt-view="race"]').click();}
    await page.locator('[data-rt-clear]').click();await page.locator('#reelRace [data-layout="race"] [data-number="0"]').click();await page.locator('[data-neighbor-step="1"]').click();assert.deepEqual((await page.evaluate(()=>window.TurmaRace.getSelectedNumbers())).sort((a,b)=>a-b),[0,26,32]);
    await page.evaluate(()=>window.TurmaRace.showResult(32));assert.equal(await page.locator('#reelRace [data-layout="race"] .result').getAttribute('data-number'),'32');
    await capture("race-roleta-desktop.png","#reelRace .tp-race-tool");await page.setViewportSize({width:390,height:1050});await capture("race-roleta-mobile.png","#reelRace .tp-race-tool");
    await goto("/modulos");
    assert.equal(await page.locator('.lib-module-card').count(),8);assert.equal(await page.locator('[data-manage]').count(),0);
    assert.equal(await page.locator('[data-complete]').isDisabled(),true);
    for(const width of [360,390,650,768,1024,1440]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth<=1));}
    await page.locator('#studyTheme').click();await capture("aulas-desktop-escuro.png","#studyShell");
    await page.locator('.lib-card-actions [data-pdf="pitagoras"]').click();assert.equal(await page.locator('#libraryTab-pdf').getAttribute('aria-selected'),'true');assert.equal(await page.locator('#libraryReader h2').textContent(),'Pitágoras');
    const downloadPromise=page.waitForEvent('download');await page.locator('#libraryReader [data-download]').click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'turma-do-primo-pitagoras.pdf');
    const buffer=await (await context.request.get(base+'/learning/materials/gemeos.pdf')).body();assert.equal(buffer.subarray(0,5).toString(),'%PDF-');
    await capture("pdf-desktop.png","#libraryPanel");
    await page.locator('[data-tab="instagram"]').click();assert.match(await page.locator('.lib-empty').textContent(),/próximos vídeos/);
    assert.equal((await context.request.put(base+'/learning/content/gemeos',{headers:{'X-Study-Account':alpha},data:{}})).status(),403);
    await context.addCookies([{name:'study_admin',value:'yes',url:base}]);
    await goto('/modulos');await page.locator('[data-manage]').click();
    await page.locator('[name="url"]').fill('https://youtu.be/M7lc1UVf-VE');await page.locator('[name="summary"]').fill('A família dos Gêmeos reúne 11, 22 e 33.\n\nQuando a origem é 11, os alvos são 22 e 33.');await page.locator('[name="duration"]').fill('12 min');
    await page.locator('#contentSave').click();await page.locator('#libraryDialog').waitFor({state:'hidden'});
    await context.clearCookies({name:'study_admin'});await goto('/modulos');assert.equal(await page.locator('[data-play]').isDisabled(),true);
    await context.addCookies([{name:'study_admin',value:'yes',url:base}]);await goto('/modulos');await page.locator('[data-manage]').click();await page.locator('[name="published"]').check();await page.locator('#contentSave').click();await page.locator('#libraryDialog').waitFor({state:'hidden'});
    await page.locator('[data-manage]').click();await page.locator('#contentChoice').selectOption('new');await page.locator('[name="title"]').fill('Como reconhecer os Gêmeos');await page.locator('[name="description"]').fill('Uma revisão rápida da família 11, 22 e 33.');await page.locator('[name="url"]').fill('https://www.instagram.com/reel/ABCdef12345/');await page.locator('[name="moduleId"]').selectOption('gemeos');await page.locator('[name="published"]').check();await page.locator('#contentSave').click();await page.locator('#libraryDialog').waitFor({state:'hidden'});
    await page.locator('[data-tab="instagram"]').click();assert.equal(await page.locator('.lib-instagram-card').count(),1);
    await context.route('https://www.instagram.com/**',r=>r.fulfill({contentType:'text/html',body:'<p>Instagram embed fixture</p>'}));
    await page.locator('.lib-instagram-card [data-instagram]').first().click();assert.match(await page.locator('.lib-instagram-embed').getAttribute('src'),/ABCdef12345\/embed\//);await page.keyboard.press('Escape');await page.locator('#libraryDialog').waitFor({state:'hidden'});
    await context.clearCookies({name:'study_admin'});
    await context.route('https://www.youtube.com/iframe_api',r=>r.fulfill({contentType:'text/javascript',body:`window.YT={Player:class {constructor(id,options){this.options=options;this.time=options.playerVars.start||0;window.fixturePlayer=this;const el=document.getElementById(id);el.textContent='YouTube player fixture';setTimeout(()=>options.events.onReady({target:this}),0);}playVideo(){}getDuration(){return 120;}getCurrentTime(){return this.time;}destroy(){} }};window.onYouTubeIframeAPIReady();`}));
    await goto('/modulos');await page.locator('[data-play]').click();await page.waitForFunction(()=>window.fixturePlayer);
    await page.evaluate(()=>{window.fixturePlayer.time=47;window.fixturePlayer.options.events.onStateChange({data:2});});await page.evaluate(()=>window.TurmaStudySync.sync());assert.equal(store.get(alpha).videos.gemeos.position,47);
    await page.reload();await page.locator('#modulesApp').waitFor({state:'visible'});await page.locator('[data-play]').click();await page.waitForFunction(()=>window.fixturePlayer);assert.equal(await page.evaluate(()=>window.fixturePlayer.time),47);
    await page.locator('[data-complete]').click();await page.evaluate(()=>window.TurmaStudySync.sync());assert.equal(store.get(alpha).videos.gemeos.completed,true);
    const second=await browser.newContext({viewport:{width:390,height:1000}}),other=await second.newPage();await goto('/modulos',other);assert.match(await other.locator('#selectedVideoProgress').textContent(),/concluiu/);
    await other.locator('.lib-card-actions [data-pdf="gemeos"]').click();assert.match(await other.locator('#libraryReader .lib-summary-text').textContent(),/origem é 11/);
    await second.addCookies([{name:'study_account',value:'beta',url:base}]);await goto('/modulos',other);assert.equal(await other.locator('#selectedVideoProgress').textContent(),'');
    await second.addCookies([{name:'study_account',value:'free',url:base}]);assert.equal((await second.request.get(base+'/learning/materials/gemeos.pdf')).status(),403);
    await second.addCookies([{name:'study_account',value:'none',url:base}]);assert.equal((await second.request.get(base+'/learning/catalog')).status(),401);
    await page.locator('[data-tab="pdf"]').click();await page.setViewportSize({width:390,height:1000});await capture('pdf-mobile.png','#libraryPanel');await page.locator('[data-tab="modulos"]').click();await capture('aulas-mobile.png','#studyShell');await page.locator('#studyTheme').click();await capture('aulas-mobile-claro.png','#studyShell');
    await page.locator('#studyMenu').click();assert.equal(await page.locator('#studyShell').evaluate(e=>e.inert),true);await page.keyboard.press('Escape');assert.equal(await page.locator('#studyShell').evaluate(e=>e.inert),false);
    for(const p of ['/modulos','/__premium/modulos']){const response=await context.request.get(base+p);assert.match(response.headers()['content-security-policy'],/frame-src https:\/\/www.youtube.com/);}
    assert.match((await context.request.get(base+'/estudo')).headers()['content-security-policy'],/frame-src 'none'/);
    assert.deepEqual(errors,[]);await second.close();await context.close();
    console.log('Browser OK: Race e mesa em seis larguras, oito guias, roleta, temas, publicação, PDF, Instagram, retomada de vídeo e isolamento por conta.');
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
