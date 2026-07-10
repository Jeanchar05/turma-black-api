const express = require("express");
const mongoose = require("mongoose");

const Agenda = require("../models/Agenda");

const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

const router = express.Router();

/* ===============================
   HELPERS
=============================== */

function hojeData() {
  return new Date().toISOString().split("T")[0];
}

function hojeISO() {
  return new Date().toISOString();
}

function somarDias(dataBase, dias) {
  const data = new Date(`${dataBase}T00:00:00`);
  data.setDate(data.getDate() + Number(dias || 0));
  return data.toISOString().split("T")[0];
}

function validarId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function normalizarStatus(status) {
  const valor = String(status || "").trim();

  const mapa = {
    agendar: "Agendar",
    agendado: "Agendado",
    concluido: "Concluído",
    "concluído": "Concluído",
    cancelado: "Cancelado",
    remarcar: "Remarcar"
  };

  return mapa[valor.toLowerCase()] || valor || "Agendar";
}

function normalizarTipo(tipo) {
  const valor = String(tipo || "").toLowerCase().trim();

  const permitidos = ["live", "aula", "reuniao", "evento", "manutencao", "outro"];

  if (permitidos.includes(valor)) {
    return valor;
  }

  return "evento";
}

function normalizarPrioridade(prioridade) {
  const valor = String(prioridade || "").toLowerCase().trim();

  const permitidos = ["baixa", "media", "alta", "urgente"];

  if (permitidos.includes(valor)) {
    return valor;
  }

  return "media";
}

function normalizarPublico(publico) {
  const valor = String(publico || "").toLowerCase().trim();

  const permitidos = ["todos", "free", "premium", "admin", "vendedores", "especifico"];

  if (permitidos.includes(valor)) {
    return valor;
  }

  return "todos";
}

function formatarAgenda(item) {
  if (!item) return null;

  const obj = item.toObject ? item.toObject() : item;

  return {
    id: String(obj._id || obj.id),
    _id: obj._id,

    titulo: obj.titulo || "",
    descricao: obj.descricao || "",

    dataInicio: obj.dataInicio || "",
    horaInicio: obj.horaInicio || "",
    dataFinal: obj.dataFinal || "",
    horaFinal: obj.horaFinal || "",

    status: obj.status || "Agendar",
    tipo: obj.tipo || "evento",
    prioridade: obj.prioridade || "media",
    publico: obj.publico || "todos",

    emailUsuario: obj.emailUsuario || "",

    link: obj.link || "",
    local: obj.local || "",

    googleEventId: obj.googleEventId || "",
    enviadoGoogleEm: obj.enviadoGoogleEm || "",

    limparApos: obj.limparApos || "",

    notificar: Boolean(obj.notificar),
    notificadoEm: obj.notificadoEm || "",

    criadoPor: obj.criadoPor || "",
    atualizadoPor: obj.atualizadoPor || "",

    createdAt: obj.createdAt || "",
    updatedAt: obj.updatedAt || ""
  };
}

async function buscarAgendaPorId(id) {
  if (!validarId(id)) {
    return null;
  }

  return Agenda.findById(id);
}

/* ===============================
   RESUMO
   GET /admin/agenda-primo/resumo
=============================== */

router.get(
  "/admin/agenda-primo/resumo",
  auth,
  requirePermission("agendaPrimo"),
  async (req, res) => {
    try {
      const resumo = await Agenda.aggregate([
        {
          $group: {
            _id: "$status",
            total: { $sum: 1 }
          }
        }
      ]);

      const status = {
        Agendar: 0,
        Agendado: 0,
        Concluído: 0,
        Cancelado: 0,
        Remarcar: 0
      };

      resumo.forEach((item) => {
        status[item._id] = item.total;
      });

      const hoje = hojeData();

      const [total, hojeEventos, proximosEventos, vencidos] = await Promise.all([
        Agenda.countDocuments(),
        Agenda.countDocuments({ dataInicio: hoje }),
        Agenda.countDocuments({
          dataInicio: { $gte: hoje },
          status: { $in: ["Agendar", "Agendado", "Remarcar"] }
        }),
        Agenda.countDocuments({
          dataFinal: { $lt: hoje },
          status: { $in: ["Agendar", "Agendado", "Remarcar"] }
        })
      ]);

      return res.json({
        sucesso: true,
        resumo: {
          total,
          hoje: hojeEventos,
          proximos: proximosEventos,
          vencidos,
          status
        }
      });
    } catch (error) {
      console.error("Erro no resumo da agenda:", error);

      return res.status(500).json({
        erro: "Erro interno ao gerar resumo da agenda."
      });
    }
  }
);

/* ===============================
   LISTAR AGENDA
   GET /admin/agenda-primo
=============================== */

router.get(
  "/admin/agenda-primo",
  auth,
  requirePermission("agendaPrimo"),
  async (req, res) => {
    try {
      const {
        busca = "",
        status = "",
        tipo = "",
        publico = "",
        dataInicio = "",
        dataFim = "",
        limite = 300
      } = req.query;

      const filtro = {};

      if (busca) {
        const termo = String(busca).trim();

        filtro.$or = [
          { titulo: { $regex: termo, $options: "i" } },
          { descricao: { $regex: termo, $options: "i" } },
          { local: { $regex: termo, $options: "i" } },
          { emailUsuario: { $regex: termo, $options: "i" } }
        ];
      }

      if (status) {
        filtro.status = normalizarStatus(status);
      }

      if (tipo) {
        filtro.tipo = normalizarTipo(tipo);
      }

      if (publico) {
        filtro.publico = normalizarPublico(publico);
      }

      if (dataInicio || dataFim) {
        filtro.dataInicio = {};

        if (dataInicio) {
          filtro.dataInicio.$gte = dataInicio;
        }

        if (dataFim) {
          filtro.dataInicio.$lte = dataFim;
        }
      }

      const eventos = await Agenda.find(filtro)
        .sort({ dataInicio: 1, horaInicio: 1, createdAt: -1 })
        .limit(Number(limite) || 300);

      return res.json({
        sucesso: true,
        total: eventos.length,
        eventos: eventos.map(formatarAgenda),
        agenda: eventos.map(formatarAgenda)
      });
    } catch (error) {
      console.error("Erro ao listar agenda:", error);

      return res.status(500).json({
        erro: "Erro interno ao listar agenda."
      });
    }
  }
);

/* ===============================
   AGENDA VISÍVEL PARA USUÁRIO
   GET /agenda
=============================== */

router.get("/agenda", auth, async (req, res) => {
  try {
    const usuario = req.usuario;
    const hoje = hojeData();

    const destinos = ["todos"];

    if (usuario.plano === "free") {
      destinos.push("free");
    } else {
      destinos.push("premium");
    }

    if (usuario.cargo) {
      destinos.push(usuario.cargo);
    }

    if (usuario.vendedor) {
      destinos.push("vendedores");
    }

    const eventos = await Agenda.find({
      dataInicio: { $gte: hoje },
      status: { $in: ["Agendar", "Agendado", "Remarcar"] },
      $or: [
        { publico: { $in: destinos } },
        { publico: "especifico", emailUsuario: usuario.email }
      ]
    })
      .sort({ dataInicio: 1, horaInicio: 1 })
      .limit(50);

    return res.json({
      sucesso: true,
      total: eventos.length,
      eventos: eventos.map(formatarAgenda),
      agenda: eventos.map(formatarAgenda)
    });
  } catch (error) {
    console.error("Erro ao buscar agenda do usuário:", error);

    return res.status(500).json({
      erro: "Erro interno ao buscar agenda."
    });
  }
});

/* ===============================
   BUSCAR EVENTO
   GET /admin/agenda-primo/:id
=============================== */

router.get(
  "/admin/agenda-primo/:id",
  auth,
  requirePermission("agendaPrimo"),
  async (req, res) => {
    try {
      const evento = await buscarAgendaPorId(req.params.id);

      if (!evento) {
        return res.status(404).json({
          erro: "Evento não encontrado."
        });
      }

      return res.json({
        sucesso: true,
        evento: formatarAgenda(evento),
        agenda: formatarAgenda(evento)
      });
    } catch (error) {
      console.error("Erro ao buscar evento:", error);

      return res.status(500).json({
        erro: "Erro interno ao buscar evento."
      });
    }
  }
);

/* ===============================
   CRIAR EVENTO
   POST /admin/agenda-primo
=============================== */

router.post(
  "/admin/agenda-primo",
  auth,
  requirePermission("agendaPrimo"),
  async (req, res) => {
    try {
      const {
        titulo,
        descricao = "",

        dataInicio,
        horaInicio,
        dataFinal,
        horaFinal,

        data,
        hora,

        status = "Agendar",
        tipo = "evento",
        prioridade = "media",
        publico = "todos",

        emailUsuario = "",
        link = "",
        local = "",

        notificar = true,
        limparApos = ""
      } = req.body;

      const dataInicial = dataInicio || data || "";
      const horaInicial = horaInicio || hora || "";

      const dataFimFinal = dataFinal || dataInicial;
      const horaFimFinal = horaFinal || horaInicial;

      if (!titulo || !dataInicial || !horaInicial) {
        return res.status(400).json({
          erro: "Título, data e horário são obrigatórios."
        });
      }

      const evento = await Agenda.create({
        titulo: String(titulo).trim(),
        descricao,

        dataInicio: dataInicial,
        horaInicio: horaInicial,
        dataFinal: dataFimFinal,
        horaFinal: horaFimFinal,

        status: normalizarStatus(status),
        tipo: normalizarTipo(tipo),
        prioridade: normalizarPrioridade(prioridade),
        publico: normalizarPublico(publico),

        emailUsuario: String(emailUsuario || "").toLowerCase().trim(),

        link,
        local,

        googleEventId: "",
        enviadoGoogleEm: "",

        limparApos,

        notificar: Boolean(notificar),
        notificadoEm: "",

        criadoPor: req.usuario?.email || "",
        atualizadoPor: req.usuario?.email || ""
      });

      return res.status(201).json({
        sucesso: true,
        mensagem: "Evento criado com sucesso.",
        evento: formatarAgenda(evento),
        agenda: formatarAgenda(evento)
      });
    } catch (error) {
      console.error("Erro ao criar evento:", error);

      return res.status(500).json({
        erro: "Erro interno ao criar evento."
      });
    }
  }
);

/* ===============================
   ATUALIZAR EVENTO
   PUT /admin/agenda-primo/:id
=============================== */

router.put(
  "/admin/agenda-primo/:id",
  auth,
  requirePermission("agendaPrimo"),
  async (req, res) => {
    try {
      const evento = await buscarAgendaPorId(req.params.id);

      if (!evento) {
        return res.status(404).json({
          erro: "Evento não encontrado."
        });
      }

      const camposSimples = [
        "titulo",
        "descricao",
        "dataInicio",
        "horaInicio",
        "dataFinal",
        "horaFinal",
        "emailUsuario",
        "link",
        "local",
        "limparApos",
        "notificar"
      ];

      camposSimples.forEach((campo) => {
        if (req.body[campo] !== undefined) {
          evento[campo] = req.body[campo];
        }
      });

      if (req.body.data !== undefined) {
        evento.dataInicio = req.body.data;
        evento.dataFinal = req.body.data;
      }

      if (req.body.hora !== undefined) {
        evento.horaInicio = req.body.hora;
      }

      if (req.body.status !== undefined) {
        evento.status = normalizarStatus(req.body.status);
      }

      if (req.body.tipo !== undefined) {
        evento.tipo = normalizarTipo(req.body.tipo);
      }

      if (req.body.prioridade !== undefined) {
        evento.prioridade = normalizarPrioridade(req.body.prioridade);
      }

      if (req.body.publico !== undefined) {
        evento.publico = normalizarPublico(req.body.publico);
      }

      if (!evento.dataFinal) {
        evento.dataFinal = evento.dataInicio;
      }

      if (!evento.horaFinal) {
        evento.horaFinal = evento.horaInicio;
      }

      evento.emailUsuario = String(evento.emailUsuario || "").toLowerCase().trim();
      evento.atualizadoPor = req.usuario?.email || "";

      await evento.save();

      return res.json({
        sucesso: true,
        mensagem: "Evento atualizado com sucesso.",
        evento: formatarAgenda(evento),
        agenda: formatarAgenda(evento)
      });
    } catch (error) {
      console.error("Erro ao atualizar evento:", error);

      return res.status(500).json({
        erro: "Erro interno ao atualizar evento."
      });
    }
  }
);

/* ===============================
   ALTERAR STATUS
   POST /admin/agenda-primo/:id/status
=============================== */

router.post(
  "/admin/agenda-primo/:id/status",
  auth,
  requirePermission("agendaPrimo"),
  async (req, res) => {
    try {
      const evento = await buscarAgendaPorId(req.params.id);

      if (!evento) {
        return res.status(404).json({
          erro: "Evento não encontrado."
        });
      }

      const status = normalizarStatus(req.body.status);

      const permitidos = ["Agendar", "Agendado", "Concluído", "Cancelado", "Remarcar"];

      if (!permitidos.includes(status)) {
        return res.status(400).json({
          erro: "Status inválido.",
          permitidos
        });
      }

      evento.status = status;
      evento.atualizadoPor = req.usuario?.email || "";

      if (status === "Agendado" && !evento.enviadoGoogleEm) {
        evento.enviadoGoogleEm = hojeISO();
      }

      if ((status === "Concluído" || status === "Cancelado") && !evento.limparApos) {
        evento.limparApos = somarDias(hojeData(), 7);
      }

      await evento.save();

      return res.json({
        sucesso: true,
        mensagem: "Status atualizado com sucesso.",
        evento: formatarAgenda(evento),
        agenda: formatarAgenda(evento)
      });
    } catch (error) {
      console.error("Erro ao alterar status da agenda:", error);

      return res.status(500).json({
        erro: "Erro interno ao alterar status da agenda."
      });
    }
  }
);

/* ===============================
   MARCAR COMO ENVIADO AO GOOGLE
   POST /admin/agenda-primo/:id/google
=============================== */

router.post(
  "/admin/agenda-primo/:id/google",
  auth,
  requirePermission("agendaPrimo"),
  async (req, res) => {
    try {
      const evento = await buscarAgendaPorId(req.params.id);

      if (!evento) {
        return res.status(404).json({
          erro: "Evento não encontrado."
        });
      }

      const { googleEventId = "" } = req.body;

      evento.status = "Agendado";
      evento.googleEventId = googleEventId || evento.googleEventId || "";
      evento.enviadoGoogleEm = hojeISO();
      evento.atualizadoPor = req.usuario?.email || "";

      if (!evento.limparApos) {
        evento.limparApos = somarDias(hojeData(), 7);
      }

      await evento.save();

      return res.json({
        sucesso: true,
        mensagem: "Evento marcado como enviado para o Google Agenda.",
        evento: formatarAgenda(evento),
        agenda: formatarAgenda(evento)
      });
    } catch (error) {
      console.error("Erro ao marcar Google Agenda:", error);

      return res.status(500).json({
        erro: "Erro interno ao atualizar Google Agenda."
      });
    }
  }
);

/* ===============================
   MARCAR NOTIFICADO
   POST /admin/agenda-primo/:id/notificado
=============================== */

router.post(
  "/admin/agenda-primo/:id/notificado",
  auth,
  requirePermission("agendaPrimo"),
  async (req, res) => {
    try {
      const evento = await buscarAgendaPorId(req.params.id);

      if (!evento) {
        return res.status(404).json({
          erro: "Evento não encontrado."
        });
      }

      evento.notificadoEm = hojeISO();
      evento.atualizadoPor = req.usuario?.email || "";

      await evento.save();

      return res.json({
        sucesso: true,
        mensagem: "Evento marcado como notificado.",
        evento: formatarAgenda(evento),
        agenda: formatarAgenda(evento)
      });
    } catch (error) {
      console.error("Erro ao marcar notificado:", error);

      return res.status(500).json({
        erro: "Erro interno ao marcar notificado."
      });
    }
  }
);

/* ===============================
   LIMPEZA AUTOMÁTICA
   POST /admin/agenda-primo/limpar
=============================== */

router.post(
  "/admin/agenda-primo/limpar",
  auth,
  requirePermission("agendaPrimo"),
  async (req, res) => {
    try {
      const hoje = hojeData();

      const resultado = await Agenda.deleteMany({
        limparApos: { $ne: "", $lte: hoje },
        status: { $in: ["Concluído", "Cancelado"] }
      });

      return res.json({
        sucesso: true,
        mensagem: "Limpeza da agenda executada com sucesso.",
        removidos: resultado.deletedCount || 0
      });
    } catch (error) {
      console.error("Erro ao limpar agenda:", error);

      return res.status(500).json({
        erro: "Erro interno ao limpar agenda."
      });
    }
  }
);

/* ===============================
   EXCLUIR EVENTO
   DELETE /admin/agenda-primo/:id
=============================== */

router.delete(
  "/admin/agenda-primo/:id",
  auth,
  requirePermission("agendaPrimo"),
  async (req, res) => {
    try {
      const evento = await buscarAgendaPorId(req.params.id);

      if (!evento) {
        return res.status(404).json({
          erro: "Evento não encontrado."
        });
      }

      await Agenda.deleteOne({ _id: evento._id });

      return res.json({
        sucesso: true,
        mensagem: "Evento removido com sucesso."
      });
    } catch (error) {
      console.error("Erro ao remover evento:", error);

      return res.status(500).json({
        erro: "Erro interno ao remover evento."
      });
    }
  }
);

/* ===============================
   STATUS DO MÓDULO
=============================== */

router.get("/agenda/status", (req, res) => {
  res.json({
    status: "online",
    modulo: "agenda",
    rotas: [
      "GET /agenda",
      "GET /admin/agenda-primo",
      "GET /admin/agenda-primo/resumo",
      "GET /admin/agenda-primo/:id",
      "POST /admin/agenda-primo",
      "PUT /admin/agenda-primo/:id",
      "POST /admin/agenda-primo/:id/status",
      "POST /admin/agenda-primo/:id/google",
      "POST /admin/agenda-primo/:id/notificado",
      "POST /admin/agenda-primo/limpar",
      "DELETE /admin/agenda-primo/:id"
    ]
  });
});

module.exports = router;
