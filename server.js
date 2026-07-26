const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const connectDatabase = require("./config/database");

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");

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
  servirBundle(["admin-enhanced.js", "admin-results.js"], "application/javascript")
);
app.get(
  "/admin-enhanced.css",
  servirBundle(["admin-enhanced.css", "admin-results.css"], "text/css")
);

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
app.get(["/admin", "/admin.html"], servirPagina("admin.html"));
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
    versao: "4.1.2",
    release: "provas-modulos-pdf-v2",
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
