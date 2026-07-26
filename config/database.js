"use strict";

const mysql = require("mysql2/promise");

let pool = null;
let conectado = false;
let hostAtivo = "";
let ultimoDiagnostico = {
  carregadoEm: "",
  host: "",
  port: 3306,
  passwordSource: "DB_PASSWORD",
  passwordRawLength: 0,
  passwordLength: 0,
  passwordInvisibleCharsRemoved: 0,
  passwordHadOuterQuotes: false,
  passwordHadEdgeWhitespace: false,
  lastErrorCode: "",
  lastErrorMessage: ""
};

const CARACTERES_INVISIVEIS = /[\u200B-\u200D\u2060\uFEFF]/g;

function removerCaracteresInvisiveis(valor) {
  const original = String(valor ?? "");
  const encontrados = original.match(CARACTERES_INVISIVEIS) || [];

  return {
    valor: original.replace(CARACTERES_INVISIVEIS, ""),
    removidos: encontrados.length
  };
}

function obrigatoria(nome) {
  const bruto = String(process.env[nome] || "");
  const limpo = removerCaracteresInvisiveis(bruto).valor.trim();

  if (!limpo) {
    const error = new Error(`${nome} não configurada.`);
    error.code = "ENV_MISSING";
    throw error;
  }

  return limpo;
}

function normalizarHost(valor) {
  const host = removerCaracteresInvisiveis(valor || "localhost").valor.trim();
  return host || "localhost";
}

function removerAspasExternas(valor) {
  if (valor.length < 2) return { valor, removidas: false };

  const primeira = valor[0];
  const ultima = valor[valor.length - 1];
  const parValido =
    (primeira === '"' && ultima === '"') ||
    (primeira === "'" && ultima === "'");

  return parValido
    ? { valor: valor.slice(1, -1), removidas: true }
    : { valor, removidas: false };
}

function lerSenha() {
  const base64Bruto = String(process.env.DB_PASSWORD_BASE64 || "");
  const base64Limpo = removerCaracteresInvisiveis(base64Bruto).valor.trim();

  if (base64Limpo) {
    let senha;

    try {
      senha = Buffer.from(base64Limpo, "base64").toString("utf8");
    } catch (_) {
      const error = new Error("DB_PASSWORD_BASE64 inválida.");
      error.code = "ENV_INVALID";
      throw error;
    }

    const normalizada = removerCaracteresInvisiveis(senha);

    if (!normalizada.valor) {
      const error = new Error("DB_PASSWORD_BASE64 resultou em uma senha vazia.");
      error.code = "ENV_INVALID";
      throw error;
    }

    return {
      password: normalizada.valor,
      source: "DB_PASSWORD_BASE64",
      rawLength: senha.length,
      invisibleCharsRemoved: normalizada.removidos,
      hadOuterQuotes: false,
      hadEdgeWhitespace: /^\s|\s$/.test(normalizada.valor)
    };
  }

  const bruto = process.env.DB_PASSWORD;

  if (bruto === undefined || bruto === null || String(bruto).length === 0) {
    const error = new Error("DB_PASSWORD não configurada.");
    error.code = "ENV_MISSING";
    throw error;
  }

  const original = String(bruto);
  const semInvisiveis = removerCaracteresInvisiveis(original);
  const hadEdgeWhitespace = /^\s|\s$/.test(semInvisiveis.valor);
  const semEspacosExternos = semInvisiveis.valor.trim();
  const resultadoAspas = removerAspasExternas(semEspacosExternos);

  if (!resultadoAspas.valor) {
    const error = new Error("DB_PASSWORD ficou vazia após a normalização.");
    error.code = "ENV_INVALID";
    throw error;
  }

  return {
    password: resultadoAspas.valor,
    source: "DB_PASSWORD",
    rawLength: original.length,
    invisibleCharsRemoved: semInvisiveis.removidos,
    hadOuterQuotes: resultadoAspas.removidas,
    hadEdgeWhitespace
  };
}

function getPool() {
  if (!pool) {
    throw new Error("Banco MySQL ainda não inicializado.");
  }
  return pool;
}

async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

async function garantirEstrutura() {
  await query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id CHAR(24) NOT NULL PRIMARY KEY,
      nome VARCHAR(160) NOT NULL DEFAULT '',
      email VARCHAR(190) NOT NULL,
      senha VARCHAR(255) NOT NULL,
      tipo VARCHAR(24) NOT NULL DEFAULT 'aluno',
      cargo VARCHAR(32) NOT NULL DEFAULT 'aluno',
      conta_dev TINYINT(1) NOT NULL DEFAULT 0,
      permissoes_personalizadas LONGTEXT NULL,
      vendedor TINYINT(1) NOT NULL DEFAULT 0,
      comissao DECIMAL(8,2) NOT NULL DEFAULT 20.00,
      aprovado TINYINT(1) NOT NULL DEFAULT 0,
      suspenso TINYINT(1) NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'pendente',
      codigo VARCHAR(64) NOT NULL DEFAULT '',
      plano VARCHAR(32) NOT NULL DEFAULT 'free',
      data_expiracao VARCHAR(40) NOT NULL DEFAULT '',
      telefone VARCHAR(40) NOT NULL DEFAULT '',
      foto LONGTEXT NULL,
      acessos INT NOT NULL DEFAULT 0,
      dispositivos LONGTEXT NULL,
      ultimo_login VARCHAR(40) NOT NULL DEFAULT '',
      aprovado_em VARCHAR(40) NOT NULL DEFAULT '',
      criado_por VARCHAR(190) NOT NULL DEFAULT '',
      atualizado_por VARCHAR(190) NOT NULL DEFAULT '',
      extras LONGTEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_usuarios_email (email),
      KEY idx_usuarios_cargo (cargo),
      KEY idx_usuarios_status (status),
      KEY idx_usuarios_plano (plano),
      KEY idx_usuarios_codigo (codigo),
      KEY idx_usuarios_conta_dev (conta_dev)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS permissoes_sistema (
      chave VARCHAR(80) NOT NULL PRIMARY KEY,
      matriz LONGTEXT NULL,
      historico LONGTEXT NULL,
      atualizado_por VARCHAR(190) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS system_migrations (
      id VARCHAR(120) NOT NULL PRIMARY KEY,
      dados LONGTEXT NULL,
      executada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function traduzirErroConexao(error, dados) {
  const codigo = String(error?.code || "MYSQL_UNKNOWN");
  let traduzido = error;

  if (codigo === "ER_ACCESS_DENIED_ERROR") {
    traduzido = new Error(
      `MySQL recusou o usuário '${dados.user}' no host '${dados.host}'. ` +
      "A aplicação carregou as variáveis, mas a combinação usuário/senha não foi aceita."
    );
  } else if (codigo === "ER_BAD_DB_ERROR") {
    traduzido = new Error(
      `O banco MySQL '${dados.database}' não foi encontrado. Confira DB_NAME exatamente como aparece no hPanel.`
    );
  } else if (["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND"].includes(codigo)) {
    traduzido = new Error(
      `Não foi possível alcançar o MySQL em ${dados.host}:${dados.port}. Confira DB_HOST e DB_PORT.`
    );
  }

  traduzido.code = codigo;
  traduzido.originalMessage = String(error?.message || "");
  return traduzido;
}

async function connectDatabase() {
  const host = normalizarHost(process.env.DB_HOST || "localhost");
  const user = obrigatoria("DB_USER");
  const senhaInfo = lerSenha();
  const password = senhaInfo.password;
  const database = obrigatoria("DB_NAME");
  const port = Number(process.env.DB_PORT || 3306);

  hostAtivo = host;
  ultimoDiagnostico = {
    carregadoEm: new Date().toISOString(),
    host,
    port,
    passwordSource: senhaInfo.source,
    passwordRawLength: senhaInfo.rawLength,
    passwordLength: password.length,
    passwordInvisibleCharsRemoved: senhaInfo.invisibleCharsRemoved,
    passwordHadOuterQuotes: senhaInfo.hadOuterQuotes,
    passwordHadEdgeWhitespace: senhaInfo.hadEdgeWhitespace,
    lastErrorCode: "",
    lastErrorMessage: ""
  };

  const dadosPublicos = { host, port, user, database };

  try {
    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      charset: "utf8mb4",
      timezone: "Z",
      dateStrings: true,
      decimalNumbers: true,
      connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 10000)
    });

    const conexao = await pool.getConnection();

    try {
      await conexao.ping();
    } finally {
      conexao.release();
    }

    conectado = true;
    await garantirEstrutura();

    const bootstrapDevAccount = require("../services/bootstrap-dev");
    await bootstrapDevAccount();

    console.log(`MySQL conectado com sucesso em ${host}:${port}`);
    return pool;
  } catch (error) {
    conectado = false;

    if (pool) {
      try {
        await pool.end();
      } catch (_) {}
      pool = null;
    }

    const traduzido = traduzirErroConexao(error, dadosPublicos);
    ultimoDiagnostico.lastErrorCode = traduzido.code || "MYSQL_UNKNOWN";
    ultimoDiagnostico.lastErrorMessage = traduzido.message;
    throw traduzido;
  }
}

connectDatabase.getPool = getPool;
connectDatabase.query = query;
connectDatabase.isConnected = () => conectado;
connectDatabase.getHost = () => hostAtivo;
connectDatabase.getDiagnostics = () => ({ ...ultimoDiagnostico });
connectDatabase.close = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
  conectado = false;
};

module.exports = connectDatabase;
