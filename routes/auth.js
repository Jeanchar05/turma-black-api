const express = require("express");
const Usuario = require("../models/Usuario");

const { auth, gerarToken, montarUsuarioSeguro } = require("../middleware/auth");
const { getPermissoesEfetivas, getCargo } = require("../middleware/permissions");

const router = express.Router();

function normalizarEmail(email) {
  return String(email || "").toLowerCase().trim();
}

function gerarCodigoAluno() {
  const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numeros = "0123456789";
  let codigo = "TB-";

  for (let i = 0; i < 3; i += 1) {
    codigo += letras[Math.floor(Math.random() * letras.length)];
  }

  codigo += "-";

  for (let i = 0; i < 4; i += 1) {
    codigo += numeros[Math.floor(Math.random() * numeros.length)];
  }

  return codigo;
}

async function respostaUsuario(usuario) {
  const seguro = montarUsuarioSeguro(usuario);
  const permissoes = await getPermissoesEfetivas(usuario);

  return {
    ...seguro,
    cargo: getCargo(usuario),
    permissoes,
    acessosRapidos: {
      dashboard: Boolean(permissoes.dashboard),
      painelAdmin: Boolean(permissoes.painelAdmin),
      painelVendas: Boolean(permissoes.painelVendas),
      financas: Boolean(permissoes.financas),
      suporte: Boolean(permissoes.suporte),
      permissoesSistema: Boolean(permissoes.permissoesSistema)
    }
  };
}

async function criarConta(req, res) {
  try {
    const { nome, email, senha, telefone } = req.body;
    const emailNormalizado = normalizarEmail(email);

    if (!nome || !emailNormalizado || !senha) {
      return res.status(400).json({ erro: "Nome, e-mail e senha são obrigatórios." });
    }

    if (String(senha).length < 6) {
      return res.status(400).json({ erro: "A senha precisa ter pelo menos 6 caracteres." });
    }

    if (await Usuario.exists({ email: emailNormalizado })) {
      return res.status(409).json({ erro: "Já existe uma conta cadastrada com este e-mail." });
    }

    const agora = new Date().toISOString();
    const usuario = await Usuario.create({
      nome: String(nome).trim(),
      email: emailNormalizado,
      senha: String(senha),
      telefone: telefone || "",
      tipo: "aluno",
      cargo: "aluno",
      contaDev: false,
      permissoesPersonalizadas: {},
      vendedor: false,
      comissao: 20,
      aprovado: true,
      suspenso: false,
      status: "ativo",
      codigo: "",
      plano: "free",
      dataExpiracao: "",
      acessos: 0,
      dispositivos: [],
      ultimoLogin: "",
      aprovadoEm: agora,
      criadoPor: "cadastro-online",
      atualizadoPor: "cadastro-online"
    });

    return res.status(201).json({
      sucesso: true,
      mensagem: "Conta criada com sucesso. Faça login para acessar o plano gratuito.",
      usuario: await respostaUsuario(usuario)
    });
  } catch (error) {
    console.error("Erro ao criar conta:", error);
    return res.status(500).json({ erro: "Erro interno ao criar conta." });
  }
}

async function login(req, res) {
  try {
    const email = normalizarEmail(req.body?.email);
    const senha = String(req.body?.senha || "");

    if (!email || !senha) {
      return res.status(400).json({ erro: "E-mail e senha são obrigatórios." });
    }

    const usuario = await Usuario.findOne({ email });

    if (!usuario || String(usuario.senha) !== senha) {
      return res.status(401).json({ erro: "E-mail ou senha incorretos." });
    }

    if (usuario.suspenso || usuario.status === "suspenso") {
      return res.status(403).json({ erro: "Sua conta está suspensa.", status: "suspenso" });
    }

    if (usuario.status === "bloqueado") {
      return res.status(403).json({ erro: "Sua conta está bloqueada.", status: "bloqueado" });
    }

    if (!usuario.aprovado && usuario.plano === "free" && usuario.cargo === "aluno") {
      usuario.aprovado = true;
      usuario.status = "ativo";
      usuario.aprovadoEm = usuario.aprovadoEm || new Date().toISOString();
    }

    if (!usuario.aprovado && !usuario.contaDev) {
      return res.status(403).json({
        erro: "Sua conta ainda está pendente de aprovação.",
        status: "pendente",
        aprovado: false
      });
    }

    usuario.acessos = Number(usuario.acessos || 0) + 1;
    usuario.ultimoLogin = new Date().toISOString();
    usuario.status = usuario.status === "pendente" ? "ativo" : usuario.status;
    usuario.plano = usuario.plano || "free";
    await usuario.save({ validateModifiedOnly: true });

    const token = gerarToken(usuario);

    return res.json({
      sucesso: true,
      mensagem: "Login realizado com sucesso.",
      token,
      usuario: await respostaUsuario(usuario)
    });
  } catch (error) {
    console.error("Erro no login:", error);
    return res.status(500).json({ erro: "Erro interno ao fazer login." });
  }
}

async function me(req, res) {
  try {
    if (!req.usuarioDoc) {
      return res.status(401).json({ erro: "Usuário não encontrado." });
    }

    return res.json({
      sucesso: true,
      usuario: await respostaUsuario(req.usuarioDoc)
    });
  } catch (error) {
    console.error("Erro na rota /me:", error);
    return res.status(500).json({ erro: "Erro interno ao buscar usuário." });
  }
}

async function validarToken(req, res) {
  try {
    return res.json({
      valido: true,
      usuario: await respostaUsuario(req.usuarioDoc)
    });
  } catch (_) {
    return res.status(500).json({ valido: false, erro: "Erro ao validar token." });
  }
}

function logout(req, res) {
  return res.json({ sucesso: true, mensagem: "Logout realizado com sucesso." });
}

router.post("/criar", criarConta);
router.post("/login", login);
router.get("/me", auth, me);
router.get("/validar-token", auth, validarToken);
router.post("/logout", logout);

router.post("/auth/criar", criarConta);
router.post("/auth/login", login);
router.get("/auth/me", auth, me);
router.get("/auth/validar-token", auth, validarToken);
router.post("/auth/logout", logout);

router.post("/setup/superadmin", async (req, res) => {
  try {
    const chaveCorreta =
      process.env.SETUP_SECRET ||
      process.env.JWT_SECRET ||
      "turma_black_secret_dev";

    if (!req.body?.setupKey || req.body.setupKey !== chaveCorreta) {
      return res.status(403).json({ erro: "Chave de setup inválida." });
    }

    const email = normalizarEmail(req.body?.email);
    const usuario = await Usuario.findOne({ email });

    if (!usuario) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    usuario.tipo = "admin";
    usuario.cargo = "dono";
    usuario.contaDev = false;
    usuario.vendedor = true;
    usuario.aprovado = true;
    usuario.suspenso = false;
    usuario.status = "ativo";
    usuario.plano = "admin";
    usuario.dataExpiracao = "";
    usuario.codigo = usuario.codigo || gerarCodigoAluno();
    usuario.aprovadoEm = usuario.aprovadoEm || new Date().toISOString();
    usuario.atualizadoPor = "setup-dono";
    await usuario.save();

    const token = gerarToken(usuario);

    return res.json({
      sucesso: true,
      mensagem: "Usuário promovido para Dono com sucesso.",
      token,
      usuario: await respostaUsuario(usuario)
    });
  } catch (error) {
    console.error("Erro no setup dono:", error);
    return res.status(500).json({ erro: "Erro interno ao configurar Dono." });
  }
});

router.get("/auth/status", (req, res) => {
  res.json({
    status: "online",
    modulo: "auth",
    fluxo: {
      cadastro: "Conta FREE criada automaticamente",
      premium: "Código gerado no dashboard-free e aprovado no painel admin",
      login: "Permissões efetivas carregadas por cargo"
    }
  });
});

module.exports = router;
