"use strict";

const express = require("express");

const database = require("../config/database");
const Usuario = require("../models/Usuario");
const { auth, montarUsuarioSeguro } = require("../middleware/auth");
const {
  CARGOS,
  getCargo,
  getPermissoesEfetivas,
  requirePermission
} = require("../middleware/permissions");

const router = express.Router();

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

function normalizarDias(valor, padrao = 7) {
  const numero = Number(valor || padrao);
  return Math.min(Math.max(Number.isFinite(numero) ? numero : padrao, 7), 90);
}

function dataSql(data) {
  return new Date(data).toISOString().slice(0, 19).replace("T", " ");
}

function chaveData(data) {
  return new Date(data).toISOString().slice(0, 10);
}

function criarSerieVazia(dias) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const serie = [];

  for (let i = dias - 1; i >= 0; i -= 1) {
    const data = new Date(hoje);
    data.setDate(data.getDate() - i);
    serie.push({
      data: chaveData(data),
      rotulo: new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit"
      }).format(data),
      vendas: 0,
      faturamento: 0
    });
  }

  return serie;
}

async function tabelaExiste(nome) {
  const rows = await database.query(
    `SELECT COUNT(*) AS total
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?`,
    [nome]
  );

  return Number(rows[0]?.total || 0) > 0;
}

async function contarTabela(nome, where = "1 = 1", params = []) {
  if (!(await tabelaExiste(nome))) return 0;

  const rows = await database.query(
    `SELECT COUNT(*) AS total FROM \`${nome}\` WHERE ${where}`,
    params
  );

  return Number(rows[0]?.total || 0);
}

async function listarUltimosUsuarios(limite = 8) {
  const usuarios = await Usuario.find({ contaDev: { $ne: true } })
    .sort({ createdAt: -1 })
    .limit(limite)
    .lean();

  return usuarios.map(formatarUsuario);
}

router.get(
  "/painel/contexto",
  auth,
  requirePermission("painelAdmin"),
  async (req, res) => {
    try {
      const usuarioAtual = req.usuarioDoc || req.usuario;
      const permissoes = await getPermissoesEfetivas(usuarioAtual);
      const cargo = getCargo(usuarioAtual);

      const [
        totalUsuarios,
        alunosAtivos,
        alunosPendentes,
        equipeAtiva,
        ultimosUsuarios,
        codigosPendentes,
        totalVendas
      ] = await Promise.all([
        Usuario.countDocuments({ contaDev: { $ne: true } }),
        Usuario.countDocuments({ cargo: "aluno", status: "ativo" }),
        Usuario.countDocuments({ cargo: "aluno", status: "pendente" }),
        Usuario.countDocuments({
          cargo: { $in: ["dono", "admin", "financeiro", "vendedor", "moderador", "suporte"] },
          status: "ativo"
        }),
        listarUltimosUsuarios(8),
        contarTabela("solicitacoes_liberacao", "status = ?", ["pendente"]),
        contarTabela("vendas")
      ]);

      return res.json({
        sucesso: true,
        origem: "mysql",
        usuario: formatarUsuario(usuarioAtual),
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
        ultimosUsuarios,
        ultimasLiberacoes: []
      });
    } catch (error) {
      console.error("Erro MySQL no contexto do painel admin:", error);
      return res.status(500).json({
        erro: "Erro interno ao carregar painel administrativo.",
        codigo: "ADMIN_MYSQL_CONTEXT_ERROR"
      });
    }
  }
);

router.get(
  "/dashboard/visao-geral",
  auth,
  requirePermission("painelAdmin"),
  async (req, res) => {
    try {
      const dias = normalizarDias(req.query?.dias, 7);
      const agora = new Date();
      const inicioMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1);
      const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
      const fimMesAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59, 999);

      const [
        totalUsuarios,
        usuariosMes,
        usuariosMesAnterior,
        freeAtivos,
        premiumAtivos,
        codigosPendentes,
        chamadosAbertos,
        provasAtivas,
        ultimosUsuarios
      ] = await Promise.all([
        Usuario.countDocuments({ contaDev: { $ne: true } }),
        database.query(
          "SELECT COUNT(*) AS total FROM usuarios WHERE conta_dev = 0 AND created_at >= ?",
          [dataSql(inicioMesAtual)]
        ).then((rows) => Number(rows[0]?.total || 0)),
        database.query(
          "SELECT COUNT(*) AS total FROM usuarios WHERE conta_dev = 0 AND created_at BETWEEN ? AND ?",
          [dataSql(inicioMesAnterior), dataSql(fimMesAnterior)]
        ).then((rows) => Number(rows[0]?.total || 0)),
        Usuario.countDocuments({ cargo: "aluno", plano: "free", status: "ativo" }),
        Usuario.countDocuments({
          cargo: "aluno",
          plano: { $nin: ["free", "admin"] },
          status: "ativo"
        }),
        contarTabela("solicitacoes_liberacao", "status = ?", ["pendente"]),
        contarTabela("chamados", "status IN (?, ?, ?)", ["aberto", "em_atendimento", "respondido"]),
        contarTabela("provas", "status = ?", ["ativa"]),
        listarUltimosUsuarios(10)
      ]);

      const crescimentoUsuarios = usuariosMesAnterior
        ? Number((((usuariosMes - usuariosMesAnterior) / usuariosMesAnterior) * 100).toFixed(1))
        : usuariosMes > 0
          ? 100
          : 0;

      const conversao = totalUsuarios > 0
        ? Number(((premiumAtivos / totalUsuarios) * 100).toFixed(2))
        : 0;

      const atividades = ultimosUsuarios.map((usuario) => ({
        tipo: "usuario",
        icone: "♙",
        titulo: "Novo usuário cadastrado",
        descricao: `${usuario.nome || "Usuário"} • ${usuario.email || ""}`,
        createdAt: usuario.createdAt || new Date().toISOString(),
        status: usuario.status || "ativo"
      }));

      const alertas = [];
      if (codigosPendentes > 0) {
        alertas.push({
          tipo: "warning",
          titulo: `${codigosPendentes} código(s) aguardando aprovação`,
          descricao: "Confira os pagamentos e libere os acessos Premium.",
          destino: "approvals"
        });
      }

      return res.json({
        sucesso: true,
        origem: "mysql",
        periodo: {
          dias,
          inicio: new Date(Date.now() - (dias - 1) * 86400000).toISOString(),
          fim: agora.toISOString()
        },
        indicadores: {
          totalUsuarios,
          usuariosMes,
          crescimentoUsuarios,
          freeAtivos,
          premiumAtivos,
          vendasMes: 0,
          crescimentoVendas: 0,
          faturamentoMes: 0,
          crescimentoFaturamento: 0,
          conversao,
          codigosPendentes,
          chamadosAbertos,
          provasAtivas
        },
        serieVendas: criarSerieVazia(dias),
        atividades,
        alertas,
        topPlanos: [],
        funil: [
          { etapa: "Contas cadastradas", total: totalUsuarios },
          { etapa: "Usuários Free ativos", total: freeAtivos },
          { etapa: "Solicitações pendentes", total: codigosPendentes },
          { etapa: "Premium ativos", total: premiumAtivos }
        ]
      });
    } catch (error) {
      console.error("Erro MySQL na visão geral do painel:", error);
      return res.status(500).json({
        erro: "Erro interno ao carregar a visão geral.",
        codigo: "ADMIN_MYSQL_OVERVIEW_ERROR"
      });
    }
  }
);

module.exports = router;
