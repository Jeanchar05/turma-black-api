const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || "turma_black_secret_dev";
const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
  console.error("ERRO: MONGO_URL não configurada no Render.");
  process.exit(1);
}

mongoose
  .connect(MONGO_URL)
  .then(() => console.log("MongoDB conectado com sucesso"))
  .catch((err) => {
    console.error("Erro ao conectar no MongoDB:", err.message);
    process.exit(1);
  });

// ===============================
// SCHEMAS
// ===============================

const usuarioSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    senha: { type: String, required: true },
    nome: String,
    tipo: { type: String, default: "aluno" },
    aprovado: { type: Boolean, default: false },
    suspenso: { type: Boolean, default: false },
    codigo: String,
    plano: { type: String, default: "free" },
    status: { type: String, default: "pendente" },
    dataExpiracao: String,
    acessos: { type: Number, default: 0 },
    dispositivos: { type: Array, default: [] },
    ultimoLogin: String,
    criadoEm: String,
    aprovadoEm: String
  },
  { timestamps: true }
);

const chamadoSchema = new mongoose.Schema(
  {
    aluno: String,
    email: String,
    assunto: String,
    mensagem: String,
    tipo: { type: String, default: "Geral" },
    prioridade: { type: String, default: "Média" },
    status: { type: String, default: "aberto" },
    resposta: { type: String, default: "" },
    criadoEm: String,
    respondidoEm: String,
    fechadoEm: String
  },
  { timestamps: true }
);

const historicoAdminSchema = new mongoose.Schema(
  {
    acao: String,
    adminEmail: String,
    tipo: { type: String, default: "geral" },
    criadoEm: String
  },
  { timestamps: true }
);

const provaResultadoSchema = new mongoose.Schema(
  {
    aluno: String,
    email: String,
    tipoProva: String,
    titulo: String,
    nota: Number,
    acertos: Number,
    erros: Number,
    totalQuestoes: Number,
    percentual: Number,
    criadoEm: String
  },
  { timestamps: true }
);

const Usuario = mongoose.model("Usuario", usuarioSchema);
const Chamado = mongoose.model("Chamado", chamadoSchema);
const HistoricoAdmin = mongoose.model("HistoricoAdmin", historicoAdminSchema);
const ProvaResultado = mongoose.model("ProvaResultado", provaResultadoSchema);

// ===============================
// HELPERS
// ===============================

function gerarCodigo() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function montarUsuario(user) {
  return {
    id: user._id,
    email: user.email,
    nome: user.nome,
    tipo: user.tipo,
    plano: user.plano,
    status: user.status,
    aprovado: user.aprovado,
    suspenso: user.suspenso,
    dataExpiracao: user.dataExpiracao || null,
    acessos: user.acessos || 0,
    ultimoLogin: user.ultimoLogin || "",
    criadoEm: user.criadoEm || user.createdAt || "",
    dispositivos: user.dispositivos || []
  };
}

function autenticar(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ erro: "Token não enviado." });
  }

  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ erro: "Token inválido." });
  }
}

function somenteAdmin(req, res, next) {
  if (!req.user || req.user.tipo !== "admin") {
    return res.status(403).json({ erro: "Acesso restrito ao admin." });
  }

  next();
}

async function garantirAdmin() {
  const admin = await Usuario.findOne({
    email: "admin@turmablack.com"
  });

  if (!admin) {
    await Usuario.create({
      email: "admin@turmablack.com",
      senha: "admin123",
      nome: "Administrador",
      tipo: "admin",
      aprovado: true,
      suspenso: false,
      status: "ativo",
      codigo: "999999",
      plano: "Admin",
      acessos: 0,
      dispositivos: [],
      criadoEm: new Date().toISOString()
    });

    console.log("Admin padrão criado.");
    return;
  }

  admin.tipo = "admin";
  admin.aprovado = true;
  admin.suspenso = false;
  admin.status = "ativo";
  admin.plano = "Admin";

  await admin.save();

  console.log("Admin padrão verificado/atualizado.");
}

// ===============================
// TESTE
// ===============================

app.get("/", (req, res) => {
  res.json({
    status: "online",
    nome: "Turma Black API",
    banco: "MongoDB conectado",
    mensagem: "Backend rodando com sucesso"
  });
});

// ===============================
// CADASTRO
// ===============================

app.post("/criar", async (req, res) => {
  try {
    const email = normalizarEmail(req.body.email);
    const senha = String(req.body.senha || "").trim();

    if (!email || !senha) {
      return res.json({ erro: "Preencha e-mail e senha." });
    }

    const existe = await Usuario.findOne({ email });

    if (existe) {
      return res.json({ erro: "Esse e-mail já possui cadastro." });
    }

    const codigo = gerarCodigo();

    const novoUsuario = await Usuario.create({
      email,
      senha,
      nome: req.body.nome || email.split("@")[0],
      tipo: "aluno",
      aprovado: false,
      suspenso: false,
      status: "pendente",
      codigo,
      plano: "free",
      dataExpiracao: null,
      acessos: 0,
      dispositivos: [],
      criadoEm: new Date().toISOString()
    });

    res.json({
      sucesso: true,
      mensagem: "Conta criada. Aguardando aprovação.",
      codigo,
      usuario: {
        email: novoUsuario.email,
        nome: novoUsuario.nome,
        aprovado: novoUsuario.aprovado
      }
    });
  } catch (error) {
    res.json({
      erro: "Erro ao criar conta.",
      detalhe: error.message
    });
  }
});

// ===============================
// LOGIN
// ===============================

app.post("/login", async (req, res) => {
  try {
    const email = normalizarEmail(req.body.email);
    const senha = String(req.body.senha || "").trim();

    const user = await Usuario.findOne({ email, senha });

    if (!user) {
      return res.json({ erro: "E-mail ou senha incorretos." });
    }

    if (user.suspenso || user.status === "suspenso") {
      return res.json({ erro: "Conta suspensa. Fale com o suporte." });
    }

    if (!user.aprovado) {
      return res.json({
        erro: "Sua conta ainda não foi aprovada.",
        codigo: user.codigo
      });
    }

    user.acessos = Number(user.acessos || 0) + 1;
    user.ultimoLogin = new Date().toISOString();

    await user.save();

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        tipo: user.tipo
      },
      SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      sucesso: true,
      token,
      usuario: montarUsuario(user)
    });
  } catch (error) {
    res.json({
      erro: "Erro ao fazer login.",
      detalhe: error.message
    });
  }
});

// ===============================
// USUÁRIO LOGADO
// ===============================

app.get("/me", autenticar, async (req, res) => {
  try {
    const user = await Usuario.findById(req.user.id).select("-senha");

    if (!user) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    if (user.suspenso || user.status === "suspenso") {
      return res.status(403).json({ erro: "Conta suspensa." });
    }

    res.json({
      sucesso: true,
      usuario: montarUsuario(user)
    });
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao validar usuário.",
      detalhe: error.message
    });
  }
});

// ===============================
// USUÁRIOS ADMIN
// ===============================

app.get("/usuarios", autenticar, somenteAdmin, async (req, res) => {
  try {
    const usuarios = await Usuario.find().sort({ createdAt: -1 });

    res.json({
      sucesso: true,
      usuarios: usuarios.map((u) => ({
        ...montarUsuario(u),
        codigo: u.codigo,
        dataExpiracao: u.dataExpiracao || ""
      }))
    });
  } catch (error) {
    res.json({
      erro: "Erro ao buscar usuários.",
      detalhe: error.message
    });
  }
});

app.post("/aprovar", autenticar, somenteAdmin, async (req, res) => {
  try {
    const codigo = String(req.body.codigo || "").trim();

    const user = await Usuario.findOne({ codigo });

    if (!user) {
      return res.json({ erro: "Código não encontrado." });
    }

    user.aprovado = true;
    user.suspenso = false;
    user.status = "ativo";
    user.aprovadoEm = new Date().toISOString();

    await user.save();

    res.json({
      sucesso: true,
      mensagem: "Aluno aprovado com sucesso.",
      usuario: {
        email: user.email,
        nome: user.nome,
        codigo: user.codigo
      }
    });
  } catch (error) {
    res.json({
      erro: "Erro ao aprovar aluno.",
      detalhe: error.message
    });
  }
});

app.post("/usuario/plano", autenticar, somenteAdmin, async (req, res) => {
  try {
    const email = normalizarEmail(req.body.email);

    const user = await Usuario.findOne({ email });

    if (!user) {
      return res.json({ erro: "Usuário não encontrado." });
    }

    if (user.tipo === "admin") {
      return res.json({ erro: "Não é permitido alterar plano do admin." });
    }

    user.plano = req.body.plano || user.plano;
    user.status = req.body.status || "ativo";
    user.aprovado = req.body.aprovado === undefined ? true : Boolean(req.body.aprovado);
    user.suspenso = req.body.suspenso === undefined ? false : Boolean(req.body.suspenso);
    user.dataExpiracao = req.body.dataExpiracao || null;

    await user.save();

    res.json({
      sucesso: true,
      mensagem: "Plano atualizado com sucesso.",
      usuario: montarUsuario(user)
    });
  } catch (error) {
    res.json({
      erro: "Erro ao atualizar plano.",
      detalhe: error.message
    });
  }
});

app.post("/suspender", autenticar, somenteAdmin, async (req, res) => {
  try {
    const email = normalizarEmail(req.body.email);

    const user = await Usuario.findOne({ email });

    if (!user) {
      return res.json({ erro: "Usuário não encontrado." });
    }

    if (user.tipo === "admin") {
      return res.json({ erro: "Não é permitido suspender o admin." });
    }

    user.suspenso = true;
    user.status = "suspenso";

    await user.save();

    res.json({
      sucesso: true,
      mensagem: "Usuário suspenso.",
      email: user.email
    });
  } catch (error) {
    res.json({
      erro: "Erro ao suspender usuário.",
      detalhe: error.message
    });
  }
});

app.post("/reativar", autenticar, somenteAdmin, async (req, res) => {
  try {
    const email = normalizarEmail(req.body.email);

    const user = await Usuario.findOne({ email });

    if (!user) {
      return res.json({ erro: "Usuário não encontrado." });
    }

    user.suspenso = false;
    user.aprovado = true;
    user.status = "ativo";

    await user.save();

    res.json({
      sucesso: true,
      mensagem: "Usuário reativado.",
      email: user.email
    });
  } catch (error) {
    res.json({
      erro: "Erro ao reativar usuário.",
      detalhe: error.message
    });
  }
});

app.delete("/usuario/:email", autenticar, somenteAdmin, async (req, res) => {
  try {
    const email = normalizarEmail(req.params.email);

    const user = await Usuario.findOne({ email });

    if (!user) {
      return res.json({ erro: "Usuário não encontrado." });
    }

    if (user.tipo === "admin") {
      return res.json({ erro: "Não é permitido excluir o admin." });
    }

    await Usuario.deleteOne({ email });

    res.json({
      sucesso: true,
      mensagem: "Usuário excluído.",
      email
    });
  } catch (error) {
    res.json({
      erro: "Erro ao excluir usuário.",
      detalhe: error.message
    });
  }
});

// ===============================
// SUPORTE
// ===============================

app.post("/suporte", autenticar, async (req, res) => {
  try {
    const assunto = String(req.body.assunto || "").trim();
    const mensagem = String(req.body.mensagem || "").trim();
    const tipo = String(req.body.tipo || "Geral").trim();
    const prioridade = String(req.body.prioridade || "Média").trim();

    if (!assunto || !mensagem) {
      return res.json({ erro: "Preencha assunto e mensagem." });
    }

    const chamado = await Chamado.create({
      aluno: req.body.aluno || req.user.email,
      email: req.user.email,
      assunto,
      mensagem,
      tipo,
      prioridade,
      status: "aberto",
      criadoEm: new Date().toISOString()
    });

    res.json({
      sucesso: true,
      mensagem: "Chamado aberto com sucesso.",
      chamado
    });
  } catch (error) {
    res.json({
      erro: "Erro ao abrir chamado.",
      detalhe: error.message
    });
  }
});

app.get("/suporte", autenticar, somenteAdmin, async (req, res) => {
  try {
    const chamados = await Chamado.find().sort({ createdAt: -1 });

    res.json({
      sucesso: true,
      chamados
    });
  } catch (error) {
    res.json({
      erro: "Erro ao buscar chamados.",
      detalhe: error.message
    });
  }
});

app.get("/meus-chamados", autenticar, async (req, res) => {
  try {
    const chamados = await Chamado.find({ email: req.user.email }).sort({
      createdAt: -1
    });

    res.json({
      sucesso: true,
      chamados
    });
  } catch (error) {
    res.json({
      erro: "Erro ao buscar seus chamados.",
      detalhe: error.message
    });
  }
});

app.post("/suporte/:id/responder", autenticar, somenteAdmin, async (req, res) => {
  try {
    const resposta = String(req.body.resposta || "").trim();

    if (!resposta) {
      return res.json({ erro: "Digite uma resposta." });
    }

    const chamado = await Chamado.findById(req.params.id);

    if (!chamado) {
      return res.json({ erro: "Chamado não encontrado." });
    }

    chamado.resposta = resposta;
    chamado.status = "respondido";
    chamado.respondidoEm = new Date().toISOString();

    await chamado.save();

    res.json({
      sucesso: true,
      mensagem: "Chamado respondido com sucesso.",
      chamado
    });
  } catch (error) {
    res.json({
      erro: "Erro ao responder chamado.",
      detalhe: error.message
    });
  }
});

app.post("/suporte/:id/status", autenticar, somenteAdmin, async (req, res) => {
  try {
    const status = String(req.body.status || "").trim();

    const permitidos = ["aberto", "analise", "respondido", "fechado"];

    if (!permitidos.includes(status)) {
      return res.json({ erro: "Status inválido." });
    }

    const chamado = await Chamado.findById(req.params.id);

    if (!chamado) {
      return res.json({ erro: "Chamado não encontrado." });
    }

    chamado.status = status;

    if (status === "fechado") {
      chamado.fechadoEm = new Date().toISOString();
    }

    await chamado.save();

    res.json({
      sucesso: true,
      mensagem: "Status atualizado.",
      chamado
    });
  } catch (error) {
    res.json({
      erro: "Erro ao atualizar status.",
      detalhe: error.message
    });
  }
});

app.delete("/suporte/:id", autenticar, somenteAdmin, async (req, res) => {
  try {
    const chamado = await Chamado.findById(req.params.id);

    if (!chamado) {
      return res.json({ erro: "Chamado não encontrado." });
    }

    await Chamado.deleteOne({ _id: req.params.id });

    res.json({
      sucesso: true,
      mensagem: "Chamado excluído."
    });
  } catch (error) {
    res.json({
      erro: "Erro ao excluir chamado.",
      detalhe: error.message
    });
  }
});

// ===============================
// HISTÓRICO ADMIN
// ===============================

app.post("/admin/historico", autenticar, somenteAdmin, async (req, res) => {
  try {
    const acao = String(req.body.acao || "").trim();
    const tipo = String(req.body.tipo || "geral").trim();

    if (!acao) {
      return res.json({ erro: "Ação não informada." });
    }

    const registro = await HistoricoAdmin.create({
      acao,
      tipo,
      adminEmail: req.user.email,
      criadoEm: new Date().toISOString()
    });

    res.json({
      sucesso: true,
      registro
    });
  } catch (error) {
    res.json({
      erro: "Erro ao salvar histórico.",
      detalhe: error.message
    });
  }
});

app.get("/admin/historico", autenticar, somenteAdmin, async (req, res) => {
  try {
    const historico = await HistoricoAdmin.find()
      .sort({ createdAt: -1 })
      .limit(150);

    res.json({
      sucesso: true,
      historico
    });
  } catch (error) {
    res.json({
      erro: "Erro ao buscar histórico.",
      detalhe: error.message
    });
  }
});

app.delete("/admin/historico", autenticar, somenteAdmin, async (req, res) => {
  try {
    await HistoricoAdmin.deleteMany({});

    res.json({
      sucesso: true,
      mensagem: "Histórico apagado com sucesso."
    });
  } catch (error) {
    res.json({
      erro: "Erro ao apagar histórico.",
      detalhe: error.message
    });
  }
});

// ===============================
// PROVAS
// ===============================

app.post("/provas/resultado", autenticar, async (req, res) => {
  try {
    const totalQuestoes = Number(req.body.totalQuestoes || 0);
    const acertos = Number(req.body.acertos || 0);
    const erros = Number(req.body.erros || 0);

    if (!req.body.tipoProva || totalQuestoes <= 0) {
      return res.json({ erro: "Dados da prova incompletos." });
    }

    const percentual = Math.round((acertos / totalQuestoes) * 100);

    const resultado = await ProvaResultado.create({
      aluno: req.body.aluno || req.user.email,
      email: req.user.email,
      tipoProva: req.body.tipoProva,
      titulo: req.body.titulo || req.body.tipoProva,
      nota: Number(req.body.nota || percentual),
      acertos,
      erros,
      totalQuestoes,
      percentual,
      criadoEm: new Date().toISOString()
    });

    res.json({
      sucesso: true,
      mensagem: "Resultado salvo com sucesso.",
      resultado
    });
  } catch (error) {
    res.json({
      erro: "Erro ao salvar resultado da prova.",
      detalhe: error.message
    });
  }
});

app.get("/minhas-provas", autenticar, async (req, res) => {
  try {
    const resultados = await ProvaResultado.find({
      email: req.user.email
    })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      sucesso: true,
      resultados
    });
  } catch (error) {
    res.json({
      erro: "Erro ao buscar provas.",
      detalhe: error.message
    });
  }
});

app.get("/admin/provas", autenticar, somenteAdmin, async (req, res) => {
  try {
    const resultados = await ProvaResultado.find()
      .sort({ createdAt: -1 })
      .limit(500);

    res.json({
      sucesso: true,
      resultados
    });
  } catch (error) {
    res.json({
      erro: "Erro ao buscar resultados de provas.",
      detalhe: error.message
    });
  }
});

app.delete("/admin/provas", autenticar, somenteAdmin, async (req, res) => {
  try {
    await ProvaResultado.deleteMany({});

    res.json({
      sucesso: true,
      mensagem: "Registros de provas apagados."
    });
  } catch (error) {
    res.json({
      erro: "Erro ao apagar registros de provas.",
      detalhe: error.message
    });
  }
});

// ===============================
// START
// ===============================

app.listen(PORT, async () => {
  console.log("API Turma Black rodando na porta " + PORT);
  await garantirAdmin();
});