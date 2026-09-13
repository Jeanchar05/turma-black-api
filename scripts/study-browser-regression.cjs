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
    path.join(os.tmpdir(), "turma-study-previews");
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
app.use(express.static(root));
(async () => {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  let browser;
  try {
    const mod = process.env.STUDY_CHROMIUM_PACKAGE
        ? require(process.env.STUDY_CHROMIUM_PACKAGE)
        : null,
      binary = mod?.default || mod;
    browser = await chromium.launch({
      headless: true,
      ...(binary
        ? {
            executablePath: await binary.executablePath(),
            args: binary.args.filter(
              (arg) =>
                ![
                  "--single-process",
                  "--disable-web-security",
                  "--allow-running-insecure-content",
                ].includes(arg),
            ),
          }
        : {}),
    });
    const base = "http://127.0.0.1:" + server.address().port,
      errors = [];
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1050 },
      }),
      page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    const goto = async (route, target = page) => {
      await target.goto(base + route);
      await target.locator("#studyApp").waitFor({ state: "visible" });
    };
    const sync = (target) =>
      target.evaluate(() => window.TurmaStudySync.sync());
    const capture = async (name, target = page) => {
      await target.evaluate(async () => {
        document.activeElement?.blur();
        scrollTo(0, 0);
        if (document.getElementById("studyToast"))
          document.getElementById("studyToast").hidden = true;
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map((img) => {
            img.loading = "eager";
            return img.decode().catch(() => {});
          }),
        );
        await Promise.all(
          document.getAnimations().map((a) => a.finished.catch(() => {})),
        );
      });
      await target.screenshot({
        path: path.join(output, name),
        fullPage: true,
      });
    };
    const solve = async (q, target = page) => {
      const board = target.locator("#gameBoardMount");
      if (q.kind === "fibonacci")
        for (let i = 0; i < 4; i++) {
          if (q.expected[i] === "fora")
            await board.locator(`[data-outside="${i}"]`).check();
          else
            await board
              .locator(`[data-answer-index="${i}"]`)
              .fill(q.expected[i]);
        }
      else if (q.kind === "espelhos")
        for (const pair of q.expected) {
          const [left, right] = pair.split(":");
          await board
            .locator(`[data-side="left"][data-value="${left}"]`)
            .click();
          await board
            .locator(`[data-side="right"][data-value="${right}"]`)
            .click();
        }
      else if (q.kind === "pitagoras") {
        await target
          .locator('[data-board-name="game"][data-board-mode="grid"]')
          .click();
        for (const n of q.expected)
          await board.locator(`[data-number="${n}"]`).click();
      } else {
        if (q.kind === "eclipse") await board.locator("[data-observe]").click();
        for (const value of q.expected)
          await board.locator(`[data-value="${value}"]`).click();
      }
    };
    if (!process.env.STUDY_BROWSER_FOCUS_ONLY) {
      await goto("/estudo");
      assert.equal(await page.locator(".learn-card").count(), 8);
      await page.locator("#studySearch").fill("gemeos");
      assert.equal(await page.locator(".learn-card").count(), 1);
      await page.locator("#studySearch").fill("inexistente");
      assert(await page.locator("#studyEmpty").isVisible());
      await page.locator('[data-action="clear-filters"]').click();
      for (const width of [360, 390, 650, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          "overflow " + width,
        );
      }
      await capture("estudo-desktop.png");
      await page.locator("#studyTheme").click();
      assert.equal(
        await page.locator("html").getAttribute("data-theme"),
        "light",
      );
      assert(
        (
          await page.locator("[data-study-art]").first().getAttribute("src")
        ).includes("-light.webp"),
      );
      await capture("estudo-claro.png");
      await page.setViewportSize({ width: 390, height: 844 });
      await capture("estudo-mobile.png");
      await page.locator("#studyMenu").click();
      assert.equal(
        await page.locator("#studyMenu").getAttribute("aria-expanded"),
        "true",
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page.locator("#studyMenu").getAttribute("aria-expanded"),
        "false",
      );
      await page.setViewportSize({ width: 1440, height: 1050 });
      await page.locator("#studyTheme").click();
      const modules = await page.evaluate(() =>
        TurmaStudy.modules.map((m) => ({ id: m.id, route: m.route })),
      );
      for (const m of modules) {
        await goto("/estudo-" + m.route);
        if (m.id === "gemeos")
          await page
            .locator("#studyNote")
            .fill("Revisar os vizinhos, não a ordem numérica.");
        await page.locator('[data-action="complete-explanation"]').click();
        assert(await page.locator("#demoComplete").isDisabled());
        await page.locator("#demoNext").click();
        await page.locator("#demoNext").click();
        if (m.id === "gemeos") {
          await page
            .locator('[data-board-name="demo"][data-board-mode="grid"]')
            .click();
          await page.locator('[data-board="demo"][data-number="0"]').click();
          assert(
            (await page.locator("#demoInspect").textContent()).includes(
              "26 e 32",
            ),
          );
          await page.locator("#demoCoverage").uncheck();
          assert.equal(
            await page.locator("#demoBoard .is-coverage").count(),
            0,
          );
          await page.locator("#demoCoverage").check();
          await page
            .locator('[data-board-name="demo"][data-board-mode="race"]')
            .click();
          await capture("gemeos-exemplo-desktop.png");
        }
        await page.locator("#demoComplete").click();
        await page.locator('[data-action="game-start"]').click();
        for (let round = 0; round < 5; round++) {
          const q = await page.evaluate(
            ({ id, round }) =>
              TurmaStudyGames.task(
                id,
                TurmaStudySync.state.modules[id].game.seed,
                round,
              ),
            { id: m.id, round },
          );
          await solve(q);
          if (round === 1) await capture(`jogo-${m.id}.png`);
          await page.locator("#gameCheck").click();
          assert(
            (await page.locator("#gameFeedback").textContent()).includes(
              "Boa!",
            ),
            m.id + " " + round,
          );
          if (m.id === "gemeos" && round === 0) {
            await sync(page);
            const other = await browser.newContext({
                viewport: { width: 390, height: 844 },
              }),
              p = await other.newPage();
            await goto("/estudo-gemeos#minigame", p);
            assert(
              (
                await p.locator('[data-action="game-start"]').textContent()
              ).includes("desafio 2"),
            );
            assert.equal(
              await p.locator("#studyNote").inputValue(),
              "Revisar os vizinhos, não a ordem numérica.",
            );
            await other.close();
          }
          await page.locator("#gameNext").click();
        }
        assert.equal(await page.locator("#studyPercent").textContent(), "100%");
        await sync(page);
        assert.equal(store.get(alpha).modules[m.id].sessions, 1);
        assert.equal(store.get(alpha).modules[m.id].bestScore, 5);
        await page.reload();
        await page.locator("#studyApp").waitFor({ state: "visible" });
        assert.equal(await page.locator("#studyPercent").textContent(), "100%");
        console.log("Jogo e retomada OK:", m.id);
      }
      // Failed attempts stay incomplete; server derives the score from actual answers.
      const ctxBeta = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      await ctxBeta.addCookies([
        { name: "study_account", value: "beta", url: base },
      ]);
      const pBeta = await ctxBeta.newPage();
      await goto("/estudo-gemeos#minigame", pBeta);
      assert.equal(await pBeta.locator("#studyPercent").textContent(), "0%");
      assert.equal(await pBeta.locator("#studyNote").inputValue(), "");
      await pBeta.locator('[data-action="game-start"]').click();
      for (let round = 0; round < 5; round++) {
        const wrong = await pBeta.evaluate((round) => {
          const q = TurmaStudyGames.task(
            "gemeos",
            TurmaStudySync.state.modules.gemeos.game.seed,
            round,
          );
          return q.choices.find(([id]) => !q.expected.includes(id))[0];
        }, round);
        await pBeta.locator(`#gameBoardMount [data-value="${wrong}"]`).click();
        await pBeta.locator("#gameCheck").click();
        assert(
          (await pBeta.locator("#gameFeedback").textContent()).includes(
            "Vamos revisar",
          ),
        );
        await pBeta.locator("#gameNext").click();
      }
      await sync(pBeta);
      assert.equal(store.get(beta).modules.gemeos.bestScore, 0);
      assert(!store.get(beta).modules.gemeos.steps.includes("minigame"));
      const mismatch = await pBeta.evaluate(async () => {
        const r = await fetch("/study/state", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Study-Account": "1".repeat(24),
          },
          body: JSON.stringify({
            operations: [
              {
                id: crypto.randomUUID(),
                kind: "patch",
                module: "gemeos",
                fields: { note: "Outra conta" },
              },
            ],
          }),
        });
        return r.status;
      });
      assert.equal(mismatch, 401);
      // Pending edits survive reload and reach a separate browser only after acknowledgement.
      await goto("/estudo-gemeos#exemplo");
      await page.route("**/study/state", (route) =>
        route.request().method() === "POST"
          ? route.fulfill({
              status: 503,
              contentType: "application/json",
              body: '{"erro":"temporariamente indisponível"}',
            })
          : route.continue(),
      );
      await page
        .locator("#studyNote")
        .fill("Anotação durante interrupção de conexão.");
      await page.locator("#studyNote").blur();
      await sync(page);
      await page.reload();
      await page.locator("#studyApp").waitFor({ state: "visible" });
      assert.equal(
        await page.locator("#studyNote").inputValue(),
        "Anotação durante interrupção de conexão.",
      );
      assert(await page.locator("#studyStorageStatus").isVisible());
      await page.unroute("**/study/state");
      await sync(page);
      assert.equal(
        store.get(alpha).modules.gemeos.note,
        "Anotação durante interrupção de conexão.",
      );
      assert.equal(
        await page.locator("#demoStageLabel").textContent(),
        "ETAPA 3 DE 3",
      );
    } else {
      const done = M.empty();
      for (const id of M.ids) {
        done.modules[id].steps = ["explicacao", "exemplo", "minigame"];
        done.modules[id].sessions = 1;
        done.modules[id].bestScore = 5;
      }
      store.set(alpha, done);
      store.set(beta, M.empty());
    }
    const second = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      device = await second.newPage();
    await goto("/estudo-gemeos#exemplo", device);
    assert.equal(
      await device.locator("#studyNote").inputValue(),
      store.get(alpha).modules.gemeos.note,
    );
    // Dashboard uses real 8-module totals. Timer deadline persists across navigation/devices.
    await page.goto(base + "/dashboard");
    await page.waitForFunction(
      () =>
        document.getElementById("focusStart") &&
        !document.getElementById("focusStart").disabled,
    );
    const layout = await page.evaluate(() => ({
      page: document.querySelector(".page").getBoundingClientRect().toJSON(),
      sidebar: document
        .querySelector(".sidebar")
        .getBoundingClientRect()
        .toJSON(),
      margin: getComputedStyle(document.querySelector(".page")).marginLeft,
      scrollX,
      innerWidth,
    }));
    assert(
      layout.page.left >= layout.sidebar.right - 1,
      JSON.stringify(layout),
    );
    assert(
      (await page.locator("#studyOverview").textContent()).includes("8 de 8"),
    );
    assert.equal(await page.locator(".dashboard-study-progress").count(), 8);
    await page.locator("#focusStart").click();
    await page.locator("#floatingFocus").waitFor({ state: "visible" });
    const deadline = store.get(alpha).focus.deadline;
    const before = await page.locator("#floatingFocus").boundingBox();
    await page.locator("#focusDrag").focus();
    await page.keyboard.press("Shift+ArrowLeft");
    const after = await page.locator("#floatingFocus").boundingBox();
    assert(after.x < before.x);
    await page.locator("#focusMinimize").click();
    assert(await page.locator("#focusBubble").isVisible());
    await page.reload();
    await page.locator("#focusBubble").waitFor({ state: "visible" });
    assert.equal(store.get(alpha).focus.deadline, deadline);
    await sync(device);
    await device.locator("#floatingFocus").waitFor({ state: "visible" });
    await device.locator("#floatingFocusAction").click();
    await device.waitForFunction(
      () => TurmaStudySync.state.focus.status === "paused",
    );
    await sync(page);
    assert.equal(store.get(alpha).focus.status, "paused");
    await device.locator("#floatingFocusAction").click();
    await device.waitForFunction(
      () => TurmaStudySync.state.focus.status === "running",
    );
    await page.locator("#focusBubble").click();
    await capture("dashboard-timer.png");
    await page.goto(base + "/roleta-real");
    await page.locator("#floatingFocus").waitFor({ state: "visible" });
    await page.goto(base + "/roleta-reel");
    await page.locator("#floatingFocus").waitFor({ state: "visible" });
    const fast = store.get(alpha);
    fast.focus.deadline = Date.now() - 1000;
    store.set(alpha, fast);
    await context.close();
    await device.reload();
    await device.locator("#studyApp").waitFor({ state: "visible" });
    assert.equal(
      await device.locator("#floatingFocusTime").textContent(),
      "00:00",
    );
    assert.equal(store.get(alpha).focus.status, "completed");
    await device.locator("#floatingFocusAction").click();
    await device.waitForFunction(
      () => TurmaStudySync.state.focus.status === "running",
    );
    assert(store.get(alpha).focus.deadline > Date.now());
    await device.locator("#focusDrag").focus();
    for (let i = 0; i < 35; i++) await device.keyboard.press("Shift+ArrowLeft");
    const mobileBounds = await device.locator("#floatingFocus").boundingBox();
    assert(mobileBounds.x >= 0 && mobileBounds.x + mobileBounds.width <= 390);
    await capture("estudo-timer-mobile.png", device);
    assert.equal(store.get(beta).focus.status, "idle");
    // Recoverable account/API failure keeps the retry action visible.
    fail = true;
    await device.goto(base + "/estudo");
    await device.locator("#studyRetry").waitFor({ state: "visible" });
    fail = false;
    await device.locator("#studyRetry").click();
    await device.locator("#studyApp").waitFor({ state: "visible" });
    assert.deepEqual(errors, []);
    console.log(
      process.env.STUDY_BROWSER_FOCUS_ONLY
        ? "Browser OK: dashboard, timer entre dispositivos e páginas, minimizar, mover, recarregar, concluir após fechar e iniciar novamente."
        : "Browser OK: desktop/celular, temas e imagens, 40 desafios, retomada entre dispositivos, falhas de conexão, contas isoladas, dashboard e timer persistente.",
    );
    console.log("Capturas:", output);
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
