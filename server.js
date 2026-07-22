const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const connectDatabase = require("./config/database");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;

/* ===============================
   ROTA PRINCIPAL
=============================== */

app.get("/", (req, res) => {
  res.json({
    status: "online",
    nome: "Turma do Primo API",
    versao: "2.0.0",
    mensagem: "Backend modular rodando com sucesso",
    banco: "MongoDB",
    estrutura: "modular",
    rotas: {
      auth: "routes/auth.js",
      usuarios: "routes/usuarios.js",
      admin: "routes/admin.js",
      alunos: "routes/alunos.js",
      vendas: "routes/vendas.js",
      dashboard: "routes/dashboard.js",
      agenda: "routes/agenda.js",
      notificacoes: "routes/notificacoes.js",
      suporte: "routes/suporte.js",
      provas: "routes/provas.js"
    }
  });
});

/* ===============================
   CARREGADOR DE ROTAS
=============================== */

function carregarRota(caminhoBase, arquivo) {
  const caminhoArquivo = path.join(__dirname, "routes", arquivo);

  if (!fs.existsSync(caminhoArquivo)) {
    console.log(`Rota pendente: routes/${arquivo}`);
    return;
  }

  app.use(caminhoBase, require(caminhoArquivo));
  console.log(`Rota carregada: ${caminhoBase} -> routes/${arquivo}`);
}

/* ===============================
   ROTAS
=============================== */

carregarRota("/", "auth.js");
carregarRota("/", "usuarios.js");
carregarRota("/admin", "admin.js");
carregarRota("/", "alunos.js");
carregarRota("/", "vendas.js");
carregarRota("/", "dashboard.js");
carregarRota("/", "agenda.js");
carregarRota("/", "notificacoes.js");
carregarRota("/", "suporte.js");
carregarRota("/", "provas.js");

/* ===============================
   FRONTEND VERSIONADO
=============================== */

const publicDirectory = path.join(__dirname, "public");

if (fs.existsSync(publicDirectory)) {
  app.use(
    express.static(publicDirectory, {
      index: false,
      etag: true,
      lastModified: true,
      maxAge: 0,
      setHeaders(res, filePath) {
        if (/\.(?:html|css|js)$/i.test(filePath)) {
          res.setHeader("Cache-Control", "no-cache");
        }
      }
    })
  );

  app.get("/admin", (req, res) => {
    res.redirect(302, "/admin.html");
  });

  app.get("/app", (req, res) => {
    res.redirect(302, "/index.html");
  });
}

/* ===============================
   ROTA 404
=============================== */

app.use((req, res) => {
  res.status(404).json({
    erro: "Rota não encontrada.",
    rota: req.originalUrl
  });
});

/* ===============================
   START
=============================== */

async function startServer() {
  await connectDatabase();

  return app.listen(PORT, () => {
    console.log(`API Turma do Primo rodando na porta ${PORT}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer
};
