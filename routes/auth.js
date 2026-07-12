const express = require("express");
const Usuario = require("../models/Usuario");

const { auth, gerarToken, montarUsuarioSeguro } = require("../middleware/auth");
const { getPermissoes } = require("../middleware/permissions");

const router = express.Router();

/* ===============================
   HELPERS
=============================== */

function normalizarEmail(email) {
  return String(email || "").toLowerCase().trim();
}

function gerarCodigoAluno() {
  const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numeros = "0123456789";

  let codigo = "TB-";

  for (let i = 0; i < 3; i++) {
    codigo += letras[Math.floor(Math.random() * letras.length)];
  }

  codigo += "-";

  for (let i = 0; i < 4; i++) {
    codigo += numeros[Math.floor(Math.random() * numeros.length)];
  }

  return codigo;
}

function criarAcessosRapidos(usuario) {
  const permissoes = getPermissoes(usuario);

  return {
    dashboard: true,
    painelAdmin: Boolean(permissoes.painelAdmin),
    painelVendas: Boolean(permissoes.painelVendas),
    suporte: Boolean(permissoes.suporte)
  };
}

function respostaUsuario(usuario) {
  const seguro = montarUsuarioSeguro(usuario);

  return {
    ...seguro,
    permissoes: getPermissoes(seguro),
    acessosRapidos: criarAcessosRapidos(seguro)
  };
}

/* ===============================
   CRIAR CONTA
   POST /criar
   Novo fluxo:
   - Conta comum nasce FREE
   - Login liberado imediatamente
   - Código Premium será gerado depois no dashboard-free
=============================== */

async function criarConta(req, res) {
  try {
    const { nome, email, senha, telefone } = req.body;

    const emailNormalizado = normalizarEmail(email);

    if (!nome || !emailNormalizado || !senha) {
      return res.status(400).json({
        erro: "Nome, e-mail e senha são obrigatórios."
      });
    }

    if (String(senha).length < 4) {
      return res.status(400).json({
        erro: "A senha precisa ter pelo menos 4 caracteres."
      });
    }

    const existente = await Usuario.findOne({ email: emailNormalizado });

    if (existente) {
      return res.status(409).json({
        erro: "Já existe uma conta cadastrada com este e-mail."
      });
    }

    const totalUsuarios = await Usuario.countDocuments();
    const primeiroUsuario = totalUsuarios === 0;

    const agora = new Date().toISOString();

    const usuario = await Usuario.create({
      nome: String(nome || "").trim(),
      email: emailNormalizado,
      senha: String(senha),
      telefone: telefone || "",

      tipo: primeiroUsuario ? "admin" : "aluno",
      cargo: primeiroUsuario ? "superadmin" : "aluno",

      vendedor: primeiroUsuario ? true : false,
      comissao: 20,

      aprovado: true,
      suspenso: false,
      status: "ativo",

      codigo: primeiroUsuario ? gerarCodigoAluno() : "",

      plano: primeiroUsuario ? "admin" : "free",
      dataExpiracao: "",

      acessos: 0,
      dispositivos: [],
      ultimoLogin: "",
      aprovadoEm: agora,
      criadoPor: "cadastro-online",
      atualizadoPor: "cadastro-online"
    });

    const usuarioSeguro = respostaUsuario(usuario);

    if (primeiroUsuario) {
      const token = gerarToken(usuario);

      return res.status(201).json({
        sucesso: true,
        mensagem: "Primeiro usuário criado como Super Admin.",
        token,
        usuario: usuarioSeguro
      });
    }

    return res.status(201).json({
      sucesso: true,
      mensagem: "Conta criada com sucesso. Faça login para acessar o plano gratuito.",
      usuario: usuarioSeguro
    });
  } catch (error) {
    console.error("Erro ao criar conta:", error);

    return res.status(500).json({
      erro: "Erro interno ao criar conta."
    });
  }
}

/* ===============================
   LOGIN
   POST /login
=============================== */

async function login(req, res) {
  try {
    const { email, senha } = req.body;

    const emailNormalizado = normalizarEmail(email);

    if (!emailNormalizado || !senha) {
      return res.status(400).json({
        erro: "E-mail e senha são obrigatórios."
      });
    }

    const usuario = await Usuario.findOne({ email: emailNormalizado });

    if (!usuario) {
      return res.status(401).json({
        erro: "E-mail ou senha incorretos."
      });
    }

    if (String(usuario.senha) !== String(senha)) {
      return res.status(401).json({
        erro: "E-mail ou senha incorretos."
      });
    }

    if (usuario.suspenso || usuario.status === "suspenso") {
      return res.status(403).json({
        erro: "Sua conta está suspensa.",
        status: "suspenso"
      });
    }

    if (usuario.status === "bloqueado") {
      return res.status(403).json({
        erro: "Sua conta está bloqueada.",
        status: "bloqueado"
      });
    }

    /*
      Compatibilidade:
      Se existirem contas antigas pendentes/free no banco,
      elas serão liberadas como FREE no primeiro login.
    */
    if (!usuario.aprovado && usuario.plano === "free" && usuario.cargo === "aluno") {
      usuario.aprovado = true;
      usuario.status = "ativo";
      usuario.aprovadoEm = usuario.aprovadoEm || new Date().toISOString();
    }

    /*
      Bloqueia apenas casos antigos realmente pendentes,
      que não sejam conta free/aluno.
    */
    if (!usuario.aprovado && usuario.cargo !== "superadmin") {
      return res.status(403).json({
        erro: "Sua conta ainda está pendente de aprovação.",
        status: "pendente",
        aprovado: false
      });
    }

    usuario.acessos = Number(usuario.acessos || 0) + 1;
    usuario.ultimoLogin = new Date().toISOString();

    if (!usuario.status || usuario.status === "pendente") {
      usuario.status = "ativo";
    }

    if (!usuario.plano) {
      usuario.plano = "free";
    }

    await usuario.save();

    const token = gerarToken(usuario);
    const usuarioSeguro = respostaUsuario(usuario);

    return res.json({
      sucesso: true,
      mensagem: "Login realizado com sucesso.",
      token,
      usuario: usuarioSeguro
    });
  } catch (error) {
    console.error("Erro no login:", error);

    return res.status(500).json({
      erro: "Erro interno ao fazer login."
    });
  }
}

/* ===============================
   ME
   GET /me
=============================== */

async function me(req, res) {
  try {
    const usuario = req.usuarioDoc;

    if (!usuario) {
      return res.status(401).json({
        erro: "Usuário não encontrado."
      });
    }

    return res.json({
      sucesso: true,
      usuario: respostaUsuario(usuario)
    });
  } catch (error) {
    console.error("Erro na rota /me:", error);

    return res.status(500).json({
      erro: "Erro interno ao buscar usuário."
    });
  }
}

/* ===============================
   VALIDAR TOKEN
=============================== */

async function validarToken(req, res) {
  try {
    const usuario = req.usuarioDoc;

    return res.json({
      valido: true,
      usuario: respostaUsuario(usuario)
    });
  } catch (error) {
    return res.status(500).json({
      valido: false,
      erro: "Erro ao validar token."
    });
  }
}

/* ===============================
   LOGOUT
=============================== */

function logout(req, res) {
  return res.json({
    sucesso: true,
    mensagem: "Logout realizado com sucesso."
  });
}

/* ===============================
   ROTAS PRINCIPAIS
=============================== */

router.post("/criar", criarConta);
router.post("/login", login);
router.get("/me", auth, me);
router.get("/validar-token", auth, validarToken);
router.post("/logout", logout);

/* ===============================
   ALIASES /auth
=============================== */

router.post("/auth/criar", criarConta);
router.post("/auth/login", login);
router.get("/auth/me", auth, me);
router.get("/auth/validar-token", auth, validarToken);
router.post("/auth/logout", logout);

/* ===============================
   SETUP SUPER ADMIN
   Rota temporária
=============================== */

router.post("/setup/superadmin", async (req, res) => {
  try {
    const { email, setupKey } = req.body;

    const chaveCorreta =
      process.env.SETUP_SECRET ||
      process.env.JWT_SECRET ||
      "turma_black_secret_dev";

    if (!setupKey || setupKey !== chaveCorreta) {
      return res.status(403).json({
        erro: "Chave de setup inválida."
      });
    }

    const emailNormalizado = normalizarEmail(email);

    if (!emailNormalizado) {
      return res.status(400).json({
        erro: "Informe o e-mail do usuário."
      });
    }

    const usuario = await Usuario.findOne({ email: emailNormalizado });

    if (!usuario) {
      return res.status(404).json({
        erro: "Usuário não encontrado."
      });
    }

    usuario.tipo = "admin";
    usuario.cargo = "superadmin";
    usuario.vendedor = true;
    usuario.comissao = 20;

    usuario.aprovado = true;
    usuario.suspenso = false;
    usuario.status = "ativo";

    usuario.plano = "admin";
    usuario.dataExpiracao = "";

    if (!usuario.codigo) {
      usuario.codigo = gerarCodigoAluno();
    }

    usuario.aprovadoEm = usuario.aprovadoEm || new Date().toISOString();
    usuario.atualizadoPor = "setup-superadmin";

    await usuario.save();

    const token = gerarToken(usuario);
    const usuarioSeguro = respostaUsuario(usuario);

    return res.json({
      sucesso: true,
      mensagem: "Usuário promovido para Super Admin com sucesso.",
      token,
      usuario: usuarioSeguro
    });
  } catch (error) {
    console.error("Erro no setup superadmin:", error);

    return res.status(500).json({
      erro: "Erro interno ao configurar Super Admin."
    });
  }
});

/* ===============================
   HEALTH
=============================== */

router.get("/auth/status", (req, res) => {
  res.json({
    status: "online",
    modulo: "auth",
    fluxo: {
      cadastro: "Conta FREE criada automaticamente",
      premium: "Ativação Premium será feita no dashboard-free",
      login: "Usuário free pode entrar imediatamente"
    },
    rotas: [
      "/criar",
      "/login",
      "/me",
      "/validar-token",
      "/logout",
      "/setup/superadmin"
    ]
  });
});

module.exports = router;
