const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const connectDatabase = require("./config/database");

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");
const ADMIN_RELEASE = "20260726-admin-v7";

app.disable("x-powered-by");
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

function servirBundle(arquivos, tipo) {
  return (req, res, next) => {
    const caminhos = arquivos.map((arquivo) => path.join(publicDir, arquivo));
    if (caminhos.some((arquivo) => !fs.existsSync(arquivo))) return next();

    const conteudo = caminhos
      .map((arquivo) => fs.readFileSync(arquivo, "utf8"))
      .join(tipo === "application/javascript" ? "\n;\n" : "\n\n");

    res.setHeader("Content-Type", `${tipo}; charset=utf-8`);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.send(conteudo);
  };
}

app.get(
  "/admin-enhanced.js",
  servirBundle(["admin-enhanced.js"], "application/javascript")
);
app.get(
  "/admin-enhanced.css",
  servirBundle(["admin-enhanced.css"], "text/css")
);

function secaoRelatoriosProvas() {
  return `
      <section class="admin-section" id="section-exam-results" data-title="Relatórios de Provas" data-permission="provas">
        <div class="admin-section-head">
          <div>
            <span class="admin-kicker">MÓDULOS DE ESTUDO</span>
            <h2>Resultados dos alunos</h2>
            <p>Consulte as tentativas por módulo e baixe o PDF corrigido com as respostas do aluno e o gabarito indicado nas questões erradas.</p>
          </div>
          <button class="admin-primary-btn" type="button" id="refreshExamResults">↻ Atualizar</button>
        </div>

        <div class="admin-mini-stat-grid">
          <article><small>Resultados</small><strong id="examResultTotal">0</strong></article>
          <article><small>Aprovados</small><strong id="examResultApproved">0</strong></article>
          <article><small>Reprovados</small><strong id="examResultFailed">0</strong></article>
          <article><small>Em análise</small><strong id="examResultReview">0</strong></article>
        </div>

        <div class="admin-panel-card">
          <div class="admin-filterbar">
            <div class="admin-search">
              <span>⌕</span>
              <input id="examResultSearch" type="search" placeholder="Buscar aluno, módulo, e-mail ou prova" />
            </div>
            <select id="examResultStatus">
              <option value="">Todos os resultados</option>
              <option value="aprovado">Aprovados</option>
              <option value="reprovado">Reprovados</option>
              <option value="em_analise">Em análise</option>
              <option value="pendente">Pendentes</option>
            </select>
          </div>

          <div class="admin-results-help">
            <span>PDF</span>
            <div>
              <strong>Relatório corrigido automaticamente</strong>
              <p>As provas são vinculadas aos módulos de estudo. Questões erradas recebem uma seta indicando a resposta correta.</p>
            </div>
          </div>

          <div class="admin-table-wrap">
            <table class="admin-table admin-results-table">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Módulo</th>
                  <th>Prova</th>
                  <th>Nota</th>
                  <th>Acertos / erros</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th>Relatório</th>
                </tr>
              </thead>
              <tbody id="examResultsTableBody">
                <tr><td colspan="8"><div class="admin-empty-state">Carregando resultados…</div></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>`;
}

function servirAdminAtualizado(req, res, next) {
  const arquivo = path.join(publicDir, "admin.html");
  if (!fs.existsSync(arquivo)) return next();

  let html = fs.readFileSync(arquivo, "utf8");

  html = html
    .replace(/style\.css\?v=[^"]+/g, `style.css?v=${ADMIN_RELEASE}`)
    .replace(/admin-enhanced\.css\?v=[^"]+/g, `admin-enhanced.css?v=${ADMIN_RELEASE}`)
    .replace(/admin\.js\?v=[^"]+/g, `admin.js?v=${ADMIN_RELEASE}`)
    .replace(/admin-enhanced\.js\?v=[^"]+/g, `admin-enhanced.js?v=${ADMIN_RELEASE}`)
    .replace(
      "</head>",
      `  <link rel="stylesheet" href="admin-results.css?v=${ADMIN_RELEASE}" />\n  <script defer src="admin-results.js?v=${ADMIN_RELEASE}"></script>\n</head>`
    )
    .replace(
      /<button class="admin-nav-item" type="button" data-section="exams" data-permission="provas">[\s\S]*?<\/button>/,
      '<button class="admin-nav-item" type="button" data-section="exam-results" data-permission="provas"><span class="admin-nav-icon">□</span><span>Relatórios de Provas</span></button>'
    )
    .replace(
      /<section class="admin-section" id="section-exams"[\s\S]*?<\/section>/,
      secaoRelatoriosProvas()
    )
    .replace(
      '<select id="overviewChartPeriod">',
      '<select id="overviewChartPeriod" style="color:#f7f1ff!important;background-color:#12091d!important;border:1px solid rgba(179,103,255,.28)!important;border-radius:12px!important;min-height:42px;padding:0 42px 0 14px!important;color-scheme:dark!important;-webkit-appearance:none;appearance:none;">'
    );

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  return res.send(html);
}

app.get(["/admin", "/admin.html"], servirAdminAtualizado);

if (fs.existsSync(publicDir)) {
  app.use(
    express.static(publicDir, {
      extensions: ["html"],
      index: "index.html",
      maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
      setHeaders(res, filePath) {
        if (/\.(html|js|css)$/i.test(filePath)) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      }
    })
  );
}

function servirPagina(nomeArquivo) {
  return (req, res, next) => {
    const arquivo = path.join(publicDir, nomeArquivo);

    if (!fs.existsSync(arquivo)) return next();

    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.sendFile(arquivo);
  };
}

app.get(["/", "/index", "/index.html"], servirPagina("index.html"));
app.get(["/dashboard", "/dashboard.html"], servirPagina("dashboard.html"));
app.get(["/dashboard-free", "/dashboard-free.html"], servirPagina("dashboard-free.html"));
app.get(
  ["/painel-vendas", "/painel-vendas.html"],
  servirPagina("painel-vendas.html")
);

app.get("/api/status", (req, res) => {
  const estadosBanco = {
    0: "desconectado",
    1: "conectado",
    2: "conectando",
    3: "desconectando"
  };

  res.json({
    status: "online",
    nome: "Turma do Primo",
    versao: "4.1.3",
    release: "admin-provas-resultados-cache-fix",
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
