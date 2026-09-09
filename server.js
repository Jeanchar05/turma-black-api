"use strict";

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

require("./services/password-model-guard");
const connectDatabase = require("./config/database");
const { authPagina, requirePremiumPagina } = require("./middleware/auth");
const { corsOptions, securityHeaders } = require("./middleware/security-headers");
const { premiumContentGuard, isPremiumPath } = require("./middleware/premium-content-guard");
const { supportWriteRateLimit } = require("./middleware/rate-limit");
const {
  initializePremiumVault,
  resolvePremiumFile
} = require("./services/premium-vault");

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");
const premiumVaultDir = path.resolve(
  process.env.PREMIUM_VAULT_DIR || path.join(__dirname, ".premium-vault")
);
const CACHE_VERSION = "20260909-sales-command-5.1.0";
const DB_RETRY_MS = Math.max(15000, Number(process.env.DB_RETRY_MS || 30000));

let tentativaBancoEmAndamento = false;
let temporizadorReconexao = null;
let ultimoErroBanco = "";
let ultimaTentativaBanco = "";

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb", strict: true }));
app.use(express.urlencoded({ extended: true, limit: "10mb", parameterLimit: 500 }));

app.use((req, res, next) => {
  const unsafe = !["GET", "HEAD", "OPTIONS"].includes(String(req.method || "").toUpperCase());
  const supportPath = /^\/(?:suporte(?:\/|$)|admin\/suporte(?:\/|$))/i.test(req.path || "");
  if (unsafe && supportPath) return supportWriteRateLimit(req, res, next);
  return next();
});

app.use((req, res, next) => {
  if (/\.(?:html|css|js)$/i.test(req.path) || req.path === "/") {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    res.setHeader("CDN-Cache-Control", "no-store");
  }
  next();
});

app.use(premiumContentGuard);
app.use(servirPremiumDoCofre);

function servirBundle(arquivos, tipo) {
  return (req, res, next) => {
    const caminhos = arquivos.map((arquivo) => path.join(publicDir, arquivo));
    if (caminhos.some((arquivo) => !fs.existsSync(arquivo))) return next();

    const conteudo = caminhos
      .map((arquivo) => fs.readFileSync(arquivo, "utf8"))
      .join(tipo === "application/javascript" ? "\n;\n" : "\n\n");

    res.setHeader("Content-Type", `${tipo}; charset=utf-8`);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.send(conteudo);
  };
}

function aplicarVersaoNosAssets(html) {
  return String(html).replace(
    /((?:href|src)=["'][^"']+\.(?:css|js))(?:\?v=[^"']*)?(["'])/gi,
    `$1?v=${CACHE_VERSION}$2`
  );
}

function aplicarCamadaResponsiva(html) {
  let resultado = String(html);
  if (!resultado.includes("responsive-global.css")) {
    resultado = resultado.replace(
      "</head>",
      `  <link rel="stylesheet" href="/responsive-global.css" data-global-responsive />\n</head>`
    );
  }
  return resultado;
}

function aplicarExtrasAdmin(html) {
  let resultado = String(html);

  if (!resultado.includes("admin-final-ui.css")) {
    resultado = resultado.replace(
      "</head>",
      `  <link rel="stylesheet" href="admin-final-ui.css" />\n</head>`
    );
  }

  if (!resultado.includes("admin-command-center.css")) {
    resultado = resultado.replace(
      "</head>",
      `  <link rel="stylesheet" href="admin-command-center.css" />\n</head>`
    );
  }

  if (!resultado.includes("admin-final-ui.js")) {
    resultado = resultado.replace(
      "</body>",
      `  <script defer src="admin-final-ui.js"></script>\n</body>`
    );
  }

  if (!resultado.includes("admin-command-center.js")) {
    resultado = resultado.replace(
      "</body>",
      `  <script defer src="admin-command-center.js"></script>\n</body>`
    );
  }

  return resultado;
}

function aplicarCabecalhosPremium(res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("X-Premium-Delivery", "private-vault-v1");
  res.setHeader("X-Cache-Version", CACHE_VERSION);
}

function enviarArquivoPremium(req, res, next, requestPath) {
  try {
    const filePath = resolvePremiumFile(requestPath);
    if (!filePath) return res.status(404).end();

    aplicarCabecalhosPremium(res);

    if (/\.html$/i.test(filePath)) {
      let html = fs.readFileSync(filePath, "utf8");
      html = aplicarCamadaResponsiva(html);
      html = aplicarVersaoNosAssets(html);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    }

    return res.sendFile(filePath);
  } catch (error) {
    console.error("Falha na entrega Premium pelo cofre:", error.message);
    return next(error);
  }
}

function servirPremiumDoCofre(req, res, next) {
  if (!req || !["GET", "HEAD"].includes(String(req.method || "").toUpperCase())) return next();
  if (!isPremiumPath(req.path)) return next();
  return enviarArquivoPremium(req, res, next, req.path);
}

app.get(/^\/__premium\/(.+)$/, authPagina, requirePremiumPagina, (req, res, next) => {
  const relativeRaw = String(req.params?.[0] || "").replace(/^\/+/, "");
  const publicPath = `/${relativeRaw}`;
  if (!isPremiumPath(publicPath)) return res.status(404).end();
  return enviarArquivoPremium(req, res, next, publicPath);
});

function servirPagina(nomeArquivo) {
  return (req, res, next) => {
    const arquivo = path.join(publicDir, nomeArquivo);
    if (!fs.existsSync(arquivo)) return next();

    let html = fs.readFileSync(arquivo, "utf8");
    if (nomeArquivo === "admin.html") html = aplicarExtrasAdmin(html);
    html = aplicarCamadaResponsiva(html);
    html = aplicarVersaoNosAssets(html);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("X-Cache-Version", CACHE_VERSION);
    return res.send(html);
  };
}

app.get(
  "/style.css",
  servirBundle(["style.css", "login-hotfix.css", "responsive-global.css"], "text/css")
);

app.get(
  "/admin-enhanced.js",
  servirBundle(
    ["admin-enhanced.js", "admin-results.js", "admin-hotfix.js"],
    "application/javascript"
  )
);

app.get(
  "/admin-enhanced.css",
  servirBundle(
    ["admin-enhanced.css", "admin-results.css", "admin-hotfix.css", "responsive-global.css"],
    "text/css"
  )
);

app.get(
  "/painel-vendas.css",
  servirBundle(
    ["painel-vendas.css", "painel-vendas-command-v5.css", "responsive-global.css"],
    "text/css"
  )
);

app.get(
  "/painel-vendas.js",
  servirBundle(
    ["painel-vendas.js", "painel-vendas-command-v5.js"],
    "application/javascript"
  )
);

app.get("/limpar-cache", (req, res) => {
  res.setHeader("Clear-Site-Data", '"cache"');
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  return res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Atualizando Turma do Primo</title>
  <style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;color:#fff;font-family:Arial,sans-serif;background:radial-gradient(circle at 50% 20%,#37105b,#08030f 48%,#020104)}
    .box{width:min(430px,100%);padding:34px 28px;text-align:center;border-radius:26px;background:rgba(15,7,25,.96);border:1px solid rgba(192,84,255,.35);box-shadow:0 30px 90px rgba(0,0,0,.62)}
    .ring{width:68px;height:68px;margin:0 auto 20px;border-radius:50%;border:5px solid rgba(255,255,255,.08);border-top-color:#c054ff;animation:girar .8s linear infinite}
    h1{margin:0;font-size:25px}p{margin:12px 0 0;color:#b8adbf;line-height:1.55;font-size:14px}small{display:block;margin-top:18px;color:#8f829c}@keyframes girar{to{transform:rotate(360deg)}}
  </style>
</head>
<body>
  <main class="box">
    <div class="ring"></div>
    <h1>Carregando a nova versão…</h1>
    <p>Removendo arquivos antigos e aplicando a atualização.</p>
    <small>Versão ${CACHE_VERSION}</small>
  </main>
  <script>
    (async function () {
      try {
        if ("caches" in window) {
          const nomes = await caches.keys();
          await Promise.all(nomes.map((nome) => caches.delete(nome)));
        }
        if ("serviceWorker" in navigator) {
          const registros = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registros.map((registro) => registro.unregister()));
        }
      } catch (erro) {
        console.warn("Não foi possível limpar todo o cache:", erro);
      }
      setTimeout(() => window.location.replace("/?fresh=${CACHE_VERSION}&t=" + Date.now()), 700);
    })();
  </script>
</body>
</html>`);
});

app.get("/limpar-cache-suporte", (req, res) => {
  res.setHeader("Clear-Site-Data", '"cache"');
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  return res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#07030d" />
  <title>Atualizando Suporte</title>
  <style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;color:#fff;font-family:Arial,sans-serif;background:radial-gradient(circle at 50% 20%,#37105b,#08030f 48%,#020104)}
    .box{width:min(430px,100%);padding:34px 28px;text-align:center;border-radius:26px;background:rgba(15,7,25,.96);border:1px solid rgba(192,84,255,.35);box-shadow:0 30px 90px rgba(0,0,0,.62)}
    .ring{width:68px;height:68px;margin:0 auto 20px;border-radius:50%;border:5px solid rgba(255,255,255,.08);border-top-color:#c054ff;animation:girar .8s linear infinite}
    h1{margin:0;font-size:25px}p{margin:12px 0 0;color:#b8adbf;line-height:1.55;font-size:14px}small{display:block;margin-top:18px;color:#8f829c}@keyframes girar{to{transform:rotate(360deg)}}
  </style>
</head>
<body>
  <main class="box">
    <div class="ring"></div>
    <h1>Atualizando a Central de Suporte…</h1>
    <p>Aplicando a versão protegida do atendimento.</p>
    <small>Versão ${CACHE_VERSION}</small>
  </main>
  <script>
    (async function () {
      try {
        if ("caches" in window) {
          const nomes = await caches.keys();
          await Promise.all(nomes.map((nome) => caches.delete(nome)));
        }
        if ("serviceWorker" in navigator) {
          const registros = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registros.map((registro) => registro.unregister()));
        }
        localStorage.removeItem("supportFaqOpen");
        sessionStorage.removeItem("supportFaqOpen");
      } catch (erro) {
        console.warn("Não foi possível limpar todo o cache:", erro);
      }
      setTimeout(() => window.location.replace("/suporte?fresh=${CACHE_VERSION}&t=" + Date.now()), 850);
    })();
  </script>
</body>
</html>`);
});

app.get(["/", "/index", "/index.html"], servirPagina("index.html"));
app.get(["/dashboard", "/dashboard.html"], servirPagina("dashboard.html"));
app.get(["/dashboard-free", "/dashboard-free.html"], authPagina, servirPagina("dashboard-free.html"));
app.get(["/admin", "/admin.html"], authPagina, servirPagina("admin.html"));
app.get(["/painel-vendas", "/painel-vendas.html"], authPagina, servirPagina("painel-vendas.html"));
app.get(["/notas", "/notas.html"], servirPagina("notas.html"));
app.get(["/suporte", "/suporte.html"], authPagina, servirPagina("suporte.html"));
app.get(["/minigames", "/minigames.html"], servirPagina("minigames.html"));
app.get(["/estudo", "/estudo.html"], servirPagina("estudo.html"));
app.get(["/modulos", "/modulos.html"], servirPagina("modulos.html"));
app.get(["/perfil", "/perfil.html"], authPagina, servirPagina("perfil.html"));
app.get(["/roleta", "/roleta.html"], servirPagina("roleta.html"));
app.get(["/provas", "/provas.html"], servirPagina("provas.html"));
app.get(["/favoritos", "/favoritos.html"], servirPagina("favoritos.html"));
app.get(["/atividades", "/atividades.html"], servirPagina("dashboard.html"));
app.get(["/notificacoes", "/notificacoes.html"], servirPagina("dashboard.html"));

if (fs.existsSync(publicDir)) {
  app.use(
    express.static(publicDir, {
      extensions: ["html"],
      index: "index.html",
      maxAge: 0,
      etag: false,
      lastModified: false,
      dotfiles: "deny",
      setHeaders(res, filePath) {
        if (/\.(html|js|css)$/i.test(filePath)) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
          res.setHeader("Surrogate-Control", "no-store");
          res.setHeader("CDN-Cache-Control", "no-store");
        }
      }
    })
  );
}

app.get("/api/status", async (_req, res) => {
  let banco = "desconectado";
  try {
    if (connectDatabase.isConnected()) {
      await connectDatabase.query("SELECT 1 AS ok");
      banco = "conectado";
    } else if (tentativaBancoEmAndamento) {
      banco = "conectando";
    } else if (ultimoErroBanco) {
      banco = "indisponivel";
    }
  } catch (_) {
    banco = "indisponivel";
  }

  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
  return res.json({
    status: "online",
    nome: "Turma do Primo",
    versao: "5.1.0",
    release: "sales-command-security",
    banco,
    premium: "private-vault"
  });
});

function carregarRota(caminhoBase, arquivo) {
  const caminhoArquivo = path.join(__dirname, "routes", arquivo);

  if (!fs.existsSync(caminhoArquivo)) {
    console.log(`Rota pendente: routes/${arquivo}`);
    return;
  }

  app.use(caminhoBase, require(caminhoArquivo));
  console.log(`Rota carregada: ${caminhoBase} -> routes/${arquivo}`);
}

carregarRota("/", "login-compat.js");
carregarRota("/", "auth.js");
carregarRota("/", "aluno-action-guard.js");
carregarRota("/", "usuarios.js");
carregarRota("/", "liberacoes.js");

carregarRota("/admin", "admin-mysql-core.js");
carregarRota("/admin", "admin-command-center.js");
carregarRota("/admin", "admin-provas-mysql.js");
carregarRota("/admin", "admin-dashboard.js");
carregarRota("/admin", "admin-security-core.js");
carregarRota("/admin", "admin-panel.js");
carregarRota("/admin", "dev-delete.js");
carregarRota("/admin", "admin-alunos.js");
carregarRota("/admin", "admin.js");

carregarRota("/dashboard-premium", "dashboard-premium.js");
carregarRota("/", "alunos.js");
carregarRota("/", "vendas.js");
carregarRota("/", "dashboard.js");
carregarRota("/", "agenda.js");
carregarRota("/", "notificacoes-compat.js");
carregarRota("/", "notificacoes.js");
carregarRota("/", "support-upload-secure.js");
carregarRota("/", "suporte.js");
carregarRota("/", "provas-resultados-lista.js");
carregarRota("/", "provas-relatorios.js");
carregarRota("/", "provas.js");

app.use((req, res) => {
  res.status(404).json({ erro: "Rota não encontrada." });
});

function agendarNovaTentativa() {
  if (temporizadorReconexao || connectDatabase.isConnected()) return;

  temporizadorReconexao = setTimeout(() => {
    temporizadorReconexao = null;
    tentarConectarBanco();
  }, DB_RETRY_MS);

  if (typeof temporizadorReconexao.unref === "function") temporizadorReconexao.unref();
}

async function tentarConectarBanco() {
  if (tentativaBancoEmAndamento || connectDatabase.isConnected()) return;

  tentativaBancoEmAndamento = true;
  ultimaTentativaBanco = new Date().toISOString();

  try {
    await connectDatabase();
    ultimoErroBanco = "";
    console.log("Banco MySQL disponível para a aplicação.");
  } catch (error) {
    ultimoErroBanco = String(error?.message || "Falha ao conectar ao MySQL.");
    console.error("Banco MySQL indisponível:", ultimoErroBanco);
    agendarNovaTentativa();
  } finally {
    tentativaBancoEmAndamento = false;
  }
}

function iniciarServidor() {
  try {
    initializePremiumVault(publicDir, premiumVaultDir);
  } catch (error) {
    console.error("[SECURITY] Não foi possível preparar o cofre Premium:", error.message);
    process.exit(1);
    return;
  }

  const servidor = app.listen(PORT, () => {
    console.log(`Turma do Primo rodando na porta ${PORT}`);
    tentarConectarBanco();
  });

  servidor.on("error", (error) => {
    console.error("Falha ao iniciar o servidor HTTP:", error);
    process.exit(1);
  });
}

iniciarServidor();
