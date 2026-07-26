const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const connectDatabase = require("./config/database");

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");

app.disable("x-powered-by");
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ===============================
   BANCO DE DADOS
=============================== */

connectDatabase();

/* ===============================
   FRONTEND
=============================== */

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

/* ===============================
   STATUS DA APLICAÇÃO
=============================== */

app.get("/api/status", (req, res) => {
  res.json({
    status: "online",
    nome: "Turma do Primo",
    versao: "3.0.0",
    frontend: fs.existsSync(publicDir) ? "integrado" : "não encontrado",
    backend: "Node.js + Express",
    banco: "MongoDB",
    estrutura: "frontend e API no mesmo serviço"
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
   ROTAS DA API
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
   ROTA INICIAL / FALLBACK
=============================== */

app.get("/", (req, res) => {
  const indexPath = path.join(publicDir, "index.html");

  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  return res.json({
    status: "online",
    nome: "Turma do Primo API",
    mensagem: "Backend online; frontend ainda não foi publicado."
  });
});

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

app.listen(PORT, () => {
  console.log(`Turma do Primo rodando na porta ${PORT}`);
});
