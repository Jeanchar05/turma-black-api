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

const usuarioSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    senha: { type: String, required: true },
    nome: String,

    tipo: { type: String, default: "aluno" }, // aluno | admin
    plano: { type: String, default: "free" }, // free | premium | admin
    status: { type: String, default: "pendente" }, // pendente | ativo | suspenso | expirado

    aprovado: { type: Boolean, default: false },
    suspenso: { type: Boolean, default: false },

    codigo: String,
    acessos: { type: Number, default: 0 },
    dispositivos: { type: Array, default: [] },

    dataExpiracao: { type: String, default: null },

    ultimoLogin: String,
    criadoEm: String,
    aprovadoEm: String
  },
  { timestamps: true }
);

const Usuario = mongoose.model("Usuario", usuarioSchema);

function gerarCodigo() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function calcularExpirado(user) {
  if (user.tipo === "admin") return false;
  if (user.plano !== "premium") return false;
  if (!user.dataExpiracao) return false;

  return new Date(user.dataExpiracao) < new Date();
}

async function garantirAdmin() {
  const existe = await Usuario.findOne({ email: "admin@turmablack.com" });

  if (!existe) {
    await Usuario.create({
      email: "admin@turmablack.com",
      senha: "admin123",
      nome: "Administrador",
      tipo: "admin",
      plano: "admin",
      status: "ativo",
      aprovado: true,
      suspenso: false,
      codigo: "999999",
      criadoEm: new Date().toISOString()
    });

    console.log("Admin padrão criado.");
  }
}

app.get("/", (req, res) => {
  res.json({
    status: "online",
    nome: "Turma Black API",
    banco: "MongoDB conectado",
    mensagem: "Backend rodando com sucesso"
  });
});

app.post("/criar", async (req, res) => {
  try {
    const email = normalizarEmail(req.body.email);
    const senha = String(req.body.senha || "").trim();
    const nome = String(req.body.nome || email.split("@")[0]).trim();

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
      nome,
      tipo: "aluno",
      plano: "free",
      status: "pendente",
      aprovado: false,
      suspenso: false,
      codigo,
      acessos: 0,
      dispositivos: [],
      dataExpiracao: null,
      criadoEm: new Date().toISOString()
    });

    res.json({
      sucesso: true,
      mensagem: "Conta criada. Aguardando aprovação.",
      codigo,
      usuario: {
        email: novoUsuario.email,
        nome: novoUsuario.nome,
        tipo: novoUsuario.tipo,
        plano: novoUsuario.plano,
        status: novoUsuario.status,
        aprovado: novoUsuario.aprovado
      }
    });
  } catch (error) {
    res.json({ erro: "Erro ao criar conta.", detalhe: error.message });
  }
});

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

    if (calcularExpirado(user)) {
      user.status = "expirado";
      user.plano = "free";
      user.dataExpiracao = null;
      await user.save();
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
      usuario: {
        id: user._id,
        email: user.email,
        nome: user.nome,
        tipo: user.tipo,
        plano: user.plano,
        status: user.status,
        aprovado: user.aprovado,
        suspenso: user.suspenso,
        dataExpiracao: user.dataExpiracao,
        acessos: user.acessos
      }
    });
  } catch (error) {
    res.json({ erro: "Erro ao fazer login.", detalhe: error.message });
  }
});

app.get("/usuarios", async (req, res) => {
  try {
    const usuarios = await Usuario.find().sort({ createdAt: -1 });

    res.json({
      sucesso: true,
      usuarios: usuarios.map((u) => ({
        id: u._id,
        email: u.email,
        nome: u.nome,
        tipo: u.tipo,
        plano: u.plano || "free",
        status: u.status || "pendente",
        aprovado: u.aprovado,
        suspenso: u.suspenso,
        codigo: u.codigo,
        dataExpiracao: u.dataExpiracao || null,
        acessos: u.acessos || 0,
        ultimoLogin: u.ultimoLogin || "",
        criadoEm: u.criadoEm || "",
        aprovadoEm: u.aprovadoEm || "",
        dispositivos: u.dispositivos || []
      }))
    });
  } catch (error) {
    res.json({ erro: "Erro ao buscar usuários.", detalhe: error.message });
  }
});

app.post("/aprovar", async (req, res) => {
  try {
    const codigo = String(req.body.codigo || "").trim();

    const user = await Usuario.findOne({ codigo });

    if (!user) {
      return res.json({ erro: "Código não encontrado." });
    }

    user.aprovado = true;
    user.suspenso = false;
    user.status = "ativo";

    if (!user.plano || user.plano === "Turma Black") {
      user.plano = "free";
    }

    user.aprovadoEm = new Date().toISOString();

    await user.save();

    res.json({
      sucesso: true,
      mensagem: "Aluno aprovado com sucesso.",
      usuario: {
        email: user.email,
        nome: user.nome,
        codigo: user.codigo,
        plano: user.plano,
        status: user.status
      }
    });
  } catch (error) {
    res.json({ erro: "Erro ao aprovar aluno.", detalhe: error.message });
  }
});

app.post("/usuario/plano", async (req, res) => {
  try {
    const email = normalizarEmail(req.body.email);

    const user = await Usuario.findOne({ email });

    if (!user) {
      return res.json({ erro: "Usuário não encontrado." });
    }

    if (user.tipo === "admin") {
      return res.json({ erro: "Não é permitido alterar plano do admin." });
    }

    user.plano = req.body.plano || user.plano || "free";
    user.status = req.body.status || "ativo";
    user.aprovado = req.body.aprovado !== undefined ? req.body.aprovado : true;
    user.suspenso = req.body.suspenso !== undefined ? req.body.suspenso : false;
    user.dataExpiracao = req.body.dataExpiracao || null;

    if (user.plano === "free") {
      user.dataExpiracao = null;
    }

    await user.save();

    res.json({
      sucesso: true,
      mensagem: "Plano atualizado com sucesso.",
      usuario: {
        email: user.email,
        nome: user.nome,
        plano: user.plano,
        status: user.status,
        aprovado: user.aprovado,
        suspenso: user.suspenso,
        dataExpiracao: user.dataExpiracao
      }
    });
  } catch (error) {
    res.json({ erro: "Erro ao atualizar plano.", detalhe: error.message });
  }
});

app.post("/suspender", async (req, res) => {
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
    res.json({ erro: "Erro ao suspender usuário.", detalhe: error.message });
  }
});

app.post("/reativar", async (req, res) => {
  try {
    const email = normalizarEmail(req.body.email);

    const user = await Usuario.findOne({ email });

    if (!user) {
      return res.json({ erro: "Usuário não encontrado." });
    }

    user.suspenso = false;
    user.aprovado = true;

    if (!user.plano) user.plano = "free";
    if (user.plano === "premium") {
      user.status = "ativo";
    } else {
      user.status = "ativo";
      user.dataExpiracao = null;
    }

    await user.save();

    res.json({
      sucesso: true,
      mensagem: "Usuário reativado.",
      email: user.email,
      plano: user.plano,
      status: user.status
    });
  } catch (error) {
    res.json({ erro: "Erro ao reativar usuário.", detalhe: error.message });
  }
});

app.delete("/usuario/:email", async (req, res) => {
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
    res.json({ erro: "Erro ao excluir usuário.", detalhe: error.message });
  }
});

app.listen(PORT, async () => {
  console.log("API Turma Black rodando na porta " + PORT);
  await garantirAdmin();
});