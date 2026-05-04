const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

const SECRET = process.env.JWT_SECRET || "turma_black_secret_dev";

let usuarios = [
  {
    id: 1,
    email: "admin@turmablack.com",
    senha: "admin123",
    nome: "Administrador",
    tipo: "admin",
    aprovado: true,
    suspenso: false,
    codigo: "999999",
    plano: "Admin",
    dispositivos: [],
    acessos: 0
  }
];

function gerarCodigo() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

app.get("/", (req, res) => {
  res.json({
    status: "online",
    nome: "Turma Black API",
    mensagem: "Backend rodando com sucesso"
  });
});

app.post("/criar", (req, res) => {
  const email = normalizarEmail(req.body.email);
  const senha = String(req.body.senha || "").trim();

  if (!email || !senha) {
    return res.json({ erro: "Preencha e-mail e senha." });
  }

  const existe = usuarios.find(u => u.email === email);

  if (existe) {
    return res.json({ erro: "Esse e-mail já possui cadastro." });
  }

  const codigo = gerarCodigo();

  const novoUsuario = {
    id: Date.now(),
    email,
    senha,
    nome: email.split("@")[0],
    tipo: "aluno",
    aprovado: false,
    suspenso: false,
    codigo,
    plano: "Turma Black",
    dispositivos: [],
    acessos: 0,
    criadoEm: new Date().toISOString()
  };

  usuarios.push(novoUsuario);

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
});

app.post("/login", (req, res) => {
  const email = normalizarEmail(req.body.email);
  const senha = String(req.body.senha || "").trim();

  const user = usuarios.find(u => u.email === email && u.senha === senha);

  if (!user) {
    return res.json({ erro: "E-mail ou senha incorretos." });
  }

  if (user.suspenso) {
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

  const token = jwt.sign(
    {
      id: user.id,
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
      id: user.id,
      email: user.email,
      nome: user.nome,
      tipo: user.tipo,
      plano: user.plano,
      aprovado: user.aprovado,
      suspenso: user.suspenso,
      acessos: user.acessos
    }
  });
});

app.get("/usuarios", (req, res) => {
  res.json({
    sucesso: true,
    usuarios: usuarios.map(u => ({
      id: u.id,
      email: u.email,
      nome: u.nome,
      tipo: u.tipo,
      aprovado: u.aprovado,
      suspenso: u.suspenso,
      codigo: u.codigo,
      plano: u.plano,
      acessos: u.acessos || 0,
      ultimoLogin: u.ultimoLogin || "",
      criadoEm: u.criadoEm || ""
    }))
  });
});

app.post("/aprovar", (req, res) => {
  const codigo = String(req.body.codigo || "").trim();

  const user = usuarios.find(u => u.codigo === codigo);

  if (!user) {
    return res.json({ erro: "Código não encontrado." });
  }

  user.aprovado = true;
  user.suspenso = false;
  user.aprovadoEm = new Date().toISOString();

  res.json({
    sucesso: true,
    mensagem: "Aluno aprovado com sucesso.",
    usuario: {
      email: user.email,
      nome: user.nome,
      codigo: user.codigo
    }
  });
});

app.post("/suspender", (req, res) => {
  const email = normalizarEmail(req.body.email);

  const user = usuarios.find(u => u.email === email);

  if (!user) {
    return res.json({ erro: "Usuário não encontrado." });
  }

  if (user.tipo === "admin") {
    return res.json({ erro: "Não é permitido suspender o admin." });
  }

  user.suspenso = true;

  res.json({
    sucesso: true,
    mensagem: "Usuário suspenso.",
    email: user.email
  });
});

app.post("/reativar", (req, res) => {
  const email = normalizarEmail(req.body.email);

  const user = usuarios.find(u => u.email === email);

  if (!user) {
    return res.json({ erro: "Usuário não encontrado." });
  }

  user.suspenso = false;
  user.aprovado = true;

  res.json({
    sucesso: true,
    mensagem: "Usuário reativado.",
    email: user.email
  });
});

app.delete("/usuario/:email", (req, res) => {
  const email = normalizarEmail(req.params.email);

  const user = usuarios.find(u => u.email === email);

  if (!user) {
    return res.json({ erro: "Usuário não encontrado." });
  }

  if (user.tipo === "admin") {
    return res.json({ erro: "Não é permitido excluir o admin." });
  }

  usuarios = usuarios.filter(u => u.email !== email);

  res.json({
    sucesso: true,
    mensagem: "Usuário excluído.",
    email
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("API Turma Black rodando na porta " + PORT);
});