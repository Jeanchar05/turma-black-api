const PermissaoSistema = require("../models/PermissaoSistema");

const CARGOS = {
  DEV: "dev",
  DONO: "dono",
  ADMIN: "admin",
  FINANCEIRO: "financeiro",
  VENDEDOR: "vendedor",
  SUPORTE: "suporte",
  MODERADOR: "moderador",
  SUPERADMIN: "superadmin",
  ALUNO: "aluno"
};

const CHAVES_PERMISSAO = [
  "dashboard",
  "painelAdmin",
  "painelVendas",
  "financas",
  "usuarios",
  "aprovacoes",
  "controleAlunos",
  "relatorios",
  "vendedores",
  "equipe",
  "agendaPrimo",
  "notificacoes",
  "controleAdmin",
  "seguranca",
  "planos",
  "provas",
  "suporte",
  "configuracoes",
  "permissoesSistema"
];

function todas(valor = false) {
  return CHAVES_PERMISSAO.reduce((acc, chave) => {
    acc[chave] = Boolean(valor);
    return acc;
  }, {});
}

const PERMISSOES_PADRAO = {
  dev: todas(true),

  dono: {
    ...todas(true),
    permissoesSistema: false
  },

  superadmin: {
    ...todas(true),
    permissoesSistema: false
  },

  admin: {
    ...todas(false),
    dashboard: true,
    painelAdmin: true,
    painelVendas: true,
    usuarios: true,
    aprovacoes: true,
    controleAlunos: true,
    relatorios: true,
    vendedores: true,
    equipe: true,
    notificacoes: true,
    provas: true,
    suporte: true
  },

  financeiro: {
    ...todas(false),
    dashboard: true,
    painelVendas: true,
    financas: true,
    relatorios: true
  },

  vendedor: {
    ...todas(false),
    dashboard: true,
    painelVendas: true
  },

  moderador: {
    ...todas(false),
    dashboard: true,
    painelAdmin: true,
    usuarios: true,
    aprovacoes: true,
    provas: true,
    suporte: true
  },

  suporte: {
    ...todas(false),
    dashboard: true,
    suporte: true
  },

  aluno: {
    ...todas(false),
    dashboard: true,
    suporte: true
  }
};

function normalizarCargo(valor) {
  const cargo = String(valor || "aluno")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-");

  const mapa = {
    "super-admin": "superadmin",
    proprietario: "dono",
    owner: "dono",
    developer: "dev",
    finance: "financeiro"
  };

  return mapa[cargo] || cargo;
}

function getCargo(usuario) {
  if (!usuario) return CARGOS.ALUNO;
  if (usuario.contaDev === true) return CARGOS.DEV;

  const cargo = normalizarCargo(usuario.cargo || usuario.tipo);
  return PERMISSOES_PADRAO[cargo] ? cargo : CARGOS.ALUNO;
}

function sanitizarPermissoes(valor = {}) {
  return CHAVES_PERMISSAO.reduce((acc, chave) => {
    if (typeof valor?.[chave] === "boolean") {
      acc[chave] = valor[chave];
    }
    return acc;
  }, {});
}

function getPermissoes(usuario) {
  const cargo = getCargo(usuario);
  const base = PERMISSOES_PADRAO[cargo] || PERMISSOES_PADRAO.aluno;
  const personalizadas = sanitizarPermissoes(usuario?.permissoesPersonalizadas || {});

  if (cargo === CARGOS.DEV) {
    return { ...PERMISSOES_PADRAO.dev };
  }

  return { ...base, ...personalizadas };
}

async function getPermissoesEfetivas(usuario) {
  const cargo = getCargo(usuario);

  if (cargo === CARGOS.DEV) {
    return { ...PERMISSOES_PADRAO.dev };
  }

  const base = PERMISSOES_PADRAO[cargo] || PERMISSOES_PADRAO.aluno;
  let configuradas = {};

  try {
    const registro = await PermissaoSistema.obter();
    configuradas = sanitizarPermissoes(registro?.matriz?.[cargo] || {});
  } catch (error) {
    console.warn("Falha ao carregar matriz dinâmica de permissões:", error.message);
  }

  const personalizadas = sanitizarPermissoes(usuario?.permissoesPersonalizadas || {});

  return {
    ...base,
    ...configuradas,
    ...personalizadas
  };
}

function temPermissao(usuario, permissao) {
  if (!usuario || !permissao) return false;
  if (getCargo(usuario) === CARGOS.DEV) return true;
  return Boolean(getPermissoes(usuario)[permissao]);
}

async function temPermissaoEfetiva(usuario, permissao) {
  if (!usuario || !permissao) return false;
  if (getCargo(usuario) === CARGOS.DEV) return true;
  const permissoes = await getPermissoesEfetivas(usuario);
  return Boolean(permissoes[permissao]);
}

function temCargo(usuario, cargosPermitidos = []) {
  if (!usuario) return false;
  const cargo = getCargo(usuario);
  if (cargo === CARGOS.DEV) return true;
  return cargosPermitidos.map(normalizarCargo).includes(cargo);
}

function requirePermission(permissao) {
  return async function (req, res, next) {
    try {
      if (!req.usuario) {
        return res.status(401).json({ erro: "Usuário não autenticado." });
      }

      const permitido = await temPermissaoEfetiva(req.usuarioDoc || req.usuario, permissao);

      if (!permitido) {
        return res.status(403).json({
          erro: "Você não tem permissão para acessar esta área.",
          permissaoNecessaria: permissao,
          cargoAtual: getCargo(req.usuario)
        });
      }

      next();
    } catch (error) {
      console.error("Erro ao validar permissão:", error);
      return res.status(500).json({ erro: "Erro interno ao validar permissão." });
    }
  };
}

function requireCargo(...cargosPermitidos) {
  return function (req, res, next) {
    if (!req.usuario) {
      return res.status(401).json({ erro: "Usuário não autenticado." });
    }

    if (!temCargo(req.usuario, cargosPermitidos)) {
      return res.status(403).json({
        erro: "Cargo sem permissão para acessar esta área.",
        cargosPermitidos,
        cargoAtual: getCargo(req.usuario)
      });
    }

    next();
  };
}

function requireDev(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({ erro: "Usuário não autenticado." });
  }

  const cargo = getCargo(req.usuarioDoc || req.usuario);
  const emailDev = String(process.env.DEV_EMAIL || "dev@turmablack.com").toLowerCase();
  const emailAtual = String(req.usuario.email || "").toLowerCase();

  if (cargo !== CARGOS.DEV && emailAtual !== emailDev) {
    return res.status(403).json({ erro: "Área exclusiva da conta Dev." });
  }

  next();
}

function requireAdmin(req, res, next) {
  return requireCargo(CARGOS.DONO, CARGOS.ADMIN, CARGOS.MODERADOR)(req, res, next);
}

function requireSuperAdmin(req, res, next) {
  return requireCargo(CARGOS.DONO, CARGOS.SUPERADMIN)(req, res, next);
}

function requireVendedor(req, res, next) {
  return requireCargo(
    CARGOS.DONO,
    CARGOS.ADMIN,
    CARGOS.FINANCEIRO,
    CARGOS.VENDEDOR
  )(req, res, next);
}

function requireSuporte(req, res, next) {
  return requireCargo(
    CARGOS.DONO,
    CARGOS.ADMIN,
    CARGOS.MODERADOR,
    CARGOS.SUPORTE
  )(req, res, next);
}

module.exports = {
  CARGOS,
  CHAVES_PERMISSAO,
  PERMISSOES_PADRAO,
  normalizarCargo,
  sanitizarPermissoes,
  getCargo,
  getPermissoes,
  getPermissoesEfetivas,
  temPermissao,
  temPermissaoEfetiva,
  temCargo,
  requirePermission,
  requireCargo,
  requireDev,
  requireAdmin,
  requireSuperAdmin,
  requireVendedor,
  requireSuporte
};
