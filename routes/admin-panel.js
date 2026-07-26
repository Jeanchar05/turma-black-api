const express = require("express");
const mongoose = require("mongoose");

const Usuario = require("../models/Usuario");
const Venda = require("../models/Venda");
const SolicitacaoLiberacao = require("../models/SolicitacaoLiberacao");
const PermissaoSistema = require("../models/PermissaoSistema");

const { auth, montarUsuarioSeguro } = require("../middleware/auth");
const {
  CARGOS,
  CHAVES_PERMISSAO,
  PERMISSOES_PADRAO,
  getCargo,
  getPermissoesEfetivas,
  sanitizarPermissoes,
  requirePermission,
  requireDev
} = require("../middleware/permissions");

const router = express.Router();

const CARGOS_GERENCIAVEIS = ["dono", "admin", "financeiro", "vendedor"];
const PLANOS_DIAS = {
  black30: 30,
  black90: 90,
  black180: 180,
  black360: 360
};

function validarId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizarCargoEquipe(cargo) {
  const valor = String(cargo || "").trim().toLowerCase();
  return CARGOS_GERENCIAVEIS.includes(valor) ? valor : "vendedor";
}

function cargoParaTipo(cargo) {
  return cargo === "aluno" ? "aluno" : "admin";
}

function cargoPodeGerenciarCargo(cargoAtual, cargoAlvo) {
  if (cargoAtual === CARGOS.DEV) return cargoAlvo !== CARGOS.DEV;
  if (cargoAtual === CARGOS.DONO || cargoAtual === CARGOS.SUPERADMIN) {
    return ![CARGOS.DEV].includes(cargoAlvo);
  }
  if (cargoAtual === CARGOS.ADMIN) {
    return [CARGOS.ADMIN, CARGOS.FINANCEIRO, CARGOS.VENDEDOR].includes(cargoAlvo);
  }
  return false;
}

function formatarUsuario(usuario) {
  if (!usuario) return null;
  const seguro = montarUsuarioSeguro(usuario);
  return {
    ...seguro,
    codigo: usuario.codigo || "",
    createdAt: usuario.createdAt || "",
    updatedAt: usuario.updatedAt || "",
    ultimoLogin: usuario.ultimoLogin || "",
    aprovadoEm: usuario.aprovadoEm || ""
  };
}

function somarDias(dias) {
  const data = new Date();
  data.setDate(data.getDate() + Number(dias || 30));
  return data.toISOString().split("T")[0];
}

router.get(
  "/painel/contexto",
  auth,
  requirePermission("painelAdmin"),
  async (req, res) => {
    try {
      const permissoes = await getPermissoesEfetivas(req.usuarioDoc || req.usuario);
      const cargo = getCargo(req.usuarioDoc || req.usuario);

      const [
        totalUsuarios,
        alunosAtivos,
        alunosPendentes,
        codigosPendentes,
        equipeAtiva,
        totalVendas,
        ultimosUsuarios,
        ultimasLiberacoes
      ] = await Promise.all([
        Usuario.countDocuments({ contaDev: { $ne: true } }),
        Usuario.countDocuments({ cargo: "aluno", status: "ativo" }),
        Usuario.countDocuments({ cargo: "aluno", status: "pendente" }),
        SolicitacaoLiberacao.countDocuments({ status: "pendente" }),
        Usuario.countDocuments({
          cargo: { $in: ["dono", "admin", "financeiro", "vendedor"] },
          status: "ativo"
        }),
        Venda.countDocuments(),
        Usuario.find({ contaDev: { $ne: true } })
          .sort({ createdAt: -1 })
          .limit(8)
          .lean(),
        SolicitacaoLiberacao.find()
          .sort({ createdAt: -1 })
          .limit(6)
          .lean()
      ]);

      return res.json({
        sucesso: true,
        usuario: formatarUsuario(req.usuarioDoc),
        cargo,
        permissoes,
        centralDev: cargo === CARGOS.DEV,
        resumo: {
          totalUsuarios,
          alunosAtivos,
          alunosPendentes,
          codigosPendentes,
          equipeAtiva,
          totalVendas
        },
        ultimosUsuarios: ultimosUsuarios.map(formatarUsuario),
        ultimasLiberacoes
      });
    } catch (error) {
      console.error("Erro no contexto do painel admin:", error);
      return res.status(500).json({ erro: "Erro interno ao carregar painel administrativo." });
    }
  }
);

router.get(
  "/liberacoes/resumo",
  auth,
  requirePermission("aprovacoes"),
  async (req, res) => {
    try {
      const [pendentes, aprovadas, recusadas, total] = await Promise.all([
        SolicitacaoLiberacao.countDocuments({ status: "pendente" }),
        SolicitacaoLiberacao.countDocuments({ status: "aprovado" }),
        SolicitacaoLiberacao.countDocuments({ status: "recusado" }),
        SolicitacaoLiberacao.countDocuments()
      ]);

      return res.json({ sucesso: true, resumo: { pendentes, aprovadas, recusadas, total } });
    } catch (error) {
      console.error("Erro no resumo de liberações:", error);
      return res.status(500).json({ erro: "Erro interno ao gerar resumo de liberações." });
    }
  }
);

router.get(
  "/liberacoes",
  auth,
  requirePermission("aprovacoes"),
  async (req, res) => {
    try {
      const { status = "", busca = "", limite = 150 } = req.query;
      const filtro = {};

      if (["pendente", "aprovado", "recusado", "cancelado"].includes(status)) {
        filtro.status = status;
      }

      if (busca) {
        const termo = String(busca).trim();
        filtro.$or = [
          { codigo: { $regex: termo, $options: "i" } },
          { nome: { $regex: termo, $options: "i" } },
          { email: { $regex: termo, $options: "i" } }
        ];
      }

      const solicitacoes = await SolicitacaoLiberacao.find(filtro)
        .sort({ createdAt: -1 })
        .limit(Math.min(Number(limite) || 150, 500));

      return res.json({ sucesso: true, total: solicitacoes.length, solicitacoes });
    } catch (error) {
      console.error("Erro ao listar liberações:", error);
      return res.status(500).json({ erro: "Erro interno ao listar liberações." });
    }
  }
);

router.post(
  "/liberacoes/:id/aprovar",
  auth,
  requirePermission("aprovacoes"),
  async (req, res) => {
    try {
      if (!validarId(req.params.id)) {
        return res.status(400).json({ erro: "Solicitação inválida." });
      }

      const solicitacao = await SolicitacaoLiberacao.findById(req.params.id);

      if (!solicitacao) {
        return res.status(404).json({ erro: "Solicitação não encontrada." });
      }

      if (solicitacao.status !== "pendente") {
        return res.status(409).json({ erro: "Esta solicitação já foi analisada." });
      }

      const usuario = await Usuario.findById(solicitacao.usuarioId);

      if (!usuario) {
        return res.status(404).json({ erro: "Conta vinculada não encontrada." });
      }

      const plano = PLANOS_DIAS[solicitacao.plano] ? solicitacao.plano : "black30";
      const dias = Number(req.body?.dias || PLANOS_DIAS[plano]);

      usuario.plano = plano;
      usuario.dataExpiracao = somarDias(dias);
      usuario.aprovado = true;
      usuario.suspenso = false;
      usuario.status = "ativo";
      usuario.codigo = solicitacao.codigo;
      usuario.aprovadoEm = new Date().toISOString();
      usuario.atualizadoPor = req.usuario.email;
      await usuario.save();

      solicitacao.status = "aprovado";
      solicitacao.analisadoEm = new Date();
      solicitacao.analisadoPor = req.usuario.email;
      solicitacao.motivoRecusa = "";
      await solicitacao.save();

      return res.json({
        sucesso: true,
        mensagem: "Código aprovado e plano Premium liberado.",
        solicitacao,
        usuario: formatarUsuario(usuario)
      });
    } catch (error) {
      console.error("Erro ao aprovar liberação:", error);
      return res.status(500).json({ erro: "Erro interno ao aprovar liberação." });
    }
  }
);

router.post(
  "/liberacoes/:id/recusar",
  auth,
  requirePermission("aprovacoes"),
  async (req, res) => {
    try {
      if (!validarId(req.params.id)) {
        return res.status(400).json({ erro: "Solicitação inválida." });
      }

      const solicitacao = await SolicitacaoLiberacao.findById(req.params.id);

      if (!solicitacao) {
        return res.status(404).json({ erro: "Solicitação não encontrada." });
      }

      if (solicitacao.status !== "pendente") {
        return res.status(409).json({ erro: "Esta solicitação já foi analisada." });
      }

      solicitacao.status = "recusado";
      solicitacao.analisadoEm = new Date();
      solicitacao.analisadoPor = req.usuario.email;
      solicitacao.motivoRecusa = String(req.body?.motivo || "Pagamento não confirmado.").trim();
      await solicitacao.save();

      return res.json({
        sucesso: true,
        mensagem: "Solicitação recusada.",
        solicitacao
      });
    } catch (error) {
      console.error("Erro ao recusar liberação:", error);
      return res.status(500).json({ erro: "Erro interno ao recusar liberação." });
    }
  }
);

router.get(
  "/equipe",
  auth,
  requirePermission("equipe"),
  async (req, res) => {
    try {
      const usuarios = await Usuario.find({
        cargo: { $in: CARGOS_GERENCIAVEIS },
        contaDev: { $ne: true }
      })
        .sort({ createdAt: -1 })
        .limit(300);

      return res.json({
        sucesso: true,
        total: usuarios.length,
        equipe: usuarios.map(formatarUsuario)
      });
    } catch (error) {
      console.error("Erro ao listar equipe:", error);
      return res.status(500).json({ erro: "Erro interno ao listar equipe." });
    }
  }
);

router.post(
  "/equipe",
  auth,
  requirePermission("equipe"),
  async (req, res) => {
    try {
      const cargoAtual = getCargo(req.usuarioDoc || req.usuario);
      const cargo = normalizarCargoEquipe(req.body?.cargo);

      if (!cargoPodeGerenciarCargo(cargoAtual, cargo)) {
        return res.status(403).json({ erro: "Você não pode criar este cargo." });
      }

      const email = normalizarEmail(req.body?.email);
      const senha = String(req.body?.senha || "");

      if (!email || !senha || senha.length < 6) {
        return res.status(400).json({ erro: "Informe e-mail e senha com pelo menos 6 caracteres." });
      }

      if (await Usuario.exists({ email })) {
        return res.status(409).json({ erro: "Já existe uma conta com este e-mail." });
      }

      const usuario = await Usuario.create({
        nome: String(req.body?.nome || email.split("@")[0]).trim(),
        email,
        senha,
        telefone: String(req.body?.telefone || "").trim(),
        tipo: cargoParaTipo(cargo),
        cargo,
        contaDev: false,
        vendedor: ["dono", "admin", "financeiro", "vendedor"].includes(cargo),
        comissao: Number(req.body?.comissao || 20),
        aprovado: true,
        suspenso: false,
        status: "ativo",
        plano: "admin",
        aprovadoEm: new Date().toISOString(),
        criadoPor: req.usuario.email,
        atualizadoPor: req.usuario.email
      });

      return res.status(201).json({
        sucesso: true,
        mensagem: "Conta da equipe criada com sucesso.",
        usuario: formatarUsuario(usuario)
      });
    } catch (error) {
      console.error("Erro ao criar membro da equipe:", error);
      return res.status(500).json({ erro: "Erro interno ao criar membro da equipe." });
    }
  }
);

router.patch(
  "/equipe/:id",
  auth,
  requirePermission("equipe"),
  async (req, res) => {
    try {
      if (!validarId(req.params.id)) {
        return res.status(400).json({ erro: "Conta inválida." });
      }

      const usuario = await Usuario.findById(req.params.id);

      if (!usuario || usuario.contaDev) {
        return res.status(404).json({ erro: "Conta da equipe não encontrada." });
      }

      const cargoAtual = getCargo(req.usuarioDoc || req.usuario);
      const cargoFinal = req.body?.cargo
        ? normalizarCargoEquipe(req.body.cargo)
        : usuario.cargo;

      if (!cargoPodeGerenciarCargo(cargoAtual, usuario.cargo) || !cargoPodeGerenciarCargo(cargoAtual, cargoFinal)) {
        return res.status(403).json({ erro: "Você não pode alterar esta conta." });
      }

      if (req.body?.nome !== undefined) usuario.nome = String(req.body.nome).trim();
      if (req.body?.telefone !== undefined) usuario.telefone = String(req.body.telefone).trim();
      if (req.body?.senha) usuario.senha = String(req.body.senha);
      if (req.body?.comissao !== undefined) usuario.comissao = Number(req.body.comissao || 20);

      if (req.body?.status !== undefined) {
        const status = ["ativo", "suspenso", "bloqueado"].includes(req.body.status)
          ? req.body.status
          : "ativo";
        usuario.status = status;
        usuario.suspenso = status === "suspenso";
      }

      usuario.cargo = cargoFinal;
      usuario.tipo = cargoParaTipo(cargoFinal);
      usuario.vendedor = ["dono", "admin", "financeiro", "vendedor"].includes(cargoFinal);
      usuario.plano = "admin";
      usuario.atualizadoPor = req.usuario.email;
      await usuario.save();

      return res.json({
        sucesso: true,
        mensagem: "Conta atualizada com sucesso.",
        usuario: formatarUsuario(usuario)
      });
    } catch (error) {
      console.error("Erro ao atualizar equipe:", error);
      return res.status(500).json({ erro: "Erro interno ao atualizar equipe." });
    }
  }
);

router.get("/dev/permissoes", auth, requireDev, async (req, res) => {
  try {
    const registro = await PermissaoSistema.obter();
    const matriz = {};

    ["dono", "admin", "financeiro", "vendedor"].forEach((cargo) => {
      matriz[cargo] = {
        ...(PERMISSOES_PADRAO[cargo] || {}),
        ...sanitizarPermissoes(registro.matriz?.[cargo] || {})
      };
    });

    const contas = await Usuario.find({ contaDev: { $ne: true } })
      .select("nome email cargo status permissoesPersonalizadas")
      .sort({ nome: 1 })
      .limit(500)
      .lean();

    return res.json({
      sucesso: true,
      chaves: CHAVES_PERMISSAO,
      matriz,
      contas,
      atualizadoPor: registro.atualizadoPor || "",
      updatedAt: registro.updatedAt || ""
    });
  } catch (error) {
    console.error("Erro ao carregar Central Dev:", error);
    return res.status(500).json({ erro: "Erro interno ao carregar Central Dev." });
  }
});

router.put("/dev/permissoes/:cargo", auth, requireDev, async (req, res) => {
  try {
    const cargo = String(req.params.cargo || "").toLowerCase();

    if (!["dono", "admin", "financeiro", "vendedor"].includes(cargo)) {
      return res.status(400).json({ erro: "Cargo inválido para configuração." });
    }

    const registro = await PermissaoSistema.obter();
    const anterior = registro.matriz?.[cargo] || {};
    const novas = sanitizarPermissoes(req.body?.permissoes || {});

    registro.matriz = {
      ...(registro.matriz || {}),
      [cargo]: novas
    };

    registro.historico.push({
      tipo: "cargo",
      cargo,
      anterior,
      novo: novas,
      alteradoPor: req.usuario.email,
      data: new Date().toISOString()
    });

    registro.historico = registro.historico.slice(-100);
    registro.atualizadoPor = req.usuario.email;
    registro.markModified("matriz");
    registro.markModified("historico");
    await registro.save();

    return res.json({
      sucesso: true,
      mensagem: `Permissões de ${cargo} atualizadas.`,
      permissoes: {
        ...(PERMISSOES_PADRAO[cargo] || {}),
        ...novas
      }
    });
  } catch (error) {
    console.error("Erro ao atualizar matriz de permissões:", error);
    return res.status(500).json({ erro: "Erro interno ao atualizar permissões." });
  }
});

router.put("/dev/usuarios/:id/permissoes", auth, requireDev, async (req, res) => {
  try {
    if (!validarId(req.params.id)) {
      return res.status(400).json({ erro: "Conta inválida." });
    }

    const usuario = await Usuario.findById(req.params.id);

    if (!usuario || usuario.contaDev) {
      return res.status(404).json({ erro: "Conta não encontrada." });
    }

    usuario.permissoesPersonalizadas = sanitizarPermissoes(
      req.body?.permissoes || {}
    );
    usuario.atualizadoPor = req.usuario.email;
    usuario.markModified("permissoesPersonalizadas");
    await usuario.save();

    return res.json({
      sucesso: true,
      mensagem: "Permissões individuais atualizadas.",
      usuario: formatarUsuario(usuario),
      permissoes: await getPermissoesEfetivas(usuario)
    });
  } catch (error) {
    console.error("Erro ao atualizar permissões individuais:", error);
    return res.status(500).json({ erro: "Erro interno ao atualizar permissões individuais." });
  }
});

module.exports = router;
