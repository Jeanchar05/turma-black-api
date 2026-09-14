"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  os = require("node:os");
const express = require("express"),
  { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const {
  installNotesStore: installStore,
} = require("./helpers/notes-memory-store.cjs");
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
    nome: "Ana Júlia Ferreira",
    cargo: /study_admin=yes/.test(req.headers.cookie || "")
      ? "superadmin"
      : "aluno",
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
const permissions = require("../middleware/permissions");
permissions.temPermissaoEfetiva = async () => true;
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
    path.join(os.tmpdir(), "turma-notes-previews");
fs.mkdirSync(output, { recursive: true });
let fail = false;
const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(securityHeaders);
app.use(siteNavigation);
app.get("/me", auth, (req, res) => res.json({ usuario: req.usuario }));
app.use("/study", router);
app.use("/learning", require("../routes/learning-content"));
app.use(
  "/dashboard-premium/notas",
  (req, res, next) =>
    fail ? res.status(503).json({ erro: "Conexão indisponível" }) : next(),
  require("../routes/notes"),
);
app.get("/admin/painel/contexto", auth, (req, res) =>
  res.json({
    usuario: req.usuario,
    cargo: req.usuario.cargo,
    permissoes: { painelAdmin: true },
    centralDev: false,
  }),
);
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
      '<head><script defer src="/site-navigation-menu.js"></script><script src="/page-navigation.js"></script><link rel="stylesheet" href="/content-protection.css"><script defer src="/content-protection.js"></script>',
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
app.get(["/__premium/modulos", "/__premium/modulos.html"], auth, (req, res) =>
  res.sendFile(path.join(root, "modulos.html")),
);
app.use(express.static(root));
(async () => {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  let browser;
  try {
    const mod = require(process.env.STUDY_CHROMIUM_PACKAGE),
      binary = mod.default || mod;
    browser = await chromium.launch({
      headless: true,
      executablePath: await binary.executablePath(),
      args: binary.args.filter(
        (a) =>
          ![
            "--single-process",
            "--disable-web-security",
            "--allow-running-insecure-content",
          ].includes(a),
      ),
    });
    const base = `http://127.0.0.1:${server.address().port}`,
      ctx = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      }),
      page = await ctx.newPage(),
      errors = [],
      service = require("../services/notes");
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    const goto = async (p = page) => {
        await p.goto(base + "/notas");
        await p.locator("#notesApp").waitFor({ state: "visible" });
      },
      save = async (p = page) => {
        await p.locator("#noteSave").click();
        await p.waitForFunction(
          () =>
            document.getElementById("noteSaveStatus")?.textContent ===
            "Salvo na sua conta",
        );
      },
      close = async (p = page) => {
        await p.locator("[data-close-editor]").click();
        await p.locator("#noteEditor").waitFor({ state: "hidden" });
      },
      capture = async (name, selector = "#studyShell") => {
        await page.evaluate(() => document.fonts.ready);
        await page
          .locator(selector)
          .screenshot({ path: path.join(output, name) });
      };
    await goto();
    assert.equal(await page.locator(".notes-card").count(), 0);
    await page.locator("[data-new-note]").first().click();
    await page.locator("#noteTitle").fill("Minha revisão de Gêmeos");
    await page.locator("#noteCategory").selectOption("Gêmeos");
    await page.locator("#noteNewCategory").click();
    await page.locator("#noteCategoryName").fill("Revisão de aulas");
    await page.locator("#noteCategoryName").press("Enter");
    assert.equal(await page.locator("#noteCategory").inputValue(), "Revisão de aulas");
    await page.locator("#noteTags").fill("gêmeos, revisão");
    await page.locator("#noteColor").selectOption("gold");
    await page
      .locator("#noteContent")
      .fill(
        "Revisar o exemplo passo a passo.\nAlterar a origem e observar o conjunto.",
      );
    await page.locator("#noteContent").evaluate((el) => {
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
    });
    await page.locator("[data-command=bold]").click();
    await page.locator("#noteHighlight").selectOption("#fff2b3");
    await page.locator("#noteFavorite").click();
    await page.locator("#notePin").click();
    await page.locator("#noteAddCheck").click();
    await page
      .locator("#noteChecklist input[type=text]")
      .fill("Rever a próxima aula");
    await page.locator("#noteChecklist input[type=text]").press("Enter");
    await page.locator("[data-check]").check();
    await save();
    const first = (await service.list(alpha))[0];
    assert(first.favorita && first.fixada && first.checklist[0].concluido);
    assert.equal(first.categoria, "Revisão de aulas");
    assert.match(first.conteudo, /<(?:b|strong)(?:>| )/);
    await capture("editor-desktop-escuro.png", "#noteEditor");
    const download = page.waitForEvent("download");
    await page.locator("#notePdf").click();
    assert.match((await download).suggestedFilename(), /meu-caderno/);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => true,
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data) => {
          window.shareFixture = {
            files: data.files.map((f) => ({ type: f.type, size: f.size })),
            active: navigator.userActivation.isActive,
          };
        },
      });
    });
    await page.locator("#noteShare").click();
    await page.waitForFunction(
      () =>
        document.getElementById("notesNativeShare") &&
        !document.getElementById("notesNativeShare").disabled,
    );
    await page.locator("#notesNativeShare").click();
    const shared = await page.evaluate(() => window.shareFixture);
    assert(shared.active);
    assert.equal(shared.files[0].type, "application/pdf");
    assert(shared.files[0].size > 1000);
    await capture("compartilhar.png", "#notesAction");
    await page.locator("#notesAction [data-close-action]").click();
    await close();
    await capture("notas-desktop-escuro.png");
    console.log("Editor, checklist, PDF e compartilhamento OK");
    const otherCtx = await browser.newContext({
        viewport: { width: 390, height: 900 },
      }),
      other = await otherCtx.newPage();
    other.on("dialog", (d) => d.accept());
    await goto(other);
    assert.equal(await other.locator(".notes-card").count(), 1);
    await other.locator("[data-open-note]").first().click();
    assert.equal(await other.locator("#noteCategory").inputValue(), "Revisão de aulas");
    await page.locator("[data-open-note]").first().click();
    await page.locator("#noteTitle").fill("Revisão atualizada no computador");
    await save();
    await other.locator("#noteTitle").fill("Minha edição no celular");
    await other.locator("#noteSave").click();
    await other.locator("#noteConflict").waitFor({ state: "visible" });
    assert.equal(
      await other.locator("#noteTitle").inputValue(),
      "Minha edição no celular",
    );
    await other.locator("#noteSaveCopy").click();
    await other.waitForFunction(
      () =>
        document.getElementById("noteSaveStatus")?.textContent ===
        "Salvo na sua conta",
    );
    assert.equal((await service.list(alpha)).length, 2);
    assert.equal(
      (await service.get(alpha, first.id)).titulo,
      "Revisão atualizada no computador",
    );
    await close(other);
    await close();
    await page.locator("#notesRefresh").click();
    await page.waitForFunction(
      () => document.querySelectorAll(".notes-card").length === 2,
    );
    await page.locator("[data-open-note]").first().click();
    fail = true;
    await page.locator("#noteTitle").fill("Rascunho enquanto offline");
    await page.locator("#noteSave").click();
    await page.waitForFunction(() =>
      document
        .getElementById("noteSaveStatus")
        ?.textContent.includes("Pendente"),
    );
    await close();
    await page.reload();
    await page.locator("#notesApp").waitFor({ state: "visible" });
    await page
      .getByRole("heading", { name: "Rascunho enquanto offline" })
      .click();
    assert.equal(
      await page.locator("#noteTitle").inputValue(),
      "Rascunho enquanto offline",
    );
    fail = false;
    await save();
    await page.locator("#noteTrash").click();
    await page.locator("#noteEditor").waitFor({ state: "hidden" });
    await page.locator("[data-scope=trash]").click();
    await page.locator("[data-restore]").click();
    assert.equal(await page.locator(".notes-card").count(), 0);
    await page.locator("[data-scope=all]").click();
    await page.locator("[data-open-note]").first().click();
    await page.locator("#noteTrash").click();
    await page.locator("#noteEditor").waitFor({ state: "hidden" });
    await page.locator("[data-scope=trash]").click();
    await page.waitForFunction(
      () =>
        document.getElementById("notesSync").textContent ===
        "Tudo salvo na sua conta.",
    );
    await page.locator("[data-remove]").click();
    await page.locator("#notesConfirm").click();
    await page.waitForFunction(
      () => document.querySelectorAll(".notes-card").length === 0,
    );
    assert.equal((await service.list(alpha)).length, 1);
    console.log(
      "Conflito, cópia, offline, reload, lixeira, restauração e exclusão OK",
    );
    await page.locator("[data-scope=all]").click();
    for (const width of [360, 390, 650, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
    }
    await page.locator("#studyTheme").click();
    await page.evaluate(() => scrollTo(0, 0));
    await capture("notas-desktop-claro.png");
    await page.setViewportSize({ width: 390, height: 900 });
    await capture("notas-mobile-claro.png");
    await page.locator("[data-open-note]").first().click();
    assert(
      await page
        .locator("#noteEditor")
        .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
    );
    await capture("editor-mobile-claro.png", "#noteEditor");
    const buttons = await page
      .locator(".notes-editor-actions .learn-button")
      .evaluateAll((b) => b.map((el) => el.getBoundingClientRect().toJSON()));
    assert(
      buttons[0].right <= buttons[1].left &&
        buttons[1].right <= buttons[2].left,
    );
    await close();
    await page.locator("#studyTheme").click();
    await capture("notas-mobile-escuro.png");
    await page.locator("#studyMenu").click();
    await page.waitForFunction(
      () =>
        document.getElementById("studySidebar").getBoundingClientRect().left >=
        -0.1,
    );
    assert.equal(
      await page.locator('#studySidebar a[href="/minigames"]').count(),
      0,
    );
    assert.equal(
      await page.locator('#studySidebar a[href="/roleta"]').innerText(),
      "Roleta Operacional",
    );
    await page.keyboard.press("Escape");
    await otherCtx.addCookies([
      { name: "study_account", value: "beta", url: base },
    ]);
    await goto(other);
    assert.equal(await other.locator(".notes-card").count(), 0);
    assert.equal(
      (
        await otherCtx.request.get(
          base + `/dashboard-premium/notas/${first.id}.pdf`,
          { headers: { "X-Notes-Account": beta } },
        )
      ).status(),
      404,
    );
    assert.equal(
      (
        await ctx.request.put(base + `/dashboard-premium/notas/${first.id}`, {
          data: {},
        })
      ).status(),
      401,
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await ctx.addCookies([{ name: "study_admin", value: "yes", url: base }]);
    await page.goto(base + "/admin#instagram");
    await page.locator("#instagramAdminForm").waitFor({ state: "visible" });
    await page.locator("[data-instagram-new]").click();
    const form = page.locator("#instagramAdminForm");
    await form.locator("[name=title]").fill("Revisão de Gêmeos no Instagram");
    await form
      .locator("[name=url]")
      .fill("https://www.instagram.com/reel/ABCdef12345/");
    await form
      .locator("[name=description]")
      .fill("Revise os conceitos e pratique no módulo.");
    await form.locator("[name=moduleId]").selectOption("gemeos");
    await form.locator("[name=actionKind]").selectOption("study");
    await form.locator("[name=actionLabel]").fill("Praticar Gêmeos");
    await form.locator("[name=actionModule]").selectOption("gemeos");
    await form.locator("[name=published]").check();
    await form.locator("[type=submit]").click();
    await page
      .getByText("Vídeo e ação publicados no site.", { exact: true })
      .waitFor({ state: "visible" });
    await capture("admin-instagram.png", "#section-instagram");
    await ctx.clearCookies({ name: "study_admin" });
    await page.goto(base + "/modulos#instagram");
    await page.locator(".lib-instagram-action").waitFor({ state: "visible" });
    assert.equal(
      await page.locator(".lib-instagram-action").textContent(),
      "Praticar Gêmeos →",
    );
    assert.equal(
      await page.locator(".lib-instagram-action").getAttribute("href"),
      "/estudo-gemeos",
    );
    await page.goto(base + "/modulos#pdf/pitagoras");
    await page.locator("#libraryReader").waitFor({ state: "visible" });
    assert.equal(
      await page.locator("#libraryReader h2").textContent(),
      "Pitágoras",
    );
    assert.deepEqual(errors, []);
    await otherCtx.close();
    await ctx.close();
    console.log(
      "Browser OK: caderno completo, contas, seis larguras, temas, menus, publicação de Instagram no admin e links diretos.",
    );
  } finally {
    await browser?.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
