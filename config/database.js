"use strict";

const mysql = require("mysql2/promise");

let pool = null;
let conectado = false;
let hostAtivo = "";

function obrigatoria(nome) {
  const valor = String(process.env[nome] || "").trim();
  if (!valor) {
    throw new Error(`${nome} não configurada.`);
  }
  return valor;
}

function normalizarHost(valor) {
  const host = String(valor || "").trim();

  // Na hospedagem Node.js da Hostinger, "localhost" pode resolver para ::1.
  // O usuário MySQL normalmente é autorizado em IPv4 local, portanto forçamos 127.0.0.1.
  if (!host || host.toLowerCase() === "localhost" || host === "::1") {
    return "127.0.0.1";
  }

  return host;
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
  const codigo = String(error?.code || "");

  if (codigo === "ER_ACCESS_DENIED_ERROR") {
    return new Error(
      `MySQL recusou o usuário '${dados.user}' no host '${dados.host}'. ` +
      "Confirme a senha, atribua o banco ao site no hPanel e garanta que esse usuário tenha acesso ao banco DB_NAME."
    );
  }

  if (codigo === "ER_BAD_DB_ERROR") {
    return new Error(
      `O banco MySQL '${dados.database}' não foi encontrado. Confira DB_NAME exatamente como aparece no hPanel.`
    );
  }

  if (["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND"].includes(codigo)) {
    return new Error(
      `Não foi possível alcançar o MySQL em ${dados.host}:${dados.port}. Confira DB_HOST e DB_PORT.`
    );
  }

  return error;
}

async function connectDatabase() {
  const host = normalizarHost(obrigatoria("DB_HOST"));
  const user = obrigatoria("DB_USER");
  const password = obrigatoria("DB_PASSWORD");
  const database = obrigatoria("DB_NAME");
  const port = Number(process.env.DB_PORT || 3306);

  hostAtivo = host;

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
      decimalNumbers: true
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

    throw traduzirErroConexao(error, dadosPublicos);
  }
}

connectDatabase.getPool = getPool;
connectDatabase.query = query;
connectDatabase.isConnected = () => conectado;
connectDatabase.getHost = () => hostAtivo;
connectDatabase.close = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
  conectado = false;
};

module.exports = connectDatabase;
