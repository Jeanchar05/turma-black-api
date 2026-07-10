/* ===============================
   CARGOS
=============================== */

const CARGOS = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  MODERADOR: "moderador",
  SUPORTE: "suporte",
  VENDEDOR: "vendedor",
  ALUNO: "aluno"
};

/* ===============================
   PERMISSÕES PADRÃO
=============================== */

const PERMISSOES_PADRAO = {
  superadmin: {
    dashboard: true,
    painelAdmin: true,
    painelVendas: true,
    usuarios: true,
    aprovacoes: true,
    controleAlunos: true,
    relatorios: true,
    vendedores: true,
    agendaPrimo: true,
    notificacoes: true,
    controleAdmin: true,
    seguranca: true,
    planos: true,
    provas: true,
    suporte: true
  },

  admin: {
    dashboard: true,
    painelAdmin: true,
    painelVendas: true,
    usuarios: true,
    aprovacoes: true,
    controleAlunos: true,
    relatorios: false,
    vendedores: true,
    agendaPrimo: false,
    notificacoes: true,
    controleAdmin: false,
    seguranca: false,
    planos: true,
    provas: true,
    suporte: true
  },

  moderador: {
    dashboard: true,
    painelAdmin: true,
    painelVendas: false,
    usuarios: true,
    aprovacoes: true,
    controleAlunos: false,
    relatorios: false,
    vendedores: false,
    agendaPrimo: false,
    notificacoes: false,
    controleAdmin: false,
    seguranca: false,
    planos: false,
    provas: true,
    suporte: true
  },

  suporte: {
    dashboard: true,
    painelAdmin: false,
    painelVendas: true,
    usuarios: false,
    aprovacoes: false,
    controleAlunos: false,
    relatorios: false,
    vendedores: false,
    agendaPrimo: false,
    notificacoes: false,
    controleAdmin: false,
    seguranca: false,
    planos: false,
    provas: false,
    suporte: true
  },

  vendedor: {
    dashboard: true,
    painelAdmin: false,
    painelVendas: true,
    usuarios: false,
    aprovacoes: false,
    controleAlunos: false,
    relatorios: false,
    vendedores: false,
    agendaPrimo: false,
    notificacoes: false,
    controleAdmin: false,
    seguranca: false,
    planos: false,
    provas: false,
    suporte: false
  },

  aluno: {
    dashboard: true,
    painelAdmin: false,
    painelVendas: false,
    usuarios: false,
    aprovacoes: false,
    controleAlunos: false,
    relatorios: false,
    vendedores: false,
    agendaPrimo: false,
    notificacoes: false,
    controleAdmin: false,
    seguranca: false,
    planos: false,
    provas: false,
    suporte: true
  }
};

/* ===============================
   HELPERS
=============================== */

function getCargo(usuario) {
  if (!usuario) return CARGOS.ALUNO;

  if (usuario.cargo) {
    return usuario.cargo;
  }

  if (usuario.tipo === "admin") {
    return CARGOS.ADMIN;
  }

  return CARGOS.ALUNO;
}

function getPermissoes(usuario) {
  const cargo = getCargo(usuario);

  return PERMISSOES_PADRAO[cargo] || PERMISSOES_PADRAO.aluno;
}

function temPermissao(usuario, permissao) {
  if (!usuario || !permissao) return false;

  const cargo = getCargo(usuario);

  if (cargo === CARGOS.SUPERADMIN) {
    return true;
  }

  const permissoes = getPermissoes(usuario);

  return Boolean(permissoes[permissao]);
}

function temCargo(usuario, cargosPermitidos = []) {
  if (!usuario) return false;

  const cargo = getCargo(usuario);

  if (cargo === CARGOS.SUPERADMIN) {
    return true;
  }

  return cargosPermitidos.includes(cargo);
}

/* ===============================
   MIDDLEWARES
=============================== */

function requirePermission(permissao) {
  return function (req, res, next) {
    if (!req.usuario) {
      return res.status(401).json({
        erro: "Usuário não autenticado."
      });
    }

    if (!temPermissao(req.usuario, permissao)) {
      return res.status(403).json({
        erro: "Você não tem permissão para acessar esta área.",
        permissaoNecessaria: permissao,
        cargoAtual: getCargo(req.usuario)
      });
    }

    next();
  };
}

function requireCargo(...cargosPermitidos) {
  return function (req, res, next) {
    if (!req.usuario) {
      return res.status(401).json({
        erro: "Usuário não autenticado."
      });
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

function requireAdmin(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({
      erro: "Usuário não autenticado."
    });
  }

  const permitido = temCargo(req.usuario, [
    CARGOS.ADMIN,
    CARGOS.MODERADOR,
    CARGOS.SUPORTE
  ]);

  if (!permitido) {
    return res.status(403).json({
      erro: "Acesso permitido apenas para equipe administrativa.",
      cargoAtual: getCargo(req.usuario)
    });
  }

  next();
}

function requireSuperAdmin(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({
      erro: "Usuário não autenticado."
    });
  }

  if (getCargo(req.usuario) !== CARGOS.SUPERADMIN) {
    return res.status(403).json({
      erro: "Acesso permitido apenas para Super Admin.",
      cargoAtual: getCargo(req.usuario)
    });
  }

  next();
}

function requireVendedor(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({
      erro: "Usuário não autenticado."
    });
  }

  const cargo = getCargo(req.usuario);

  const permitido =
    cargo === CARGOS.SUPERADMIN ||
    cargo === CARGOS.ADMIN ||
    cargo === CARGOS.VENDEDOR ||
    req.usuario.vendedor === true;

  if (!permitido) {
    return res.status(403).json({
      erro: "Acesso permitido apenas para vendedores.",
      cargoAtual: cargo
    });
  }

  next();
}

function requireSuporte(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({
      erro: "Usuário não autenticado."
    });
  }

  const permitido = temCargo(req.usuario, [
    CARGOS.SUPORTE,
    CARGOS.ADMIN,
    CARGOS.MODERADOR
  ]);

  if (!permitido) {
    return res.status(403).json({
      erro: "Acesso permitido apenas para suporte.",
      cargoAtual: getCargo(req.usuario)
    });
  }

  next();
}

module.exports = {
  CARGOS,
  PERMISSOES_PADRAO,
  getCargo,
  getPermissoes,
  temPermissao,
  temCargo,
  requirePermission,
  requireCargo,
  requireAdmin,
  requireSuperAdmin,
  requireVendedor,
  requireSuporte
};
