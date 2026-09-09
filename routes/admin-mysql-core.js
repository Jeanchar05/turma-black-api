"use strict";

const express = require("express");
const database = require("../config/database");
const Usuario = require("../models/Usuario");
const { auth, montarUsuarioSeguro } = require("../middleware/auth");
const { CARGOS, getCargo, getPermissoesEfetivas, requirePermission } = require("../middleware/permissions");

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

function numero(value) {
  const result = Number(value || 0);
  return Number.isFinite(result) ? result : 0;
}

function percentual(atual, anterior) {
  const a = numero(atual), b = numero(anterior);
  if (!b) return a > 0 ? 100 : 0;
  return Number((((a - b) / b) * 100).toFixed(1));
}

function dataSql(data) {
  return new Date(data).toISOString().slice(0, 19).replace("T", " ");
}

function dataChave(data) {
  return new Date(data).toISOString().slice(0, 10);
}

async function tabelaExiste(nome) {
  const rows = await database.query(
    `SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
    [nome]
  );
  return numero(rows[0]?.total) > 0;
}

async function contarTabela(nome, where = "1 = 1", params = []) {
  if (!(await tabelaExiste(nome))) return 0;
  const rows = await database.query(`SELECT COUNT(*) AS total FROM \`${nome}\` WHERE ${where}`, params);
  return numero(rows[0]?.total);
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

      const [totalUsuarios, alunosAtivos, alunosPendentes, equipeAtiva, ultimosUsuarios, codigosPendentes, totalVendas] = await Promise.all([
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

// Compatibilidade para o frontend administrativo legado. A nova Visão Geral
// usa /admin/command-center/overview, porém os módulos antigos ainda consultam
// este endpoint. Mantemos uma resposta MySQL real e leve para evitar timeouts.
router.get(
  "/dashboard/visao-geral",
  auth,
  requirePermission("painelAdmin"),
  async (req, res) => {
    try {
      const dias = Math.min(Math.max(Number(req.query?.dias || 7), 7), 90);
      const agora = new Date();
      const inicioAtual = new Date(agora.getFullYear(), agora.getMonth(), 1);
      const inicioAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
      const fimAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59, 999);
      const inicioSerie = new Date(Date.now() - (dias - 1) * 86400000);
      inicioSerie.setHours(0, 0, 0, 0);

      const [totalUsuarios, freeAtivos, premiumAtivos, usuariosMesRows, usuariosAnteriorRows, codigosPendentes, chamadosAbertos, provasAtivas] = await Promise.all([
        Usuario.countDocuments({ contaDev: { $ne: true } }),
        Usuario.countDocuments({ cargo: "aluno", status: "ativo", plano: "free" }),
        Usuario.countDocuments({ cargo: "aluno", status: "ativo", plano: { $nin: ["free", "admin"] } }),
        database.query("SELECT COUNT(*) AS total FROM usuarios WHERE conta_dev=0 AND created_at >= ?", [dataSql(inicioAtual)]),
        database.query("SELECT COUNT(*) AS total FROM usuarios WHERE conta_dev=0 AND created_at BETWEEN ? AND ?", [dataSql(inicioAnterior), dataSql(fimAnterior)]),
        contarTabela("solicitacoes_liberacao", "status='pendente'"),
        contarTabela("support_tickets", "status IN ('aberto','em_atendimento','respondido')"),
        contarTabela("provas_resultados", "status IN ('pendente','em_analise')")
      ]);

      const serie = new Map();
      for (let i = dias - 1; i >= 0; i -= 1) {
        const data = new Date();
        data.setHours(0, 0, 0, 0);
        data.setDate(data.getDate() - i);
        const chave = dataChave(data);
        serie.set(chave, { data: chave, rotulo: `${chave.slice(8,10)}/${chave.slice(5,7)}`, vendas: 0, faturamento: 0 });
      }

      let vendasMes = 0, faturamentoMes = 0, vendasAnterior = 0, faturamentoAnterior = 0, topPlanos = [];
      if (await tabelaExiste("vendas")) {
        const [atualRows, anteriorRows, serieRows, planosRows] = await Promise.all([
          database.query("SELECT SUM(status='pago') AS pagas,COALESCE(SUM(CASE WHEN status='pago' THEN valor ELSE 0 END),0) AS faturamento FROM vendas WHERE data_venda >= ?", [dataChave(inicioAtual)]),
          database.query("SELECT SUM(status='pago') AS pagas,COALESCE(SUM(CASE WHEN status='pago' THEN valor ELSE 0 END),0) AS faturamento FROM vendas WHERE data_venda BETWEEN ? AND ?", [dataChave(inicioAnterior), dataChave(fimAnterior)]),
          database.query("SELECT data_venda AS data,SUM(status='pago') AS vendas,COALESCE(SUM(CASE WHEN status='pago' THEN valor ELSE 0 END),0) AS faturamento FROM vendas WHERE data_venda >= ? GROUP BY data_venda ORDER BY data_venda", [dataChave(inicioSerie)]),
          database.query("SELECT produto_codigo AS plano,COUNT(*) AS vendas,COALESCE(SUM(valor),0) AS faturamento FROM vendas WHERE status='pago' GROUP BY produto_codigo ORDER BY faturamento DESC LIMIT 5")
        ]);
        vendasMes = numero(atualRows[0]?.pagas);
        faturamentoMes = numero(atualRows[0]?.faturamento);
        vendasAnterior = numero(anteriorRows[0]?.pagas);
        faturamentoAnterior = numero(anteriorRows[0]?.faturamento);
        serieRows.forEach((row) => {
          const chave = dataChave(row.data);
          if (serie.has(chave)) serie.set(chave, { ...serie.get(chave), vendas: numero(row.vendas), faturamento: Number(numero(row.faturamento).toFixed(2)) });
        });
        topPlanos = planosRows.map((row, index) => ({ posicao: index + 1, plano: row.plano || "", vendas: numero(row.vendas), faturamento: Number(numero(row.faturamento).toFixed(2)) }));
      }

      const alertas = [];
      if (codigosPendentes) alertas.push({ tipo: "warning", titulo: `${codigosPendentes} aprovação(ões) pendente(s)`, descricao: "Revise as liberações Premium.", destino: "approvals" });
      if (chamadosAbertos) alertas.push({ tipo: "danger", titulo: `${chamadosAbertos} chamado(s) aberto(s)`, descricao: "Acompanhe a fila de suporte.", destino: "support" });

      return res.json({
        sucesso: true,
        origem: "mysql",
        periodo: { dias, inicio: inicioSerie, fim: agora },
        indicadores: {
          totalUsuarios: numero(totalUsuarios),
          usuariosMes: numero(usuariosMesRows[0]?.total),
          crescimentoUsuarios: percentual(usuariosMesRows[0]?.total, usuariosAnteriorRows[0]?.total),
          freeAtivos: numero(freeAtivos),
          premiumAtivos: numero(premiumAtivos),
          vendasMes,
          crescimentoVendas: percentual(vendasMes, vendasAnterior),
          faturamentoMes: Number(faturamentoMes.toFixed(2)),
          crescimentoFaturamento: percentual(faturamentoMes, faturamentoAnterior),
          conversao: numero(totalUsuarios) ? Number(((numero(premiumAtivos) / numero(totalUsuarios)) * 100).toFixed(2)) : 0,
          codigosPendentes,
          chamadosAbertos,
          provasAtivas
        },
        serieVendas: Array.from(serie.values()),
        atividades: [],
        alertas,
        topPlanos,
        funil: [
          { etapa: "Contas cadastradas", total: numero(totalUsuarios) },
          { etapa: "Usuários Free ativos", total: numero(freeAtivos) },
          { etapa: "Solicitações pendentes", total: codigosPendentes },
          { etapa: "Premium ativos", total: numero(premiumAtivos) }
        ]
      });
    } catch (error) {
      console.error("Erro MySQL na visão geral compatível:", error);
      return res.status(500).json({ erro: "Erro interno ao carregar a visão geral." });
    }
  }
);

module.exports = router;
