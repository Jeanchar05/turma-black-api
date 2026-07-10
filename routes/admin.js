const express = require("express");
const mongoose = require("mongoose");

const Usuario = require("../models/Usuario");
const Configuracao = require("../models/Configuracao");

const { auth, montarUsuarioSeguro } = require("../middleware/auth");
const {
  requirePermission,
  requireSuperAdmin,
  getPermissoes,
  getCargo
} = require("../middleware/permissions");

const router = express.Router();

/* ===============================
   HELPERS
=============================== */

function hojeISO() {
  return new Date().toISOString();
}

function normalizarEmail(email) {
  return String(email || "").toLowerCase().trim();
}

function validarId(id) {
  return mongoose.Types.ObjectId.isValid(id);
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

  return "admin";
}

function normalizarStatus(status) {
  const valor = String(status || "").toLowerCase().trim();

  const permitidos = ["pendente", "ativo", "suspenso", "bloqueado"];

  if (permitidos.includes(valor)) {
    return valor;
  }

  return "ativo";
}

function tipoPorCargo(cargo) {
  if (["superadmin", "admin", "moderador", "suporte"].includes(cargo)) {
    return "admin";
  }

  return "aluno";
}

function planoPorCargo(cargo, planoAtual = "free") {
  if (["superadmin", "admin"].includes(cargo)) {
    return "admin";
  }

  return planoAtual || "free";
}

function podeSerVendedor(cargo, vendedor) {
  if (cargo === "vendedor") return true;
  if (vendedor === true) return true;
  if (["superadmin", "admin"].includes(cargo)) return true;

  return false;
}

function gerarCodigoAdmin() {
  const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numeros = "0123456789";

  let codigo = "ADM-";

  for (let i = 0; i < 3; i++) {
    codigo += letras[Math.floor(Math.random() * letras.length)];
  }

  codigo += "-";

  for (let i = 0; i < 4; i++) {
    codigo += numeros[Math.floor(Math.random() * numeros.length)];
  }

  return codigo;
}

async function buscarUsuario(identificador) {
  const valor = String(identificador || "").trim();

  if (!valor) return null;

  if (validarId(valor)) {
    const porId = await Usuario.findById(valor);
    if (porId) return porId;
  }

  const email = normalizarEmail(valor);

  if (email.includes("@")) {
    const porEmail = await Usuario.findOne({ email });
    if (porEmail) return porEmail;
  }

  const porCodigo = await Usuario.findOne({ codigo: valor });

  if (porCodigo) return porCodigo;

  return null;
}

function formatarUsuarioAdmin(usuario) {
  if (!usuario) return null;

  const seguro = montarUsuarioSeguro(usuario);
  const permissoes = getPermissoes(seguro);

  return {
    ...seguro,

    codigo: usuario.codigo || "",

    permissoes,

    acessosRapidos: {
      dashboard: true,
      painelAdmin: Boolean(permissoes.painelAdmin),
      painelVendas: Boolean(permissoes.painelVendas),
      suporte: Boolean(permissoes.suporte)
    },

    criadoPor: usuario.criadoPor || "",
    atualizadoPor: usuario.atualizadoPor || "",

    criadoEm: usuario.criadoEm || usuario.createdAt || "",
    aprovadoEm: usuario.aprovadoEm || "",
    ultimoLogin: usuario.ultimoLogin || "",

    createdAt: usuario.createdAt || "",
    updatedAt: usuario.updatedAt || ""
  };
}

function filtroEquipeAdmin() {
  return {
    cargo: {
      $in: ["superadmin", "admin", "moderador", "suporte", "vendedor"]
    }
  };
}

function filtroVendedores() {
  return {
    $or: [
      { vendedor: true },
      { cargo: "vendedor" },
      { cargo: "admin" },
      { cargo: "superadmin" }
    ]
  };
}

/* ===============================
   RESUMO ADMIN
   GET /admin/resumo
=============================== */

router.get(
  "/resumo",
  auth,
  requirePermission("painelAdmin"),
  async (req, res) => {
    try {
      const [
        totalUsuarios,
        pendentes,
        ativos,
        suspensos,
        bloqueados,
        superadmins,
        admins,
        moderadores,
        suporte,
        vendedores
      ] = await Promise.all([
        Usuario.countDocuments(),
        Usuario.countDocuments({ status: "pendente" }),
        Usuario.countDocuments({ status: "ativo" }),
        Usuario.countDocuments({ status: "suspenso" }),
        Usuario.countDocuments({ status: "bloqueado" }),
        Usuario.countDocuments({ cargo: "superadmin" }),
        Usuario.countDocuments({ cargo: "admin" }),
        Usuario.countDocuments({ cargo: "moderador" }),
        Usuario.countDocuments({ cargo: "suporte" }),
        Usuario.countDocuments(filtroVendedores())
      ]);

      return res.json({
        sucesso: true,
        resumo: {
          totalUsuarios,
          pendentes,
          ativos,
          suspensos,
          bloqueados,
          superadmins,
          admins,
          moderadores,
          suporte,
          vendedores
        }
      });
    } catch (error) {
      console.error("Erro no resumo admin:", error);

      return res.status(500).json({
        erro: "Erro interno ao gerar resumo admin."
      });
    }
  }
);

/* ===============================
   MEU ACESSO ADMIN
   GET /admin/meu-acesso
=============================== */

router.get("/meu-acesso", auth, async (req, res) => {
  try {
    const usuario = req.usuario;
    const permissoes = getPermissoes(usuario);

    return res.json({
      sucesso: true,
      usuario,
      cargo: getCargo(usuario),
      permissoes,
      acessosRapidos: {
        dashboard: true,
        painelAdmin: Boolean(permissoes.painelAdmin),
        painelVendas: Boolean(permissoes.painelVendas),
        suporte: Boolean(permissoes.suporte),
        provas: Boolean(permissoes.provas)
      }
    });
  } catch (error) {
    console.error("Erro ao buscar meu acesso:", error);

    return res.status(500).json({
      erro: "Erro interno ao buscar acesso."
    });
  }
});

/* ===============================
   PERMISSÕES
   GET /admin/permissoes
=============================== */

router.get("/permissoes", auth, requirePermission("painelAdmin"), async (req, res) => {
  try {
    const config = await Configuracao.obterConfiguracao();

    return res.json({
      sucesso: true,
      permissoes: config.permissoes,
      usuarioAtual: {
        cargo: req.usuario.cargo,
        permissoes: getPermissoes(req.usuario)
      }
    });
  } catch (error) {
    console.error("Erro ao buscar permissões:", error);

    return res.status(500).json({
      erro: "Erro interno ao buscar permissões."
    });
  }
});

/* ===============================
   CONTROLE DE ADMINS - RESUMO
   GET /admin/controle-admins/resumo
=============================== */

router.get(
  "/controle-admins/resumo",
  auth,
  requirePermission("controleAdmin"),
  async (req, res) => {
    try {
      const [
        total,
        superadmins,
        admins,
        moderadores,
        suporte,
        vendedores,
        ativos,
        suspensos,
        bloqueados
      ] = await Promise.all([
        Usuario.countDocuments(filtroEquipeAdmin()),
        Usuario.countDocuments({ cargo: "superadmin" }),
        Usuario.countDocuments({ cargo: "admin" }),
        Usuario.countDocuments({ cargo: "moderador" }),
        Usuario.countDocuments({ cargo: "suporte" }),
        Usuario.countDocuments(filtroVendedores()),
        Usuario.countDocuments({ ...filtroEquipeAdmin(), status: "ativo" }),
        Usuario.countDocuments({ ...filtroEquipeAdmin(), status: "suspenso" }),
        Usuario.countDocuments({ ...filtroEquipeAdmin(), status: "bloqueado" })
      ]);

      return res.json({
        sucesso: true,
        resumo: {
          total,
          superadmins,
          admins,
          moderadores,
          suporte,
          vendedores,
          ativos,
          suspensos,
          bloqueados
        }
      });
    } catch (error) {
      console.error("Erro no resumo de controle admins:", error);

      return res.status(500).json({
        erro: "Erro interno ao gerar resumo."
      });
    }
  }
);

/* ===============================
   LISTAR CONTROLE DE ADMINS
   GET /admin/controle-admins
=============================== */

router.get(
  "/controle-admins",
  auth,
  requirePermission("controleAdmin"),
  async (req, res) => {
    try {
      const {
        busca = "",
        cargo = "",
        status = "",
        vendedor = "",
        limite = 300
      } = req.query;

      const filtro = filtroEquipeAdmin();

      if (busca) {
        const termo = String(busca).trim();

        filtro.$or = [
          { nome: { $regex: termo, $options: "i" } },
          { email: { $regex: termo, $options: "i" } },
          { codigo: { $regex: termo, $options: "i" } },
          { telefone: { $regex: termo, $options: "i" } }
        ];
      }

      if (cargo) {
        filtro.cargo = normalizarCargo(cargo);
      }

      if (status) {
        filtro.status = normalizarStatus(status);
      }

      if (vendedor === "true") {
        filtro.vendedor = true;
      }

      if (vendedor === "false") {
        filtro.vendedor = false;
      }

      const usuarios = await Usuario.find(filtro)
        .sort({ createdAt: -1 })
        .limit(Number(limite) || 300);

      return res.json({
        sucesso: true,
        total: usuarios.length,
        admins: usuarios.map(formatarUsuarioAdmin),
        usuarios: usuarios.map(formatarUsuarioAdmin)
      });
    } catch (error) {
      console.error("Erro ao listar controle admins:", error);

      return res.status(500).json({
        erro: "Erro interno ao listar admins."
      });
    }
  }
);

/* ===============================
   BUSCAR ADMIN
   GET /admin/controle-admins/:id
=============================== */

router.get(
  "/controle-admins/:id",
  auth,
  requirePermission("controleAdmin"),
  async (req, res) => {
    try {
      const usuario = await buscarUsuario(req.params.id);

      if (!usuario) {
        return res.status(404).json({
          erro: "Admin não encontrado."
        });
      }

      return res.json({
        sucesso: true,
        admin: formatarUsuarioAdmin(usuario),
        usuario: formatarUsuarioAdmin(usuario)
      });
    } catch (error) {
      console.error("Erro ao buscar admin:", error);

      return res.status(500).json({
        erro: "Erro interno ao buscar admin."
      });
    }
  }
);

/* ===============================
   CRIAR / PROMOVER ADMIN
   POST /admin/controle-admins
=============================== */

router.post(
  "/controle-admins",
  auth,
  requirePermission("controleAdmin"),
  async (req, res) => {
    try {
      const {
        nome = "",
        email,
        senha = "",
        telefone = "",
        cargo = "admin",
        status = "ativo",
        vendedor,
        comissao = 20
      } = req.body;

      const emailNormalizado = normalizarEmail(email);

      if (!emailNormalizado) {
        return res.status(400).json({
          erro: "E-mail é obrigatório."
        });
      }

      const cargoFinal = normalizarCargo(cargo);
      const statusFinal = normalizarStatus(status);

      let usuario = await Usuario.findOne({ email: emailNormalizado });

      if (!usuario) {
        usuario = await Usuario.create({
          nome: nome || emailNormalizado.split("@")[0],
          email: emailNormalizado,
          senha: senha || "123456",
          telefone,

          tipo: tipoPorCargo(cargoFinal),
          cargo: cargoFinal,

          vendedor:
            vendedor !== undefined
              ? Boolean(vendedor)
              : podeSerVendedor(cargoFinal, vendedor),

          comissao: Number(comissao || 20),

          aprovado: true,
          suspenso: statusFinal === "suspenso",
          status: statusFinal,

          codigo: gerarCodigoAdmin(),

          plano: planoPorCargo(cargoFinal, "free"),
          dataExpiracao: "",

          aprovadoEm: hojeISO(),
          criadoPor: req.usuario?.email || "",
          atualizadoPor: req.usuario?.email || ""
        });

        return res.status(201).json({
          sucesso: true,
          mensagem: "Admin criado com sucesso.",
          admin: formatarUsuarioAdmin(usuario),
          usuario: formatarUsuarioAdmin(usuario)
        });
      }

      if (usuario.cargo === "superadmin" && cargoFinal !== "superadmin") {
        return res.status(403).json({
          erro: "Não é permitido rebaixar um Super Admin por esta rota."
        });
      }

      usuario.nome = nome || usuario.nome;
      usuario.telefone = telefone || usuario.telefone;

      if (senha) {
        usuario.senha = String(senha);
      }

      usuario.tipo = tipoPorCargo(cargoFinal);
      usuario.cargo = cargoFinal;

      usuario.vendedor =
        vendedor !== undefined
          ? Boolean(vendedor)
          : podeSerVendedor(cargoFinal, usuario.vendedor);

      usuario.comissao = Number(comissao || usuario.comissao || 20);

      usuario.aprovado = true;
      usuario.suspenso = statusFinal === "suspenso";
      usuario.status = statusFinal;

      usuario.plano = planoPorCargo(cargoFinal, usuario.plano);

      if (!usuario.codigo) {
        usuario.codigo = gerarCodigoAdmin();
      }

      if (!usuario.aprovadoEm) {
        usuario.aprovadoEm = hojeISO();
      }

      usuario.atualizadoPor = req.usuario?.email || "";

      await usuario.save();

      return res.json({
        sucesso: true,
        mensagem: "Usuário promovido/atualizado com sucesso.",
        admin: formatarUsuarioAdmin(usuario),
        usuario: formatarUsuarioAdmin(usuario)
      });
    } catch (error) {
      console.error("Erro ao criar/promover admin:", error);

      return res.status(500).json({
        erro: "Erro interno ao criar/promover admin."
      });
    }
  }
);

/* ===============================
   ATUALIZAR ADMIN
   PUT /admin/controle-admins/:id
=============================== */

router.put(
  "/controle-admins/:id",
  auth,
  requirePermission("controleAdmin"),
  async (req, res) => {
    try {
      const usuario = await buscarUsuario(req.params.id);

      if (!usuario) {
        return res.status(404).json({
          erro: "Admin não encontrado."
        });
      }

      if (usuario.cargo === "superadmin" && req.usuario.cargo !== "superadmin") {
        return res.status(403).json({
          erro: "Somente Super Admin pode alterar outro Super Admin."
        });
      }

      const camposSimples = ["nome", "telefone", "foto", "codigo"];

      camposSimples.forEach((campo) => {
        if (req.body[campo] !== undefined) {
          usuario[campo] = req.body[campo];
        }
      });

      if (req.body.senha) {
        usuario.senha = String(req.body.senha);
      }

      if (req.body.cargo !== undefined) {
        const cargoFinal = normalizarCargo(req.body.cargo);

        if (usuario.cargo === "superadmin" && cargoFinal !== "superadmin") {
          return res.status(403).json({
            erro: "Não é permitido rebaixar um Super Admin."
          });
        }

        usuario.cargo = cargoFinal;
        usuario.tipo = tipoPorCargo(cargoFinal);
        usuario.plano = planoPorCargo(cargoFinal, usuario.plano);
      }

      if (req.body.status !== undefined) {
        const statusFinal = normalizarStatus(req.body.status);

        usuario.status = statusFinal;
        usuario.suspenso = statusFinal === "suspenso";
      }

      if (req.body.vendedor !== undefined) {
        usuario.vendedor = Boolean(req.body.vendedor);
      }

      if (req.body.comissao !== undefined) {
        usuario.comissao = Number(req.body.comissao || 20);
      }

      usuario.aprovado = true;

      if (!usuario.aprovadoEm) {
        usuario.aprovadoEm = hojeISO();
      }

      usuario.atualizadoPor = req.usuario?.email || "";

      await usuario.save();

      return res.json({
        sucesso: true,
        mensagem: "Admin atualizado com sucesso.",
        admin: formatarUsuarioAdmin(usuario),
        usuario: formatarUsuarioAdmin(usuario)
      });
    } catch (error) {
      console.error("Erro ao atualizar admin:", error);

      return res.status(500).json({
        erro: "Erro interno ao atualizar admin."
      });
    }
  }
);

/* ===============================
   ALTERAR CARGO
   POST /admin/controle-admins/:id/cargo
=============================== */

router.post(
  "/controle-admins/:id/cargo",
  auth,
  requirePermission("controleAdmin"),
  async (req, res) => {
    try {
      const usuario = await buscarUsuario(req.params.id);

      if (!usuario) {
        return res.status(404).json({
          erro: "Usuário não encontrado."
        });
      }

      const cargoFinal = normalizarCargo(req.body.cargo);

      if (usuario.cargo === "superadmin" && cargoFinal !== "superadmin") {
        return res.status(403).json({
          erro: "Não é permitido rebaixar um Super Admin."
        });
      }

      usuario.cargo = cargoFinal;
      usuario.tipo = tipoPorCargo(cargoFinal);
      usuario.plano = planoPorCargo(cargoFinal, usuario.plano);

      usuario.aprovado = true;
      usuario.status = "ativo";
      usuario.suspenso = false;

      if (cargoFinal === "vendedor") {
        usuario.vendedor = true;
      }

      if (["admin", "superadmin"].includes(cargoFinal)) {
        usuario.vendedor = true;
      }

      if (!usuario.aprovadoEm) {
        usuario.aprovadoEm = hojeISO();
      }

      usuario.atualizadoPor = req.usuario?.email || "";

      await usuario.save();

      return res.json({
        sucesso: true,
        mensagem: "Cargo atualizado com sucesso.",
        admin: formatarUsuarioAdmin(usuario),
        usuario: formatarUsuarioAdmin(usuario)
      });
    } catch (error) {
      console.error("Erro ao alterar cargo:", error);

      return res.status(500).json({
        erro: "Erro interno ao alterar cargo."
      });
    }
  }
);

/* ===============================
   ALTERAR STATUS ADMIN
   POST /admin/controle-admins/:id/status
=============================== */

router.post(
  "/controle-admins/:id/status",
  auth,
  requirePermission("controleAdmin"),
  async (req, res) => {
    try {
      const usuario = await buscarUsuario(req.params.id);

      if (!usuario) {
        return res.status(404).json({
          erro: "Usuário não encontrado."
        });
      }

      if (usuario.cargo === "superadmin") {
        return res.status(403).json({
          erro: "Não é permitido alterar status de um Super Admin por esta rota."
        });
      }

      const statusFinal = normalizarStatus(req.body.status);

      usuario.status = statusFinal;
      usuario.suspenso = statusFinal === "suspenso";
      usuario.atualizadoPor = req.usuario?.email || "";

      await usuario.save();

      return res.json({
        sucesso: true,
        mensagem: "Status atualizado com sucesso.",
        admin: formatarUsuarioAdmin(usuario),
        usuario: formatarUsuarioAdmin(usuario)
      });
    } catch (error) {
      console.error("Erro ao alterar status admin:", error);

      return res.status(500).json({
        erro: "Erro interno ao alterar status."
      });
    }
  }
);

/* ===============================
   REMOVER ACESSO ADMIN
   DELETE /admin/controle-admins/:id
=============================== */

router.delete(
  "/controle-admins/:id",
  auth,
  requirePermission("controleAdmin"),
  async (req, res) => {
    try {
      const usuario = await buscarUsuario(req.params.id);

      if (!usuario) {
        return res.status(404).json({
          erro: "Usuário não encontrado."
        });
      }

      if (usuario.cargo === "superadmin") {
        return res.status(403).json({
          erro: "Não é permitido remover acesso de um Super Admin."
        });
      }

      usuario.cargo = "aluno";
      usuario.tipo = "aluno";
      usuario.vendedor = false;
      usuario.comissao = 20;
      usuario.plano = usuario.plano === "admin" ? "free" : usuario.plano;
      usuario.atualizadoPor = req.usuario?.email || "";

      await usuario.save();

      return res.json({
        sucesso: true,
        mensagem: "Acesso administrativo removido com sucesso.",
        usuario: formatarUsuarioAdmin(usuario)
      });
    } catch (error) {
      console.error("Erro ao remover acesso admin:", error);

      return res.status(500).json({
        erro: "Erro interno ao remover acesso admin."
      });
    }
  }
);

/* ===============================
   LISTAR VENDEDORES
   GET /admin/vendedores
=============================== */

router.get(
  "/vendedores",
  auth,
  requirePermission("vendedores"),
  async (req, res) => {
    try {
      const {
        busca = "",
        status = "",
        limite = 300
      } = req.query;

      const filtro = filtroVendedores();

      if (busca) {
        const termo = String(busca).trim();

        filtro.$and = [
          {
            $or: [
              { nome: { $regex: termo, $options: "i" } },
              { email: { $regex: termo, $options: "i" } },
              { telefone: { $regex: termo, $options: "i" } }
            ]
          }
        ];
      }

      if (status) {
        filtro.status = normalizarStatus(status);
      }

      const vendedores = await Usuario.find(filtro)
        .sort({ createdAt: -1 })
        .limit(Number(limite) || 300);

      return res.json({
        sucesso: true,
        total: vendedores.length,
        vendedores: vendedores.map(formatarUsuarioAdmin)
      });
    } catch (error) {
      console.error("Erro ao listar vendedores:", error);

      return res.status(500).json({
        erro: "Erro interno ao listar vendedores."
      });
    }
  }
);

/* ===============================
   RESUMO VENDEDORES
   GET /admin/vendedores/resumo
=============================== */

router.get(
  "/vendedores/resumo",
  auth,
  requirePermission("vendedores"),
  async (req, res) => {
    try {
      const [
        total,
        ativos,
        suspensos,
        bloqueados,
        cargoVendedor,
        adminsVendedores
      ] = await Promise.all([
        Usuario.countDocuments(filtroVendedores()),
        Usuario.countDocuments({ ...filtroVendedores(), status: "ativo" }),
        Usuario.countDocuments({ ...filtroVendedores(), status: "suspenso" }),
        Usuario.countDocuments({ ...filtroVendedores(), status: "bloqueado" }),
        Usuario.countDocuments({ cargo: "vendedor" }),
        Usuario.countDocuments({
          cargo: { $in: ["admin", "superadmin"] },
          vendedor: true
        })
      ]);

      return res.json({
        sucesso: true,
        resumo: {
          total,
          ativos,
          suspensos,
          bloqueados,
          cargoVendedor,
          adminsVendedores,
          comissaoPadrao: 20
        }
      });
    } catch (error) {
      console.error("Erro no resumo vendedores:", error);

      return res.status(500).json({
        erro: "Erro interno ao gerar resumo de vendedores."
      });
    }
  }
);

/* ===============================
   SINCRONIZAR VENDEDORES
   POST /admin/vendedores/sincronizar
   POST /admin/controle-admins/sincronizar-vendedores
=============================== */

async function sincronizarVendedores(req, res) {
  try {
    const resultado = await Usuario.updateMany(
      {
        cargo: {
          $in: ["superadmin", "admin", "vendedor"]
        }
      },
      {
        $set: {
          vendedor: true,
          comissao: 20,
          atualizadoPor: req.usuario?.email || ""
        }
      }
    );

    const vendedores = await Usuario.find(filtroVendedores()).sort({ nome: 1 });

    return res.json({
      sucesso: true,
      mensagem: "Vendedores sincronizados com sucesso.",
      modificados: resultado.modifiedCount || 0,
      total: vendedores.length,
      vendedores: vendedores.map(formatarUsuarioAdmin)
    });
  } catch (error) {
    console.error("Erro ao sincronizar vendedores:", error);

    return res.status(500).json({
      erro: "Erro interno ao sincronizar vendedores."
    });
  }
}

router.post(
  "/vendedores/sincronizar",
  auth,
  requirePermission("vendedores"),
  sincronizarVendedores
);

router.post(
  "/controle-admins/sincronizar-vendedores",
  auth,
  requirePermission("controleAdmin"),
  sincronizarVendedores
);

/* ===============================
   ATUALIZAR COMISSÃO DO VENDEDOR
   POST /admin/vendedores/:id/comissao
=============================== */

router.post(
  "/vendedores/:id/comissao",
  auth,
  requirePermission("vendedores"),
  async (req, res) => {
    try {
      const vendedor = await buscarUsuario(req.params.id);

      if (!vendedor) {
        return res.status(404).json({
          erro: "Vendedor não encontrado."
        });
      }

      vendedor.vendedor = true;
      vendedor.comissao = Number(req.body.comissao || 20);
      vendedor.atualizadoPor = req.usuario?.email || "";

      await vendedor.save();

      return res.json({
        sucesso: true,
        mensagem: "Comissão atualizada com sucesso.",
        vendedor: formatarUsuarioAdmin(vendedor)
      });
    } catch (error) {
      console.error("Erro ao atualizar comissão:", error);

      return res.status(500).json({
        erro: "Erro interno ao atualizar comissão."
      });
    }
  }
);

/* ===============================
   ATIVAR / DESATIVAR VENDEDOR
   POST /admin/vendedores/:id/status
=============================== */

router.post(
  "/vendedores/:id/status",
  auth,
  requirePermission("vendedores"),
  async (req, res) => {
    try {
      const vendedor = await buscarUsuario(req.params.id);

      if (!vendedor) {
        return res.status(404).json({
          erro: "Vendedor não encontrado."
        });
      }

      const { ativo } = req.body;

      vendedor.vendedor = Boolean(ativo);
      vendedor.atualizadoPor = req.usuario?.email || "";

      await vendedor.save();

      return res.json({
        sucesso: true,
        mensagem: vendedor.vendedor
          ? "Vendedor ativado com sucesso."
          : "Vendedor desativado com sucesso.",
        vendedor: formatarUsuarioAdmin(vendedor)
      });
    } catch (error) {
      console.error("Erro ao alterar status vendedor:", error);

      return res.status(500).json({
        erro: "Erro interno ao alterar vendedor."
      });
    }
  }
);

/* ===============================
   CONFIGURAÇÃO DO SISTEMA
   GET /admin/configuracao
=============================== */

router.get(
  "/configuracao",
  auth,
  requirePermission("painelAdmin"),
  async (req, res) => {
    try {
      const config = await Configuracao.obterConfiguracao();

      return res.json({
        sucesso: true,
        configuracao: config
      });
    } catch (error) {
      console.error("Erro ao buscar configuração:", error);

      return res.status(500).json({
        erro: "Erro interno ao buscar configuração."
      });
    }
  }
);

/* ===============================
   ATUALIZAR CONFIGURAÇÃO
   PUT /admin/configuracao
=============================== */

router.put(
  "/configuracao",
  auth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const config = await Configuracao.obterConfiguracao();

      const camposPermitidos = [
        "nomeSistema",
        "nomePremium",
        "versao",
        "ambiente",
        "temaPadrao",
        "modoManutencao",
        "manutencaoTitulo",
        "manutencaoMensagem",
        "previsaoRetorno",
        "comissaoPadrao",
        "moeda",
        "planos",
        "vendas",
        "notificacoes",
        "seguranca",
        "links"
      ];

      camposPermitidos.forEach((campo) => {
        if (req.body[campo] !== undefined) {
          config[campo] = req.body[campo];
        }
      });

      config.atualizadoPor = req.usuario?.email || "";

      await config.save();

      return res.json({
        sucesso: true,
        mensagem: "Configuração atualizada com sucesso.",
        configuracao: config
      });
    } catch (error) {
      console.error("Erro ao atualizar configuração:", error);

      return res.status(500).json({
        erro: "Erro interno ao atualizar configuração."
      });
    }
  }
);

/* ===============================
   MANUTENÇÃO
=============================== */

router.post("/manutencao/ativar", auth, requireSuperAdmin, async (req, res) => {
  try {
    const config = await Configuracao.obterConfiguracao();

    await config.ativarManutencao({
      titulo: req.body.titulo,
      mensagem: req.body.mensagem,
      previsaoRetorno: req.body.previsaoRetorno,
      atualizadoPor: req.usuario?.email || ""
    });

    return res.json({
      sucesso: true,
      mensagem: "Modo manutenção ativado.",
      configuracao: config
    });
  } catch (error) {
    console.error("Erro ao ativar manutenção:", error);

    return res.status(500).json({
      erro: "Erro interno ao ativar manutenção."
    });
  }
});

router.post("/manutencao/desativar", auth, requireSuperAdmin, async (req, res) => {
  try {
    const config = await Configuracao.obterConfiguracao();

    await config.desativarManutencao(req.usuario?.email || "");

    return res.json({
      sucesso: true,
      mensagem: "Modo manutenção desativado.",
      configuracao: config
    });
  } catch (error) {
    console.error("Erro ao desativar manutenção:", error);

    return res.status(500).json({
      erro: "Erro interno ao desativar manutenção."
    });
  }
});

/* ===============================
   STATUS DO MÓDULO
=============================== */

router.get("/status", (req, res) => {
  res.json({
    status: "online",
    modulo: "admin",
    base: "/admin",
    rotas: [
      "GET /admin/resumo",
      "GET /admin/meu-acesso",
      "GET /admin/permissoes",

      "GET /admin/controle-admins",
      "GET /admin/controle-admins/resumo",
      "GET /admin/controle-admins/:id",
      "POST /admin/controle-admins",
      "PUT /admin/controle-admins/:id",
      "POST /admin/controle-admins/:id/cargo",
      "POST /admin/controle-admins/:id/status",
      "DELETE /admin/controle-admins/:id",

      "GET /admin/vendedores",
      "GET /admin/vendedores/resumo",
      "POST /admin/vendedores/sincronizar",
      "POST /admin/vendedores/:id/comissao",
      "POST /admin/vendedores/:id/status",

      "GET /admin/configuracao",
      "PUT /admin/configuracao",
      "POST /admin/manutencao/ativar",
      "POST /admin/manutencao/desativar"
    ]
  });
});

module.exports = router;
