const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || "turma_black_secret_dev";
const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
  console.error("ERRO: MONGO_URL não configurada no Render.");
  process.exit(1);
}

mongoose
  .connect(MONGO_URL)
  .then(() => console.log("MongoDB conectado com sucesso"))
  .catch((err) => {
    console.error("Erro ao conectar no MongoDB:", err.message);
    process.exit(1);
  });

// ===============================
// SCHEMAS
// ===============================

const usuarioSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    senha: { type: String, required: true },

    nome: String,

    tipo: {
      type: String,
      default: "aluno"
    },

    aprovado: {
      type: Boolean,
      default: false
    },

    suspenso: {
      type: Boolean,
      default: false
    },

    codigo: String,

    plano: {
      type: String,
      default: "free"
    },

    status: {
      type: String,
      default: "pendente"
    },

    dataExpiracao: String,

    acessos: {
      type: Number,
      default: 0
    },

    dispositivos: {
      type: Array,
      default: []
    },

    ultimoLogin: String,

    criadoEm: String,

    aprovadoEm: String
  },
  { timestamps: true }
);

const chamadoSchema = new mongoose.Schema(
  {
    aluno: String,
    email: String,
    assunto: String,
    mensagem: String,

    tipo: {
      type: String,
      default: "Geral"
    },

    prioridade: {
      type: String,
      default: "Média"
    },

    status: {
      type: String,
      default: "aberto"
    },

    resposta: {
      type: String,
      default: ""
    },

    criadoEm: String,
    respondidoEm: String,
    fechadoEm: String
  },
  { timestamps: true }
);

const historicoAdminSchema = new mongoose.Schema(
  {
    acao: String,
    adminEmail: String,

    tipo: {
      type: String,
      default: "geral"
    },

    criadoEm: String
  },
  { timestamps: true }
);

const provaResultadoSchema = new mongoose.Schema(
  {
    aluno: String,
    email: String,
    tipoProva: String,
    titulo: String,
    nota: Number,
    acertos: Number,
    erros: Number,
    totalQuestoes: Number,
    percentual: Number,
    criadoEm: String
  },
  { timestamps: true }
);

// ===============================
// CONTROLE DE ALUNOS
// ===============================

const alunoControleSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: true
    },

    telefone: {
      type: String,
      default: ""
    },

    plano: {
      type: String,
      enum: ["black", "particular"],
      required: true
    },

    dataEntrada: {
      type: String,
      required: true
    },

    diasPlano: {
      type: Number,
      default: 30
    },

    statusManual: {
      type: String,
      enum: ["ativo", "inativo", "renovar", "particular"],
      default: "ativo"
    },

    observacoes: {
      type: String,
      default: ""
    },

    renovacoes: {
      type: Number,
      default: 0
    },

    ultimaRenovacao: {
      type: String,
      default: ""
    },

    criadoPor: {
      type: String,
      default: ""
    },

    atualizadoPor: {
      type: String,
      default: ""
    },

    criadoEm: String,
    atualizadoEm: String
  },
  { timestamps: true }
);

// ===============================
// AGENDA DO PRIMO
// ===============================

const agendaPrimoSchema = new mongoose.Schema(
  {
    titulo: {
      type: String,
      required: true
    },

    dataInicio: {
      type: String,
      required: true
    },

    horaInicio: {
      type: String,
      required: true
    },

    dataFinal: {
      type: String,
      required: true
    },

    horaFinal: {
      type: String,
      required: true
    },

    descricao: {
      type: String,
      default: ""
    },

    status: {
      type: String,
      enum: [
        "Agendar",
        "Agendado",
        "Cancelado",
        "Concluído",
        "Remarcar"
      ],
      default: "Agendar"
    },

    googleEventId: {
      type: String,
      default: ""
    },

    enviadoGoogleEm: {
      type: String,
      default: ""
    },

    limparApos: {
      type: String,
      default: ""
    },

    criadoPor: {
      type: String,
      default: ""
    },

    atualizadoPor: {
      type: String,
      default: ""
    },

    criadoEm: String,
    atualizadoEm: String
  },
  { timestamps: true }
);

// ===============================
// MODELS
// ===============================

const Usuario = mongoose.model("Usuario", usuarioSchema);

const Chamado = mongoose.model(
  "Chamado",
  chamadoSchema
);

const HistoricoAdmin = mongoose.model(
  "HistoricoAdmin",
  historicoAdminSchema
);

const ProvaResultado = mongoose.model(
  "ProvaResultado",
  provaResultadoSchema
);

const AlunoControle = mongoose.model(
  "AlunoControle",
  alunoControleSchema
);

const AgendaPrimo = mongoose.model(
  "AgendaPrimo",
  agendaPrimoSchema
);

// ===============================
// HELPERS
// ===============================

function gerarCodigo() {
  return Math.floor(
    100000 + Math.random() * 900000
  ).toString();
}

function normalizarEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function hojeISO() {
  return new Date().toISOString();
}

function somenteNumeros(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function validarDataISO(data) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    String(data || "")
  );
}

function validarHora(hora) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(
    String(hora || "")
  );
}

function diferencaDias(dataBase) {
  if (!dataBase) return 0;

  const inicio = new Date(dataBase + "T00:00:00");
  const hoje = new Date();

  inicio.setHours(0, 0, 0, 0);
  hoje.setHours(0, 0, 0, 0);

  const diff =
    hoje.getTime() - inicio.getTime();

  return Math.max(
    0,
    Math.floor(diff / (1000 * 60 * 60 * 24))
  );
}

function somarDias(dataBase, dias) {
  const data = new Date(dataBase + "T00:00:00");

  data.setDate(
    data.getDate() + Number(dias || 0)
  );

  return data.toISOString().split("T")[0];
}

function montarUsuario(user) {
  return {
    id: user._id,
    email: user.email,
    nome: user.nome,
    tipo: user.tipo,
    plano: user.plano,
    status: user.status,
    aprovado: user.aprovado,
    suspenso: user.suspenso,
    dataExpiracao:
      user.dataExpiracao || null,
    acessos: user.acessos || 0,
    ultimoLogin:
      user.ultimoLogin || "",
    criadoEm:
      user.criadoEm ||
      user.createdAt ||
      "",
    dispositivos:
      user.dispositivos || []
  };
}

function montarAlunoControle(aluno) {
  const plano = aluno.plano;

  const diasUsados = diferencaDias(
    aluno.dataEntrada
  );

  let diasRestantes = null;

  let statusCalculado =
    aluno.statusManual || "ativo";

  if (plano === "black") {
    const diasPlano = Number(
      aluno.diasPlano || 30
    );

    diasRestantes = Math.max(
      0,
      diasPlano - diasUsados
    );

    if (
      aluno.statusManual === "inativo"
    ) {
      statusCalculado = "inativo";
    } else if (diasRestantes <= 0) {
      statusCalculado = "renovar";
    } else {
      statusCalculado = "ativo";
    }
  }

  if (plano === "particular") {
    diasRestantes = null;

    statusCalculado =
      aluno.statusManual === "inativo"
        ? "inativo"
        : "particular";
  }

  return {
    id: aluno._id,

    nome: aluno.nome,

    telefone:
      aluno.telefone || "",

    plano: aluno.plano,

    dataEntrada:
      aluno.dataEntrada,

    diasPlano:
      aluno.plano === "black"
        ? Number(
            aluno.diasPlano || 30
          )
        : null,

    diasUsados,

    diasRestantes,

    status: statusCalculado,

    statusManual:
      aluno.statusManual,

    observacoes:
      aluno.observacoes || "",

    renovacoes:
      aluno.renovacoes || 0,

    ultimaRenovacao:
      aluno.ultimaRenovacao || "",

    criadoPor:
      aluno.criadoPor || "",

    atualizadoPor:
      aluno.atualizadoPor || "",

    criadoEm:
      aluno.criadoEm ||
      aluno.createdAt ||
      "",

    atualizadoEm:
      aluno.atualizadoEm ||
      aluno.updatedAt ||
      ""
  };
}

function montarAgendaPrimo(item) {
  return {
    id: item._id,

    titulo: item.titulo,

    dataInicio:
      item.dataInicio,

    horaInicio:
      item.horaInicio,

    dataFinal:
      item.dataFinal,

    horaFinal:
      item.horaFinal,

    descricao:
      item.descricao || "",

    status:
      item.status || "Agendar",

    googleEventId:
      item.googleEventId || "",

    enviadoGoogleEm:
      item.enviadoGoogleEm || "",

    limparApos:
      item.limparApos || "",

    criadoPor:
      item.criadoPor || "",

    atualizadoPor:
      item.atualizadoPor || "",

    criadoEm:
      item.criadoEm ||
      item.createdAt ||
      "",

    atualizadoEm:
      item.atualizadoEm ||
      item.updatedAt ||
      ""
  };
}

async function registrarHistorico(
  adminEmail,
  acao,
  tipo = "geral"
) {
  try {
    await HistoricoAdmin.create({
      acao,
      tipo,
      adminEmail,
      criadoEm: hojeISO()
    });
  } catch (error) {
    console.log(
      "Erro histórico:",
      error.message
    );
  }
}

// ===============================
// AUTH
// ===============================

function autenticar(req, res, next) {
  const auth =
    req.headers.authorization || "";

  const token = auth.replace(
    "Bearer ",
    ""
  );

  if (!token) {
    return res.status(401).json({
      erro: "Token não enviado."
    });
  }

  try {
    req.user = jwt.verify(token, SECRET);

    next();
  } catch {
    return res.status(401).json({
      erro: "Token inválido."
    });
  }
}

function somenteAdmin(
  req,
  res,
  next
) {
  if (
    !req.user ||
    req.user.tipo !== "admin"
  ) {
    return res.status(403).json({
      erro:
        "Acesso restrito ao admin."
    });
  }

  next();
}

// ===============================
// ADMIN PADRÃO
// ===============================

async function garantirAdmin() {
  const admin =
    await Usuario.findOne({
      email:
        "admin@turmablack.com"
    });

  if (!admin) {
    await Usuario.create({
      email:
        "admin@turmablack.com",

      senha: "admin123",

      nome: "Admin",

      tipo: "admin",

      aprovado: true,

      suspenso: false,

      status: "ativo",

      codigo: "999999",

      plano: "premium",

      acessos: 9999999,

      dispositivos: [],

      criadoEm: hojeISO()
    });

    console.log(
      "Admin padrão criado."
    );

    return;
  }

  admin.tipo = "admin";
  admin.aprovado = true;
  admin.suspenso = false;
  admin.status = "ativo";
  admin.plano = "premium";

  await admin.save();

  console.log(
    "Admin padrão verificado."
  );
}

// ===============================
// TESTE
// ===============================

app.get("/", (req, res) => {
  res.json({
    status: "online",

    nome: "Turma Black API",

    banco:
      "MongoDB conectado",

    mensagem:
      "Backend rodando com sucesso",

    modulos: {
      usuarios: true,
      suporte: true,
      provas: true,
      controleAlunos: true,
      agendaPrimo: true
    }
  });
});

// ===============================
// CADASTRO
// ===============================

app.post("/criar", async (req, res) => {
  try {
    const email = normalizarEmail(
      req.body.email
    );

    const senha = String(
      req.body.senha || ""
    ).trim();

    if (!email || !senha) {
      return res.json({
        erro:
          "Preencha e-mail e senha."
      });
    }

    const existe =
      await Usuario.findOne({
        email
      });

    if (existe) {
      return res.json({
        erro:
          "Esse e-mail já possui cadastro."
      });
    }

    const codigo =
      gerarCodigo();

    const novoUsuario =
      await Usuario.create({
        email,

        senha,

        nome:
          req.body.nome ||
          email.split("@")[0],

        tipo: "aluno",

        aprovado: false,

        suspenso: false,

        status: "pendente",

        codigo,

        plano: "free",

        dataExpiracao: null,

        acessos: 0,

        dispositivos: [],

        criadoEm: hojeISO()
      });

    res.json({
      sucesso: true,

      mensagem:
        "Conta criada. Aguardando aprovação.",

      codigo,

      usuario: {
        email:
          novoUsuario.email,

        nome:
          novoUsuario.nome,

        aprovado:
          novoUsuario.aprovado
      }
    });
  } catch (error) {
    res.json({
      erro:
        "Erro ao criar conta.",

      detalhe:
        error.message
    });
  }
});

// ===============================
// LOGIN
// ===============================

app.post("/login", async (req, res) => {
  try {
    const email = normalizarEmail(
      req.body.email
    );

    const senha = String(
      req.body.senha || ""
    ).trim();

    const user =
      await Usuario.findOne({
        email,
        senha
      });

    if (!user) {
      return res.json({
        erro:
          "E-mail ou senha incorretos."
      });
    }

    if (
      user.suspenso ||
      user.status === "suspenso"
    ) {
      return res.json({
        erro:
          "Conta suspensa."
      });
    }

    if (!user.aprovado) {
      return res.json({
        erro:
          "Sua conta ainda não foi aprovada.",

        codigo: user.codigo
      });
    }

    user.acessos =
      Number(
        user.acessos || 0
      ) + 1;

    user.ultimoLogin =
      hojeISO();

    await user.save();

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        tipo: user.tipo
      },
      SECRET,
      {
        expiresIn: "1d"
      }
    );

    res.json({
      sucesso: true,

      token,

      usuario:
        montarUsuario(user)
    });
  } catch (error) {
    res.json({
      erro:
        "Erro ao fazer login.",

      detalhe:
        error.message
    });
  }
});
// ===============================
// USUÁRIO LOGADO
// ===============================

app.get("/me", autenticar, async (req, res) => {
  try {
    const user = await Usuario.findById(req.user.id).select("-senha");

    if (!user) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    if (user.suspenso || user.status === "suspenso") {
      return res.status(403).json({ erro: "Conta suspensa." });
    }

    res.json({
      sucesso: true,
      usuario: montarUsuario(user)
    });
  } catch (error) {
    res.status(500).json({
      erro: "Erro ao validar usuário.",
      detalhe: error.message
    });
  }
});

// ===============================
// USUÁRIOS ADMIN
// ===============================

app.get("/usuarios", autenticar, somenteAdmin, async (req, res) => {
  try {
    const usuarios = await Usuario.find().sort({ createdAt: -1 });

    res.json({
      sucesso: true,
      usuarios: usuarios.map((u) => ({
        ...montarUsuario(u),
        codigo: u.codigo,
        dataExpiracao: u.dataExpiracao || ""
      }))
    });
  } catch (error) {
    res.json({ erro: "Erro ao buscar usuários.", detalhe: error.message });
  }
});

app.post("/aprovar", autenticar, somenteAdmin, async (req, res) => {
  try {
    const codigo = String(req.body.codigo || "").trim();
    const user = await Usuario.findOne({ codigo });

    if (!user) return res.json({ erro: "Código não encontrado." });

    user.aprovado = true;
    user.suspenso = false;
    user.status = "ativo";
    user.aprovadoEm = hojeISO();

    await user.save();

    await registrarHistorico(req.user.email, `Aprovou o aluno ${user.email}`, "usuarios");

    res.json({
      sucesso: true,
      mensagem: "Aluno aprovado com sucesso.",
      usuario: {
        email: user.email,
        nome: user.nome,
        codigo: user.codigo
      }
    });
  } catch (error) {
    res.json({ erro: "Erro ao aprovar aluno.", detalhe: error.message });
  }
});

app.post("/usuario/plano", autenticar, somenteAdmin, async (req, res) => {
  try {
    const email = normalizarEmail(req.body.email);
    const user = await Usuario.findOne({ email });

    if (!user) return res.json({ erro: "Usuário não encontrado." });
    if (user.tipo === "admin") return res.json({ erro: "Não é permitido alterar plano do admin." });

    user.plano = req.body.plano || user.plano;
    user.status = req.body.status || "ativo";
    user.aprovado = req.body.aprovado === undefined ? true : Boolean(req.body.aprovado);
    user.suspenso = req.body.suspenso === undefined ? false : Boolean(req.body.suspenso);
    user.dataExpiracao = req.body.dataExpiracao || null;

    await user.save();

    await registrarHistorico(req.user.email, `Atualizou plano/status de ${user.email}`, "usuarios");

    res.json({
      sucesso: true,
      mensagem: "Plano atualizado com sucesso.",
      usuario: montarUsuario(user)
    });
  } catch (error) {
    res.json({ erro: "Erro ao atualizar plano.", detalhe: error.message });
  }
});

app.post("/suspender", autenticar, somenteAdmin, async (req, res) => {
  try {
    const email = normalizarEmail(req.body.email);
    const user = await Usuario.findOne({ email });

    if (!user) return res.json({ erro: "Usuário não encontrado." });
    if (user.tipo === "admin") return res.json({ erro: "Não é permitido suspender o admin." });

    user.suspenso = true;
    user.status = "suspenso";

    await user.save();

    await registrarHistorico(req.user.email, `Suspendeu o usuário ${user.email}`, "usuarios");

    res.json({
      sucesso: true,
      mensagem: "Usuário suspenso.",
      email: user.email
    });
  } catch (error) {
    res.json({ erro: "Erro ao suspender usuário.", detalhe: error.message });
  }
});

app.post("/reativar", autenticar, somenteAdmin, async (req, res) => {
  try {
    const email = normalizarEmail(req.body.email);
    const user = await Usuario.findOne({ email });

    if (!user) return res.json({ erro: "Usuário não encontrado." });

    user.suspenso = false;
    user.aprovado = true;
    user.status = "ativo";

    await user.save();

    await registrarHistorico(req.user.email, `Reativou o usuário ${user.email}`, "usuarios");

    res.json({
      sucesso: true,
      mensagem: "Usuário reativado.",
      email: user.email
    });
  } catch (error) {
    res.json({ erro: "Erro ao reativar usuário.", detalhe: error.message });
  }
});

app.delete("/usuario/:email", autenticar, somenteAdmin, async (req, res) => {
  try {
    const email = normalizarEmail(req.params.email);
    const user = await Usuario.findOne({ email });

    if (!user) return res.json({ erro: "Usuário não encontrado." });
    if (user.tipo === "admin") return res.json({ erro: "Não é permitido excluir o admin." });

    await Usuario.deleteOne({ email });

    await registrarHistorico(req.user.email, `Excluiu o usuário ${email}`, "usuarios");

    res.json({
      sucesso: true,
      mensagem: "Usuário excluído.",
      email
    });
  } catch (error) {
    res.json({ erro: "Erro ao excluir usuário.", detalhe: error.message });
  }
});

// ===============================
// CONTROLE DE ALUNOS
// ===============================

app.get("/admin/controle-alunos", autenticar, somenteAdmin, async (req, res) => {
  try {
    const busca = String(req.query.busca || "").trim();
    const plano = String(req.query.plano || "").trim();
    const status = String(req.query.status || "").trim();

    const filtro = {};

    if (plano && plano !== "todos") filtro.plano = plano;

    if (busca) {
      filtro.$or = [
        { nome: { $regex: busca, $options: "i" } },
        { telefone: { $regex: busca, $options: "i" } }
      ];
    }

    const alunos = await AlunoControle.find(filtro).sort({ createdAt: -1 });
    let alunosMontados = alunos.map(montarAlunoControle);

    if (status && status !== "todos") {
      alunosMontados = alunosMontados.filter((a) => a.status === status);
    }

    res.json({
      sucesso: true,
      resumo: {
        total: alunosMontados.length,
        ativos: alunosMontados.filter((a) => a.status === "ativo").length,
        renovar: alunosMontados.filter((a) => a.status === "renovar").length,
        particulares: alunosMontados.filter((a) => a.status === "particular").length,
        inativos: alunosMontados.filter((a) => a.status === "inativo").length
      },
      alunos: alunosMontados
    });
  } catch (error) {
    res.json({ erro: "Erro ao buscar controle de alunos.", detalhe: error.message });
  }
});

app.post("/admin/controle-alunos", autenticar, somenteAdmin, async (req, res) => {
  try {
    const nome = String(req.body.nome || "").trim();
    const telefone = somenteNumeros(req.body.telefone);
    const plano = String(req.body.plano || "").trim();
    const dataEntrada = String(req.body.dataEntrada || "").trim();
    const observacoes = String(req.body.observacoes || "").trim();

    if (!nome) return res.json({ erro: "Informe o nome do aluno." });
    if (!["black", "particular"].includes(plano)) return res.json({ erro: "Plano inválido." });
    if (!validarDataISO(dataEntrada)) return res.json({ erro: "Data de entrada inválida." });

    const aluno = await AlunoControle.create({
      nome,
      telefone,
      plano,
      dataEntrada,
      diasPlano: plano === "black" ? 30 : null,
      statusManual: plano === "black" ? "ativo" : "particular",
      observacoes,
      renovacoes: 0,
      criadoPor: req.user.email,
      atualizadoPor: req.user.email,
      criadoEm: hojeISO(),
      atualizadoEm: hojeISO()
    });

    await registrarHistorico(req.user.email, `Adicionou ${nome} no controle de alunos`, "controle-alunos");

    res.json({
      sucesso: true,
      mensagem: "Aluno adicionado com sucesso.",
      aluno: montarAlunoControle(aluno)
    });
  } catch (error) {
    res.json({ erro: "Erro ao adicionar aluno.", detalhe: error.message });
  }
});

app.put("/admin/controle-alunos/:id", autenticar, somenteAdmin, async (req, res) => {
  try {
    const aluno = await AlunoControle.findById(req.params.id);

    if (!aluno) return res.json({ erro: "Aluno não encontrado." });

    const nome = String(req.body.nome || aluno.nome).trim();
    const telefone = req.body.telefone === undefined ? aluno.telefone : somenteNumeros(req.body.telefone);
    const plano = String(req.body.plano || aluno.plano).trim();
    const dataEntrada = String(req.body.dataEntrada || aluno.dataEntrada).trim();
    const observacoes = req.body.observacoes === undefined ? aluno.observacoes : String(req.body.observacoes || "").trim();
    const statusManual = String(req.body.statusManual || aluno.statusManual).trim();

    if (!["black", "particular"].includes(plano)) return res.json({ erro: "Plano inválido." });
    if (!validarDataISO(dataEntrada)) return res.json({ erro: "Data de entrada inválida." });

    aluno.nome = nome;
    aluno.telefone = telefone;
    aluno.plano = plano;
    aluno.dataEntrada = dataEntrada;
    aluno.diasPlano = plano === "black" ? 30 : null;
    aluno.statusManual = plano === "particular" && statusManual !== "inativo" ? "particular" : statusManual;
    aluno.observacoes = observacoes;
    aluno.atualizadoPor = req.user.email;
    aluno.atualizadoEm = hojeISO();

    await aluno.save();

    await registrarHistorico(req.user.email, `Editou ${aluno.nome} no controle`, "controle-alunos");

    res.json({
      sucesso: true,
      mensagem: "Aluno atualizado com sucesso.",
      aluno: montarAlunoControle(aluno)
    });
  } catch (error) {
    res.json({ erro: "Erro ao atualizar aluno.", detalhe: error.message });
  }
});

app.post("/admin/controle-alunos/:id/renovar", autenticar, somenteAdmin, async (req, res) => {
  try {
    const aluno = await AlunoControle.findById(req.params.id);

    if (!aluno) return res.json({ erro: "Aluno não encontrado." });
    if (aluno.plano !== "black") return res.json({ erro: "Apenas plano Black pode ser renovado." });

    aluno.dataEntrada = new Date().toISOString().split("T")[0];
    aluno.diasPlano = 30;
    aluno.statusManual = "ativo";
    aluno.renovacoes = Number(aluno.renovacoes || 0) + 1;
    aluno.ultimaRenovacao = hojeISO();
    aluno.atualizadoPor = req.user.email;
    aluno.atualizadoEm = hojeISO();

    await aluno.save();

    await registrarHistorico(req.user.email, `Renovou ${aluno.nome} por +30 dias`, "controle-alunos");

    res.json({
      sucesso: true,
      mensagem: "Plano Black renovado por +30 dias.",
      aluno: montarAlunoControle(aluno)
    });
  } catch (error) {
    res.json({ erro: "Erro ao renovar aluno.", detalhe: error.message });
  }
});

app.post("/admin/controle-alunos/:id/status", autenticar, somenteAdmin, async (req, res) => {
  try {
    const aluno = await AlunoControle.findById(req.params.id);
    const status = String(req.body.status || "").trim();

    if (!aluno) return res.json({ erro: "Aluno não encontrado." });

    const permitidos = ["ativo", "inativo", "renovar", "particular"];

    if (!permitidos.includes(status)) return res.json({ erro: "Status inválido." });

    aluno.statusManual = aluno.plano === "particular" && status === "ativo" ? "particular" : status;
    aluno.atualizadoPor = req.user.email;
    aluno.atualizadoEm = hojeISO();

    await aluno.save();

    res.json({
      sucesso: true,
      mensagem: "Status atualizado.",
      aluno: montarAlunoControle(aluno)
    });
  } catch (error) {
    res.json({ erro: "Erro ao alterar status.", detalhe: error.message });
  }
});

app.delete("/admin/controle-alunos/:id", autenticar, somenteAdmin, async (req, res) => {
  try {
    const aluno = await AlunoControle.findById(req.params.id);

    if (!aluno) return res.json({ erro: "Aluno não encontrado." });

    await AlunoControle.deleteOne({ _id: req.params.id });

    await registrarHistorico(req.user.email, `Removeu ${aluno.nome} do controle`, "controle-alunos");

    res.json({
      sucesso: true,
      mensagem: "Aluno removido com sucesso."
    });
  } catch (error) {
    res.json({ erro: "Erro ao excluir aluno.", detalhe: error.message });
  }
});

// ===============================
// AGENDA DO PRIMO
// ===============================

app.get("/admin/agenda-primo", autenticar, somenteAdmin, async (req, res) => {
  try {
    const status = String(req.query.status || "").trim();
    const busca = String(req.query.busca || "").trim();

    const filtro = {};

    if (status && status !== "todos") filtro.status = status;

    if (busca) {
      filtro.$or = [
        { titulo: { $regex: busca, $options: "i" } },
        { descricao: { $regex: busca, $options: "i" } }
      ];
    }

    const agenda = await AgendaPrimo.find(filtro).sort({
      dataInicio: 1,
      horaInicio: 1
    });

    res.json({
      sucesso: true,
      resumo: {
        total: agenda.length,
        agendar: agenda.filter((a) => a.status === "Agendar").length,
        agendados: agenda.filter((a) => a.status === "Agendado").length,
        concluidos: agenda.filter((a) => a.status === "Concluído").length,
        cancelados: agenda.filter((a) => a.status === "Cancelado").length
      },
      agenda: agenda.map(montarAgendaPrimo)
    });
  } catch (error) {
    res.json({ erro: "Erro ao buscar agenda.", detalhe: error.message });
  }
});

app.post("/admin/agenda-primo", autenticar, somenteAdmin, async (req, res) => {
  try {
    const titulo = String(req.body.titulo || "").trim();
    const dataInicio = String(req.body.dataInicio || "").trim();
    const horaInicio = String(req.body.horaInicio || "").trim();
    const dataFinal = String(req.body.dataFinal || "").trim();
    const horaFinal = String(req.body.horaFinal || "").trim();
    const descricao = String(req.body.descricao || "").trim();

    if (!titulo) return res.json({ erro: "Informe o título do evento." });
    if (!validarDataISO(dataInicio)) return res.json({ erro: "Data inicial inválida." });
    if (!validarHora(horaInicio)) return res.json({ erro: "Hora inicial inválida." });
    if (!validarDataISO(dataFinal)) return res.json({ erro: "Data final inválida." });
    if (!validarHora(horaFinal)) return res.json({ erro: "Hora final inválida." });

    const agenda = await AgendaPrimo.create({
      titulo,
      dataInicio,
      horaInicio,
      dataFinal,
      horaFinal,
      descricao,
      status: "Agendar",
      criadoPor: req.user.email,
      atualizadoPor: req.user.email,
      criadoEm: hojeISO(),
      atualizadoEm: hojeISO()
    });

    await registrarHistorico(req.user.email, `Criou agendamento "${titulo}"`, "agenda-primo");

    res.json({
      sucesso: true,
      mensagem: "Evento criado com sucesso.",
      agenda: montarAgendaPrimo(agenda)
    });
  } catch (error) {
    res.json({ erro: "Erro ao criar evento.", detalhe: error.message });
  }
});

app.put("/admin/agenda-primo/:id", autenticar, somenteAdmin, async (req, res) => {
  try {
    const agenda = await AgendaPrimo.findById(req.params.id);

    if (!agenda) return res.json({ erro: "Evento não encontrado." });

    const titulo = String(req.body.titulo || agenda.titulo).trim();
    const dataInicio = String(req.body.dataInicio || agenda.dataInicio).trim();
    const horaInicio = String(req.body.horaInicio || agenda.horaInicio).trim();
    const dataFinal = String(req.body.dataFinal || agenda.dataFinal).trim();
    const horaFinal = String(req.body.horaFinal || agenda.horaFinal).trim();
    const descricao = req.body.descricao === undefined ? agenda.descricao : String(req.body.descricao || "").trim();

    if (!validarDataISO(dataInicio)) return res.json({ erro: "Data inicial inválida." });
    if (!validarHora(horaInicio)) return res.json({ erro: "Hora inicial inválida." });
    if (!validarDataISO(dataFinal)) return res.json({ erro: "Data final inválida." });
    if (!validarHora(horaFinal)) return res.json({ erro: "Hora final inválida." });

    agenda.titulo = titulo;
    agenda.dataInicio = dataInicio;
    agenda.horaInicio = horaInicio;
    agenda.dataFinal = dataFinal;
    agenda.horaFinal = horaFinal;
    agenda.descricao = descricao;
    agenda.atualizadoPor = req.user.email;
    agenda.atualizadoEm = hojeISO();

    await agenda.save();

    res.json({
      sucesso: true,
      mensagem: "Evento atualizado.",
      agenda: montarAgendaPrimo(agenda)
    });
  } catch (error) {
    res.json({ erro: "Erro ao editar evento.", detalhe: error.message });
  }
});

app.post("/admin/agenda-primo/:id/status", autenticar, somenteAdmin, async (req, res) => {
  try {
    const agenda = await AgendaPrimo.findById(req.params.id);
    const status = String(req.body.status || "").trim();

    if (!agenda) return res.json({ erro: "Evento não encontrado." });

    const permitidos = ["Agendar", "Agendado", "Cancelado", "Concluído", "Remarcar"];

    if (!permitidos.includes(status)) return res.json({ erro: "Status inválido." });

    agenda.status = status;
    agenda.atualizadoPor = req.user.email;
    agenda.atualizadoEm = hojeISO();

    await agenda.save();

    res.json({
      sucesso: true,
      mensagem: "Status atualizado.",
      agenda: montarAgendaPrimo(agenda)
    });
  } catch (error) {
    res.json({ erro: "Erro ao atualizar status.", detalhe: error.message });
  }
});

app.post("/admin/agenda-primo/:id/google", autenticar, somenteAdmin, async (req, res) => {
  try {
    const agenda = await AgendaPrimo.findById(req.params.id);

    if (!agenda) return res.json({ erro: "Evento não encontrado." });

    if (agenda.status !== "Agendar") {
      return res.json({ erro: "Somente eventos com status Agendar podem ser enviados." });
    }

    // Preparado para API real do Google Calendar.
    // Por enquanto salva como enviado e muda status para Agendado.
    agenda.googleEventId = "google_" + Date.now();
    agenda.status = "Agendado";
    agenda.enviadoGoogleEm = hojeISO();
    agenda.limparApos = somarDias(new Date().toISOString().split("T")[0], 7);
    agenda.atualizadoPor = req.user.email;
    agenda.atualizadoEm = hojeISO();

    await agenda.save();

    await registrarHistorico(req.user.email, `Enviou "${agenda.titulo}" para Google Agenda`, "agenda-primo");

    res.json({
      sucesso: true,
      mensagem: "Evento marcado como enviado para Google Agenda.",
      agenda: montarAgendaPrimo(agenda)
    });
  } catch (error) {
    res.json({ erro: "Erro ao enviar para Google Agenda.", detalhe: error.message });
  }
});

app.delete("/admin/agenda-primo/:id", autenticar, somenteAdmin, async (req, res) => {
  try {
    const agenda = await AgendaPrimo.findById(req.params.id);

    if (!agenda) return res.json({ erro: "Evento não encontrado." });

    await AgendaPrimo.deleteOne({ _id: req.params.id });

    res.json({
      sucesso: true,
      mensagem: "Evento excluído com sucesso."
    });
  } catch (error) {
    res.json({ erro: "Erro ao excluir evento.", detalhe: error.message });
  }
});

// ===============================
// SUPORTE
// ===============================

app.post("/suporte", autenticar, async (req, res) => {
  try {
    const assunto = String(req.body.assunto || "").trim();
    const mensagem = String(req.body.mensagem || "").trim();

    if (!assunto || !mensagem) return res.json({ erro: "Preencha assunto e mensagem." });

    const chamado = await Chamado.create({
      aluno: req.body.aluno || req.user.email,
      email: req.user.email,
      assunto,
      mensagem,
      tipo: String(req.body.tipo || "Geral").trim(),
      prioridade: String(req.body.prioridade || "Média").trim(),
      status: "aberto",
      criadoEm: hojeISO()
    });

    res.json({
      sucesso: true,
      mensagem: "Chamado aberto com sucesso.",
      chamado
    });
  } catch (error) {
    res.json({ erro: "Erro ao abrir chamado.", detalhe: error.message });
  }
});

app.get("/suporte", autenticar, somenteAdmin, async (req, res) => {
  try {
    const chamados = await Chamado.find().sort({ createdAt: -1 });
    res.json({ sucesso: true, chamados });
  } catch (error) {
    res.json({ erro: "Erro ao buscar chamados.", detalhe: error.message });
  }
});

app.get("/meus-chamados", autenticar, async (req, res) => {
  try {
    const chamados = await Chamado.find({ email: req.user.email }).sort({ createdAt: -1 });
    res.json({ sucesso: true, chamados });
  } catch (error) {
    res.json({ erro: "Erro ao buscar seus chamados.", detalhe: error.message });
  }
});

app.post("/suporte/:id/responder", autenticar, somenteAdmin, async (req, res) => {
  try {
    const resposta = String(req.body.resposta || "").trim();

    if (!resposta) return res.json({ erro: "Digite uma resposta." });

    const chamado = await Chamado.findById(req.params.id);

    if (!chamado) return res.json({ erro: "Chamado não encontrado." });

    chamado.resposta = resposta;
    chamado.status = "respondido";
    chamado.respondidoEm = hojeISO();

    await chamado.save();

    res.json({
      sucesso: true,
      mensagem: "Chamado respondido com sucesso.",
      chamado
    });
  } catch (error) {
    res.json({ erro: "Erro ao responder chamado.", detalhe: error.message });
  }
});

app.post("/suporte/:id/status", autenticar, somenteAdmin, async (req, res) => {
  try {
    const status = String(req.body.status || "").trim();
    const permitidos = ["aberto", "analise", "respondido", "fechado"];

    if (!permitidos.includes(status)) return res.json({ erro: "Status inválido." });

    const chamado = await Chamado.findById(req.params.id);

    if (!chamado) return res.json({ erro: "Chamado não encontrado." });

    chamado.status = status;

    if (status === "fechado") chamado.fechadoEm = hojeISO();

    await chamado.save();

    res.json({
      sucesso: true,
      mensagem: "Status atualizado.",
      chamado
    });
  } catch (error) {
    res.json({ erro: "Erro ao atualizar status.", detalhe: error.message });
  }
});

app.delete("/suporte/:id", autenticar, somenteAdmin, async (req, res) => {
  try {
    const chamado = await Chamado.findById(req.params.id);

    if (!chamado) return res.json({ erro: "Chamado não encontrado." });

    await Chamado.deleteOne({ _id: req.params.id });

    res.json({
      sucesso: true,
      mensagem: "Chamado excluído."
    });
  } catch (error) {
    res.json({ erro: "Erro ao excluir chamado.", detalhe: error.message });
  }
});

// ===============================
// HISTÓRICO ADMIN
// ===============================

app.post("/admin/historico", autenticar, somenteAdmin, async (req, res) => {
  try {
    const acao = String(req.body.acao || "").trim();
    const tipo = String(req.body.tipo || "geral").trim();

    if (!acao) return res.json({ erro: "Ação não informada." });

    const registro = await HistoricoAdmin.create({
      acao,
      tipo,
      adminEmail: req.user.email,
      criadoEm: hojeISO()
    });

    res.json({ sucesso: true, registro });
  } catch (error) {
    res.json({ erro: "Erro ao salvar histórico.", detalhe: error.message });
  }
});

app.get("/admin/historico", autenticar, somenteAdmin, async (req, res) => {
  try {
    const historico = await HistoricoAdmin.find().sort({ createdAt: -1 }).limit(150);
    res.json({ sucesso: true, historico });
  } catch (error) {
    res.json({ erro: "Erro ao buscar histórico.", detalhe: error.message });
  }
});

app.delete("/admin/historico", autenticar, somenteAdmin, async (req, res) => {
  try {
    await HistoricoAdmin.deleteMany({});
    res.json({ sucesso: true, mensagem: "Histórico apagado com sucesso." });
  } catch (error) {
    res.json({ erro: "Erro ao apagar histórico.", detalhe: error.message });
  }
});

// ===============================
// PROVAS
// ===============================

app.post("/provas/resultado", autenticar, async (req, res) => {
  try {
    const totalQuestoes = Number(req.body.totalQuestoes || 0);
    const acertos = Number(req.body.acertos || 0);
    const erros = Number(req.body.erros || 0);

    if (!req.body.tipoProva || totalQuestoes <= 0) {
      return res.json({ erro: "Dados da prova incompletos." });
    }

    const percentual = Math.round((acertos / totalQuestoes) * 100);

    const resultado = await ProvaResultado.create({
      aluno: req.body.aluno || req.user.email,
      email: req.user.email,
      tipoProva: req.body.tipoProva,
      titulo: req.body.titulo || req.body.tipoProva,
      nota: Number(req.body.nota || percentual),
      acertos,
      erros,
      totalQuestoes,
      percentual,
      criadoEm: hojeISO()
    });

    res.json({
      sucesso: true,
      mensagem: "Resultado salvo com sucesso.",
      resultado
    });
  } catch (error) {
    res.json({ erro: "Erro ao salvar resultado da prova.", detalhe: error.message });
  }
});

app.get("/minhas-provas", autenticar, async (req, res) => {
  try {
    const resultados = await ProvaResultado.find({ email: req.user.email })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ sucesso: true, resultados });
  } catch (error) {
    res.json({ erro: "Erro ao buscar provas.", detalhe: error.message });
  }
});

app.get("/admin/provas", autenticar, somenteAdmin, async (req, res) => {
  try {
    const resultados = await ProvaResultado.find().sort({ createdAt: -1 }).limit(500);
    res.json({ sucesso: true, resultados });
  } catch (error) {
    res.json({ erro: "Erro ao buscar resultados de provas.", detalhe: error.message });
  }
});

app.delete("/admin/provas", autenticar, somenteAdmin, async (req, res) => {
  try {
    await ProvaResultado.deleteMany({});
    res.json({ sucesso: true, mensagem: "Registros de provas apagados." });
  } catch (error) {
    res.json({ erro: "Erro ao apagar registros de provas.", detalhe: error.message });
  }
});

// ===============================
// LIMPEZA AUTOMÁTICA DA AGENDA
// ===============================

async function limparAgendaAutomatica() {
  try {
    const hoje = new Date().toISOString().split("T")[0];

    const eventos = await AgendaPrimo.find({
      status: "Agendado",
      limparApos: { $ne: "" }
    });

    for (const evento of eventos) {
      if (evento.limparApos <= hoje) {
        await AgendaPrimo.deleteOne({ _id: evento._id });
        console.log("Evento limpo automaticamente:", evento.titulo);
      }
    }
  } catch (error) {
    console.log("Erro na limpeza automática:", error.message);
  }
}

setInterval(() => {
  limparAgendaAutomatica();
}, 1000 * 60 * 60);

// ===============================
// START
// ===============================

app.listen(PORT, async () => {
  console.log("API Turma Black rodando na porta " + PORT);

  await garantirAdmin();
  await limparAgendaAutomatica();
});