const express = require("express");
const mongoose = require("mongoose");

const Usuario = require("../models/Usuario");

const { auth, montarUsuarioSeguro } = require("../middleware/auth");
const {
  requirePermission,
  requireSuperAdmin,
  requireCargo,
  getPermissoes
} = require("../middleware/permissions");

const router = express.Router();

/* ===============================
   HELPERS
=============================== */

function normalizarEmail(email) {
  return String(email || "").toLowerCase().trim();
}

function hojeISO() {
  return new Date().toISOString();
}

function hojeData() {
  return new Date().toISOString().split("T")[0];
}

function somarDias(dataBase, dias) {
  const data = new Date(`${dataBase}T00:00:00`);
  data.setDate(data.getDate() + Number(dias || 0));
  return data.toISOString().split("T")[0];
}

function diasPorPlano(plano) {
  const mapa = {
    free: 0,
    black30: 30,
    black90: 90,
    black180: 180,
    black360: 360,
    admin: 0
  };

  return mapa[plano] || 30;
}

function normalizarPlano(plano) {
  const valor = String(plano || "").toLowerCase().trim();

  const mapa = {
    free: "free",
    gratis: "free",
    gratuito: "free",

    premium: "black30",
    black: "black30",
    turma_black: "black30",
    turmaBlack: "black30",

    mensal: "black30",
    black30: "black30",

    trimestral: "black90",
    black90: "black90",

    semestral: "black180",
    black180: "black180",

    anual: "black360",
    black360: "black360",

    admin: "admin"
  };

  return mapa[valor] || "black30";
}

function normalizarCargo(cargo) {
  const valor = String(cargo || "").toLowerCase().trim();

  const permitidos = [
    "aluno",
    "vendedor",
    "suporte",
    "moderador",
    "admin",
    "superadmin"
  ];

  if (permitidos.includes(valor)) {
    return valor;
  }

  return "aluno";
}

function limparUsuario(usuario) {
  if (!usuario) return null;

  const seguro = montarUsuarioSeguro(usuario);

  return {
    ...seguro,
    codigo: usuario.codigo || "",
    criadoEm: usuario.criadoEm || usuario.createdAt || "",
    createdAt: usuario.createdAt || "",
    updatedAt: usuario.updatedAt || "",
    aprovadoEm: usuario.aprovadoEm || "",
    ultimoLogin: usuario.ultimoLogin || "",
    permissoes: getPermissoes(seguro)
  };
}

async function buscarUsuarioPorIdentificador(identificador) {
  const valor = String(identificador || "").trim();

  if (!valor) return null;

  if (mongoose.Types.ObjectId.isValid(valor)) {
    const porId = await Usuario.findById(valor);
    if (porId) return porId;
  }

  const email = normalizarEmail(valor);

  if (email.includes("@")) {
    const porEmail = await Usuario.findOne({ email });
    if (porEmail) return porEmail;
  }

  const porCodigo = await Usuario.findOne({
    codigo: valor
  });

  if (porCodigo) return porCodigo;

  return null;
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

/* ===============================
   LISTAR USUÁRIOS
   GET /usuarios
=============================== */

router.get("/usuarios", auth, requirePermission("usuarios"), async (req, res) => {
  try {
    const {
      busca = "",
      status = "",
      cargo = "",
      plano = "",
      aprovado = "",
      limite = 200
    } = req.query;

    const filtro = {};

    if (busca) {
      const termo = String(busca).trim();

      filtro.$or = [
        { nome: { $regex: termo, $options: "i" } },
        { email: { $regex: termo, $options: "i" } },
        { codigo: { $regex: termo, $options: "i" } },
        { telefone: { $regex: termo, $options: "i" } }
      ];
    }

    if (status) {
      filtro.status = status;
    }

    if (cargo) {
      filtro.cargo = cargo;
    }

    if (plano) {
      filtro.plano = plano;
    }

    if (aprovado === "true") {
      filtro.aprovado = true;
    }

    if (aprovado === "false") {
      filtro.aprovado = false;
    }

    const usuarios = await Usuario.find(filtro)
      .sort({ createdAt: -1 })
      .limit(Number(limite) || 200);

    return res.json({
      sucesso: true,
      total: usuarios.length,
      usuarios: usuarios.map(limparUsuario)
    });
  } catch (error) {
    console.error("Erro ao listar usuários:", error);

    return res.status(500).json({
      erro: "Erro interno ao listar usuários."
    });
  }
});

/* ===============================
   RESUMO DE USUÁRIOS
   GET /usuarios/resumo
=============================== */

router.get("/usuarios/resumo", auth, requirePermission("usuarios"), async (req, res) => {
  try {
    const [
      total,
      aprovados,
      pendentes,
      suspensos,
      bloqueados,
      admins,
      vendedores,
      suporte,
      moderadores
    ] = await Promise.all([
      Usuario.countDocuments(),
      Usuario.countDocuments({ aprovado: true }),
      Usuario.countDocuments({ status: "pendente" }),
      Usuario.countDocuments({ status: "suspenso" }),
      Usuario.countDocuments({ status: "bloqueado" }),
      Usuario.countDocuments({ cargo: { $in: ["admin", "superadmin"] } }),
      Usuario.countDocuments({ $or: [{ vendedor: true }, { cargo: "vendedor" }] }),
      Usuario.countDocuments({ cargo: "suporte" }),
      Usuario.countDocuments({ cargo: "moderador" })
    ]);

    return res.json({
      sucesso: true,
      resumo: {
        total,
        aprovados,
        pendentes,
        suspensos,
        bloqueados,
        admins,
        vendedores,
        suporte,
        moderadores
      }
    });
  } catch (error) {
    console.error("Erro ao gerar resumo de usuários:", error);

    return res.status(500).json({
      erro: "Erro interno ao gerar resumo."
    });
  }
});

/* ===============================
   BUSCAR UM USUÁRIO
   GET /usuario/:identificador
=============================== */

router.get("/usuario/:identificador", auth, requirePermission("usuarios"), async (req, res) => {
  try {
    const usuario = await buscarUsuarioPorIdentificador(req.params.identificador);

    if (!usuario) {
      return res.status(404).json({
        erro: "Usuário não encontrado."
      });
    }

    return res.json({
      sucesso: true,
      usuario: limparUsuario(usuario)
    });
  } catch (error) {
    console.error("Erro ao buscar usuário:", error);

    return res.status(500).json({
      erro: "Erro interno ao buscar usuário."
    });
  }
});

/* ===============================
   APROVAR USUÁRIO
   POST /aprovar
=============================== */

router.post("/aprovar", auth, requirePermission("aprovacoes"), async (req, res) => {
  try {
    const { email, id, codigo, plano, dias } = req.body;

    const identificador = email || id || codigo;

    const usuario = await buscarUsuarioPorIdentificador(identificador);

    if (!usuario) {
      return res.status(404).json({
        erro: "Usuário não encontrado."
      });
    }

    const planoFinal = normalizarPlano(plano || usuario.plano || "black30");
    const diasPlano = Number(dias || diasPorPlano(planoFinal));

    usuario.aprovado = true;
    usuario.suspenso = false;
    usuario.status = "ativo";
    usuario.aprovadoEm = hojeISO();

    usuario.plano = planoFinal;

    if (planoFinal !== "free" && planoFinal !== "admin") {
      usuario.dataExpiracao = somarDias(hojeData(), diasPlano);
    }

    if (!usuario.codigo) {
      usuario.codigo = gerarCodigoAluno();
    }

    usuario.atualizadoPor = req.usuario.email;

    await usuario.save();

    return res.json({
      sucesso: true,
      mensagem: "Usuário aprovado com sucesso.",
      usuario: limparUsuario(usuario)
    });
  } catch (error) {
    console.error("Erro ao aprovar usuário:", error);

    return res.status(500).json({
      erro: "Erro interno ao aprovar usuário."
    });
  }
});

/* ===============================
   ALTERAR PLANO
   POST /usuario/plano
=============================== */

router.post("/usuario/plano", auth, requirePermission("planos"), async (req, res) => {
  try {
    const { email, id, codigo, plano, dias } = req.body;

    const usuario = await buscarUsuarioPorIdentificador(email || id || codigo);

    if (!usuario) {
      return res.status(404).json({
        erro: "Usuário não encontrado."
      });
    }

    const planoFinal = normalizarPlano(plano);
    const diasPlano = Number(dias || diasPorPlano(planoFinal));

    usuario.plano = planoFinal;

    if (planoFinal === "free") {
      usuario.dataExpiracao = "";
    } else if (planoFinal === "admin") {
      usuario.dataExpiracao = "";
      usuario.aprovado = true;
      usuario.status = "ativo";
    } else {
      usuario.dataExpiracao = somarDias(hojeData(), diasPlano);
      usuario.aprovado = true;
      usuario.status = "ativo";
    }

    usuario.atualizadoPor = req.usuario.email;

    await usuario.save();

    return res.json({
      sucesso: true,
      mensagem: "Plano atualizado com sucesso.",
      usuario: limparUsuario(usuario)
    });
  } catch (error) {
    console.error("Erro ao alterar plano:", error);

    return res.status(500).json({
      erro: "Erro interno ao alterar plano."
    });
  }
});

/* ===============================
   SUSPENDER USUÁRIO
   POST /suspender
=============================== */

router.post("/suspender", auth, requirePermission("usuarios"), requireCargo("admin"), async (req, res) => {
  try {
    const { email, id, codigo, motivo } = req.body;

    const usuario = await buscarUsuarioPorIdentificador(email || id || codigo);

    if (!usuario) {
      return res.status(404).json({
        erro: "Usuário não encontrado."
      });
    }

    if (usuario.cargo === "superadmin") {
      return res.status(403).json({
        erro: "Não é permitido suspender um Super Admin."
      });
    }

    usuario.suspenso = true;
    usuario.status = "suspenso";
    usuario.atualizadoPor = req.usuario.email;

    if (motivo) {
      usuario.observacaoSuspensao = String(motivo);
    }

    await usuario.save();

    return res.json({
      sucesso: true,
      mensagem: "Usuário suspenso com sucesso.",
      usuario: limparUsuario(usuario)
    });
  } catch (error) {
    console.error("Erro ao suspender usuário:", error);

    return res.status(500).json({
      erro: "Erro interno ao suspender usuário."
    });
  }
});

/* ===============================
   REATIVAR USUÁRIO
   POST /reativar
=============================== */

router.post("/reativar", auth, requirePermission("usuarios"), requireCargo("admin"), async (req, res) => {
  try {
    const { email, id, codigo } = req.body;

    const usuario = await buscarUsuarioPorIdentificador(email || id || codigo);

    if (!usuario) {
      return res.status(404).json({
        erro: "Usuário não encontrado."
      });
    }

    usuario.suspenso = false;
    usuario.status = "ativo";
    usuario.aprovado = true;
    usuario.atualizadoPor = req.usuario.email;

    if (!usuario.aprovadoEm) {
      usuario.aprovadoEm = hojeISO();
    }

    await usuario.save();

    return res.json({
      sucesso: true,
      mensagem: "Usuário reativado com sucesso.",
      usuario: limparUsuario(usuario)
    });
  } catch (error) {
    console.error("Erro ao reativar usuário:", error);

    return res.status(500).json({
      erro: "Erro interno ao reativar usuário."
    });
  }
});

/* ===============================
   BLOQUEAR USUÁRIO
   POST /usuario/bloquear
=============================== */

router.post("/usuario/bloquear", auth, requirePermission("usuarios"), requireCargo("admin"), async (req, res) => {
  try {
    const { email, id, codigo } = req.body;

    const usuario = await buscarUsuarioPorIdentificador(email || id || codigo);

    if (!usuario) {
      return res.status(404).json({
        erro: "Usuário não encontrado."
      });
    }

    if (usuario.cargo === "superadmin") {
      return res.status(403).json({
        erro: "Não é permitido bloquear um Super Admin."
      });
    }

    usuario.status = "bloqueado";
    usuario.suspenso = true;
    usuario.atualizadoPor = req.usuario.email;

    await usuario.save();

    return res.json({
      sucesso: true,
      mensagem: "Usuário bloqueado com sucesso.",
      usuario: limparUsuario(usuario)
    });
  } catch (error) {
    console.error("Erro ao bloquear usuário:", error);

    return res.status(500).json({
      erro: "Erro interno ao bloquear usuário."
    });
  }
});

/* ===============================
   ATUALIZAR USUÁRIO
   PUT /usuario/:identificador
=============================== */

router.put("/usuario/:identificador", auth, requirePermission("usuarios"), requireCargo("admin"), async (req, res) => {
  try {
    const usuario = await buscarUsuarioPorIdentificador(req.params.identificador);

    if (!usuario) {
      return res.status(404).json({
        erro: "Usuário não encontrado."
      });
    }

    const camposPermitidos = [
      "nome",
      "telefone",
      "foto",
      "codigo",
      "status",
      "aprovado",
      "suspenso"
    ];

    camposPermitidos.forEach((campo) => {
      if (req.body[campo] !== undefined) {
        usuario[campo] = req.body[campo];
      }
    });

    usuario.atualizadoPor = req.usuario.email;

    await usuario.save();

    return res.json({
      sucesso: true,
      mensagem: "Usuário atualizado com sucesso.",
      usuario: limparUsuario(usuario)
    });
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);

    return res.status(500).json({
      erro: "Erro interno ao atualizar usuário."
    });
  }
});

/* ===============================
   ALTERAR CARGO
   POST /usuario/cargo
   Somente Super Admin
=============================== */

router.post("/usuario/cargo", auth, requireSuperAdmin, async (req, res) => {
  try {
    const { email, id, codigo, cargo, vendedor, comissao } = req.body;

    const usuario = await buscarUsuarioPorIdentificador(email || id || codigo);

    if (!usuario) {
      return res.status(404).json({
        erro: "Usuário não encontrado."
      });
    }

    const cargoFinal = normalizarCargo(cargo);

    usuario.cargo = cargoFinal;
    usuario.tipo = cargoFinal === "aluno" || cargoFinal === "vendedor" ? "aluno" : "admin";

    if (cargoFinal === "vendedor") {
      usuario.vendedor = true;
    } else if (vendedor !== undefined) {
      usuario.vendedor = Boolean(vendedor);
    }

    if (comissao !== undefined) {
      usuario.comissao = Number(comissao || 20);
    }

    if (cargoFinal !== "aluno") {
      usuario.aprovado = true;
      usuario.status = "ativo";
      usuario.aprovadoEm = usuario.aprovadoEm || hojeISO();
    }

    if (cargoFinal === "admin" || cargoFinal === "superadmin") {
      usuario.plano = "admin";
      usuario.dataExpiracao = "";
    }

    usuario.atualizadoPor = req.usuario.email;

    await usuario.save();

    return res.json({
      sucesso: true,
      mensagem: "Cargo atualizado com sucesso.",
      usuario: limparUsuario(usuario)
    });
  } catch (error) {
    console.error("Erro ao alterar cargo:", error);

    return res.status(500).json({
      erro: "Erro interno ao alterar cargo."
    });
  }
});

/* ===============================
   EXCLUIR USUÁRIO
   DELETE /usuario/:email
=============================== */

router.delete("/usuario/:identificador", auth, requireSuperAdmin, async (req, res) => {
  try {
    const usuario = await buscarUsuarioPorIdentificador(req.params.identificador);

    if (!usuario) {
      return res.status(404).json({
        erro: "Usuário não encontrado."
      });
    }

    if (usuario.cargo === "superadmin") {
      return res.status(403).json({
        erro: "Não é permitido excluir um Super Admin."
      });
    }

    await Usuario.deleteOne({ _id: usuario._id });

    return res.json({
      sucesso: true,
      mensagem: "Usuário excluído com sucesso."
    });
  } catch (error) {
    console.error("Erro ao excluir usuário:", error);

    return res.status(500).json({
      erro: "Erro interno ao excluir usuário."
    });
  }
});

/* ===============================
   STATUS DO MÓDULO
=============================== */

router.get("/usuarios/status", (req, res) => {
  res.json({
    status: "online",
    modulo: "usuarios",
    rotas: [
      "GET /usuarios",
      "GET /usuarios/resumo",
      "GET /usuario/:identificador",
      "POST /aprovar",
      "POST /usuario/plano",
      "POST /suspender",
      "POST /reativar",
      "POST /usuario/bloquear",
      "POST /usuario/cargo",
      "PUT /usuario/:identificador",
      "DELETE /usuario/:identificador"
    ]
  });
});

module.exports = router;
