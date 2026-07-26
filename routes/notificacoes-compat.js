const express = require("express");

const Notificacao = require("../models/Notificacao");
const { auth } = require("../middleware/auth");
const { getCargo } = require("../middleware/permissions");

const router = express.Router();

function hojeISO() {
  return new Date().toISOString();
}

function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function destinosDoUsuario(usuario) {
  const destinos = ["todos"];
  if (!usuario) return destinos;

  if (usuario.plano === "free") destinos.push("free");
  else destinos.push("premium");

  const cargo = getCargo(usuario);

  if (["dev", "dono", "superadmin", "admin", "financeiro", "moderador", "suporte"].includes(cargo)) {
    destinos.push("admin");
  }

  if (["dev", "dono", "superadmin"].includes(cargo)) destinos.push("superadmin");
  if (cargo === "moderador") destinos.push("moderadores");
  if (cargo === "suporte") destinos.push("suporte");
  if (usuario.vendedor || ["vendedor", "financeiro", "admin", "dono", "dev"].includes(cargo)) {
    destinos.push("vendedores");
  }

  return Array.from(new Set(destinos));
}

function usuarioJaLeu(notificacao, usuario) {
  const email = normalizarEmail(usuario?.email);
  const id = String(usuario?.id || usuario?._id || "");
  return Boolean(notificacao?.lidaPor?.some((item) => {
    if (email && normalizarEmail(item.email) === email) return true;
    if (id && String(item.usuarioId || "") === id) return true;
    return false;
  }));
}

function formatar(notificacao, usuario) {
  const obj = notificacao.toObject ? notificacao.toObject() : notificacao;
  return {
    id: String(obj._id || obj.id),
    _id: obj._id,
    titulo: obj.titulo || "",
    mensagem: obj.mensagem || "",
    tipo: obj.tipo || "geral",
    destino: obj.destino || "todos",
    email: obj.email || "",
    usuarioId: obj.usuarioId || null,
    prioridade: obj.prioridade || "normal",
    link: obj.link || "",
    icone: obj.icone || "🔔",
    ativa: Boolean(obj.ativa),
    fixada: Boolean(obj.fixada),
    expiraEm: obj.expiraEm || "",
    lida: usuarioJaLeu(obj, usuario),
    totalLidas: Array.isArray(obj.lidaPor) ? obj.lidaPor.length : 0,
    enviadaPor: obj.enviadaPor || "",
    createdAt: obj.createdAt || "",
    updatedAt: obj.updatedAt || ""
  };
}

async function listar(req, res) {
  try {
    const usuario = req.usuario;
    const destinos = destinosDoUsuario(usuario);
    const filtro = {
      ativa: true,
      $and: [
        {
          $or: [
            { expiraEm: "" },
            { expiraEm: { $gte: hojeISO() } }
          ]
        },
        {
          $or: [
            { destino: { $in: destinos } },
            { destino: "especifico", email: normalizarEmail(usuario.email) },
            { usuarioId: usuario._id }
          ]
        }
      ]
    };

    const notificacoes = await Notificacao.find(filtro)
      .sort({ fixada: -1, createdAt: -1 })
      .limit(60);

    const formatadas = notificacoes.map((item) => formatar(item, usuario));

    return res.json({
      sucesso: true,
      total: formatadas.length,
      naoLidas: formatadas.filter((item) => !item.lida).length,
      notificacoes: formatadas
    });
  } catch (error) {
    console.error("Erro na compatibilidade de notificações:", error);
    return res.status(500).json({ erro: "Erro interno ao buscar notificações." });
  }
}

router.get("/minhas-notificacoes", auth, listar);
router.get("/notificacoes/minhas", auth, listar);

module.exports = router;
