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

async function tabelaExiste(nome) {
  const rows = await database.query(
    `SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
    [nome]
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function contarTabela(nome, where = "1 = 1", params = []) {
  if (!(await tabelaExiste(nome))) return 0;
  const rows = await database.query(`SELECT COUNT(*) AS total FROM \`${nome}\` WHERE ${where}`, params);
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

module.exports = router;
