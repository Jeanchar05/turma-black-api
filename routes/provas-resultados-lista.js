const express = require("express");
const mongoose = require("mongoose");

const Prova = require("../models/Prova");
const ProvaResultado = require("../models/ProvaResultado");
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

const router = express.Router();

router.get(
  "/admin/provas/resultados-v2",
  auth,
  requirePermission("provas"),
  async (req, res) => {
    try {
      const {
        busca = "",
        status = "",
        limite = 300
      } = req.query;

      const filtro = {};

      if (status) {
        filtro.status = String(status).trim();
      }

      if (busca) {
        const termo = String(busca).trim();
        filtro.$or = [
          { usuarioNome: { $regex: termo, $options: "i" } },
          { usuarioEmail: { $regex: termo, $options: "i" } },
          { provaTitulo: { $regex: termo, $options: "i" } }
        ];
      }

      const resultados = await ProvaResultado.find(filtro)
        .sort({ createdAt: -1 })
        .limit(Math.min(Math.max(Number(limite) || 300, 1), 500))
        .lean();

      const idsProvas = [
        ...new Set(
          resultados
            .map((item) => String(item.provaId || ""))
            .filter((id) => mongoose.Types.ObjectId.isValid(id))
        )
      ];

      const provas = idsProvas.length
        ? await Prova.find({ _id: { $in: idsProvas } })
            .select("titulo modulo")
            .lean()
        : [];

      const mapaProvas = new Map(
        provas.map((prova) => [
          String(prova._id),
          {
            titulo: prova.titulo || "",
            modulo: prova.modulo || "Sem módulo"
          }
        ])
      );

      let lista = resultados.map((item) => {
        const prova = mapaProvas.get(String(item.provaId)) || {};
        return {
          id: String(item._id),
          _id: item._id,
          provaId: item.provaId || null,
          provaTitulo: item.provaTitulo || prova.titulo || "Prova",
          provaModulo: prova.modulo || "Sem módulo",
          usuarioId: item.usuarioId || null,
          usuarioNome: item.usuarioNome || "",
          usuarioEmail: item.usuarioEmail || "",
          totalPerguntas: Number(item.totalPerguntas || 0),
          acertos: Number(item.acertos || 0),
          erros: Number(item.erros || 0),
          nota: Number(item.nota || 0),
          notaMinima: Number(item.notaMinima || 70),
          aprovado: Boolean(item.aprovado),
          status: item.status || "pendente",
          iniciadoEm: item.iniciadoEm || "",
          finalizadoEm: item.finalizadoEm || "",
          createdAt: item.createdAt || "",
          updatedAt: item.updatedAt || ""
        };
      });

      if (busca) {
        const termo = String(busca).trim().toLowerCase();
        lista = lista.filter((item) =>
          [
            item.usuarioNome,
            item.usuarioEmail,
            item.provaTitulo,
            item.provaModulo
          ].some((valor) => String(valor || "").toLowerCase().includes(termo))
        );
      }

      return res.json({
        sucesso: true,
        total: lista.length,
        resultados: lista
      });
    } catch (error) {
      console.error("Erro ao listar resultados de provas por módulo:", error);
      return res.status(500).json({
        erro: "Erro interno ao listar resultados das provas."
      });
    }
  }
);

module.exports = router;
