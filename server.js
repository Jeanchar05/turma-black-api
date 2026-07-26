const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const connectDatabase = require("./config/database");

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");
const CACHE_VERSION = "20260726-416-cache-reset-2";

app.disable("x-powered-by");
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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
    res.setHeader("Surrogate-Control", "no-store");
    res.setHeader("CDN-Cache-Control", "no-store");
    return res.send(conteudo);
  };
}

function aplicarVersaoNosAssets(html) {
  return String(html).replace(
    /((?:href|src)=["'][^"']+\.(?:css|js))(?:\?v=[^"']*)?(["'])/gi,
    `$1?v=${CACHE_VERSION}$2`
  );
}

function servirPagina(nomeArquivo) {
  return (req, res, next) => {
    const arquivo = path.join(publicDir, nomeArquivo);

    if (!fs.existsSync(arquivo)) return next();

    const html = aplicarVersaoNosAssets(fs.readFileSync(arquivo, "utf8"));

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
  servirBundle(["style.css", "login-hotfix.css"], "text/css")
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
    ["admin-enhanced.css", "admin-results.css", "admin-hotfix.css"],
    "text/css"
  )
);

app.get("/limpar-cache", (req, res) => {
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
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
  <meta http-equiv="Pragma" content="no-cache" />
  <meta http-equiv="Expires" content="0" />
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
    <h1>Limpando a versão antiga…</h1>
    <p>Estamos removendo o cache salvo no aparelho e carregando a atualização mais recente.</p>
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

      const destino = "/index.html?fresh=${CACHE_VERSION}&t=" + Date.now();
      setTimeout(() => window.location.replace(destino), 700);
    })();
  </script>
</body>
</html>`);
});

app.get(["/", "/index", "/index.html"], servirPagina("index.html"));
app.get(["/dashboard", "/dashboard.html"], servirPagina("dashboard.html"));
app.get(["/dashboard-free", "/dashboard-free.html"], servirPagina("dashboard-free.html"));
app.get(["/admin", "/admin.html"], servirPagina("admin.html"));
app.get(
  ["/painel-vendas", "/painel-vendas.html"],
  servirPagina("painel-vendas.html")
);

if (fs.existsSync(publicDir)) {
  app.use(
    express.static(publicDir, {
      extensions: ["html"],
      index: "index.html",
      maxAge: 0,
      etag: false,
      lastModified: false,
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

app.get("/api/status", (req, res) => {
  const estadosBanco = {
    0: "desconectado",
    1: "conectado",
    2: "conectando",
    3: "desconectando"
  };

  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
  res.json({
    status: "online",
    nome: "Turma do Primo",
    versao: "4.1.6",
    release: "forced-cache-reset-assets-versioning",
    cacheVersion: CACHE_VERSION,
    frontend: fs.existsSync(publicDir) ? "integrado" : "não encontrado",
    backend: "Node.js + Express",
    banco: estadosBanco[mongoose.connection.readyState] || "desconhecido",
    estrutura: "frontend e API no mesmo serviço"
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
carregarRota("/admin", "admin-dashboard.js");
carregarRota("/admin", "admin-panel.js");
carregarRota("/admin", "dev-delete.js");
carregarRota("/admin", "admin-alunos.js");
carregarRota("/admin", "admin.js");
carregarRota("/", "alunos.js");
carregarRota("/", "vendas.js");
carregarRota("/", "dashboard.js");
carregarRota("/", "agenda.js");
carregarRota("/", "notificacoes-compat.js");
carregarRota("/", "notificacoes.js");
carregarRota("/", "suporte.js");
carregarRota("/", "provas-resultados-lista.js");
carregarRota("/", "provas-relatorios.js");
carregarRota("/", "provas.js");

app.use((req, res) => {
  res.status(404).json({
    erro: "Rota não encontrada.",
    rota: req.originalUrl
  });
});

async function iniciarServidor() {
  await connectDatabase();

  app.listen(PORT, () => {
    console.log(`Turma do Primo rodando na porta ${PORT}`);
  });
}

iniciarServidor().catch((error) => {
  console.error("Falha ao iniciar a aplicação:", error);
  process.exit(1);
});
