"use strict";

const express = require("express");
const crypto = require("crypto");

const database = require("../config/database");
const Usuario = require("../models/Usuario");
const { auth } = require("../middleware/auth");
const {
  requirePermission,
  requireDev,
  getCargo
} = require("../middleware/permissions");

const router = express.Router();
let estruturaPromise = null;

const PLANOS_PADRAO = [
  ["black30", "Black 30", "Acesso completo por 30 dias", 97, 30, 1, 1],
  ["black90", "Black 90", "Acesso completo por 90 dias", 297, 90, 1, 2],
  ["black180", "Black 180", "Acesso completo por 180 dias", 597, 180, 1, 3],
  ["black360", "Black 360", "Acesso completo por 12 meses", 897, 360, 1, 4],
  ["particular", "VIP Mentoria", "Acesso e acompanhamento particular", 1497, 30, 1, 5]
];

const PAGAMENTOS_PADRAO = [
  ["pix", "PIX", 0, 1],
  ["cartao_credito", "Cartão de crédito", 0, 1],
  ["cartao_debito", "Cartão de débito", 0, 1],
  ["boleto", "Boleto", 0, 1],
  ["dinheiro", "Dinheiro", 0, 1],
  ["transferencia", "Transferência", 0, 1]
];

function id24() {
  return crypto.randomBytes(12).toString("hex");
}

function agoraSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function hojeSql() {
  return new Date().toISOString().slice(0, 10);
}

function texto(valor, limite = 500) {
  return String(valor ?? "").trim().slice(0, limite);
}

function email(valor) {
  return texto(valor, 190).toLowerCase();
}

function numero(valor, padrao = 0) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : padrao;
}

function moeda(valor) {
  return Number(numero(valor).toFixed(2));
}

function booleano(valor, padrao = false) {
  if (valor === undefined || valor === null || valor === "") return padrao;
  if (typeof valor === "boolean") return valor;
  return ["1", "true", "sim", "on", "ativo"].includes(String(valor).toLowerCase());
}

function normalizarStatus(valor) {
  const status = texto(valor, 30).toLowerCase().replaceAll(" ", "_");
  return ["pendente", "pago", "cancelado", "estornado"].includes(status)
    ? status
    : "pendente";
}

function normalizarCodigo(valor) {
  return texto(valor, 60)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizarPlano(valor) {
  const codigo = normalizarCodigo(valor);
  const mapa = {
    black: "black30",
    premium: "black30",
    mensal: "black30",
    trimestral: "black90",
    semestral: "black180",
    anual: "black360",
    mentoria: "particular",
    vip: "particular"
  };
  return mapa[codigo] || codigo || "black30";
}

function dataMaisDias(dataBase, dias) {
  const base = dataBase ? new Date(dataBase) : new Date();
  if (Number.isNaN(base.getTime()) || base < new Date()) base.setTime(Date.now());
  base.setDate(base.getDate() + Math.max(0, Number(dias || 0)));
  return base.toISOString().slice(0, 10);
}

function cargoTemVisaoCompleta(usuario) {
  const cargo = getCargo(usuario);
  return ["dev", "dono", "superadmin", "admin", "financeiro"].includes(cargo);
}

function vendedorIdAtual(req) {
  return String(req.usuario?._id || req.usuario?.id || req.usuarioDoc?._id || "");
}

async function criarEstrutura() {
  await database.query(`
    CREATE TABLE IF NOT EXISTS produtos_planos (
      id CHAR(24) NOT NULL PRIMARY KEY,
      codigo VARCHAR(60) NOT NULL UNIQUE,
      nome VARCHAR(160) NOT NULL,
      descricao VARCHAR(600) NOT NULL DEFAULT '',
      preco DECIMAL(12,2) NOT NULL DEFAULT 0,
      duracao_dias INT NOT NULL DEFAULT 30,
      status TINYINT(1) NOT NULL DEFAULT 1,
      destaque TINYINT(1) NOT NULL DEFAULT 0,
      ordem INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_produtos_status (status),
      KEY idx_produtos_ordem (ordem)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await database.query(`
    CREATE TABLE IF NOT EXISTS formas_pagamento (
      id CHAR(24) NOT NULL PRIMARY KEY,
      codigo VARCHAR(60) NOT NULL UNIQUE,
      nome VARCHAR(120) NOT NULL,
      taxa_percentual DECIMAL(7,3) NOT NULL DEFAULT 0,
      status TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_pagamentos_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await database.query(`
    CREATE TABLE IF NOT EXISTS cupons_desconto (
      id CHAR(24) NOT NULL PRIMARY KEY,
      codigo VARCHAR(60) NOT NULL UNIQUE,
      tipo VARCHAR(20) NOT NULL DEFAULT 'percentual',
      valor DECIMAL(12,2) NOT NULL DEFAULT 0,
      limite_usos INT NOT NULL DEFAULT 0,
      usos INT NOT NULL DEFAULT 0,
      valido_ate DATETIME NULL,
      status TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_cupons_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await database.query(`
    CREATE TABLE IF NOT EXISTS vendas_configuracoes (
      chave VARCHAR(80) NOT NULL PRIMARY KEY,
      valor LONGTEXT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await database.query(`
    CREATE TABLE IF NOT EXISTS vendas (
      id CHAR(24) NOT NULL PRIMARY KEY,
      cliente_id CHAR(24) NOT NULL DEFAULT '',
      cliente_nome VARCHAR(160) NOT NULL DEFAULT '',
      cliente_email VARCHAR(190) NOT NULL DEFAULT '',
      cliente_telefone VARCHAR(40) NOT NULL DEFAULT '',
      vendedor_id CHAR(24) NOT NULL DEFAULT '',
      vendedor_nome VARCHAR(160) NOT NULL DEFAULT '',
      vendedor_email VARCHAR(190) NOT NULL DEFAULT '',
      produto_id CHAR(24) NOT NULL DEFAULT '',
      produto_codigo VARCHAR(60) NOT NULL DEFAULT '',
      produto_nome VARCHAR(160) NOT NULL DEFAULT '',
      valor_bruto DECIMAL(12,2) NOT NULL DEFAULT 0,
      desconto DECIMAL(12,2) NOT NULL DEFAULT 0,
      valor DECIMAL(12,2) NOT NULL DEFAULT 0,
      forma_pagamento VARCHAR(80) NOT NULL DEFAULT 'pix',
      parcelas INT NOT NULL DEFAULT 1,
      status VARCHAR(30) NOT NULL DEFAULT 'pendente',
      porcentagem_comissao DECIMAL(7,3) NOT NULL DEFAULT 20,
      comissao DECIMAL(12,2) NOT NULL DEFAULT 0,
      comissao_status VARCHAR(30) NOT NULL DEFAULT 'prevista',
      cupom_codigo VARCHAR(60) NOT NULL DEFAULT '',
      data_venda DATE NOT NULL,
      pago_em DATETIME NULL,
      cancelado_em DATETIME NULL,
      observacoes LONGTEXT NULL,
      origem VARCHAR(50) NOT NULL DEFAULT 'painel-vendas',
      criado_por VARCHAR(190) NOT NULL DEFAULT '',
      atualizado_por VARCHAR(190) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_vendas_cliente (cliente_id),
      KEY idx_vendas_vendedor (vendedor_id),
      KEY idx_vendas_status (status),
      KEY idx_vendas_data (data_venda),
      KEY idx_vendas_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await database.query(`
    CREATE TABLE IF NOT EXISTS vendas_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      venda_id CHAR(24) NOT NULL DEFAULT '',
      usuario_id CHAR(24) NOT NULL DEFAULT '',
      usuario_email VARCHAR(190) NOT NULL DEFAULT '',
      acao VARCHAR(80) NOT NULL,
      detalhes LONGTEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_vendas_logs_venda (venda_id),
      KEY idx_vendas_logs_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  for (const [codigo, nome, descricao, preco, duracao, status, ordem] of PLANOS_PADRAO) {
    await database.query(
      `INSERT IGNORE INTO produtos_planos
       (id, codigo, nome, descricao, preco, duracao_dias, status, ordem)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id24(), codigo, nome, descricao, preco, duracao, status, ordem]
    );
  }

  for (const [codigo, nome, taxa, status] of PAGAMENTOS_PADRAO) {
    await database.query(
      `INSERT IGNORE INTO formas_pagamento
       (id, codigo, nome, taxa_percentual, status)
       VALUES (?, ?, ?, ?, ?)`,
      [id24(), codigo, nome, taxa, status]
    );
  }

  await database.query(
    "INSERT IGNORE INTO vendas_configuracoes (chave, valor) VALUES ('comissao_padrao', '20')"
  );
}

async function garantirEstrutura() {
  if (!estruturaPromise) {
    estruturaPromise = criarEstrutura().catch((error) => {
      estruturaPromise = null;
      throw error;
    });
  }
  return estruturaPromise;
}

async function registrarLog(req, vendaId, acao, detalhes = {}) {
  try {
    await database.query(
      `INSERT INTO vendas_logs
       (venda_id, usuario_id, usuario_email, acao, detalhes)
       VALUES (?, ?, ?, ?, ?)`,
      [
        vendaId || "",
        vendedorIdAtual(req),
        req.usuario?.email || "",
        acao,
        JSON.stringify(detalhes || {})
      ]
    );
  } catch (error) {
    console.warn("Falha ao registrar log de vendas:", error.message);
  }
}

async function obterConfiguracao(chave, fallback = "") {
  const rows = await database.query(
    "SELECT valor FROM vendas_configuracoes WHERE chave = ? LIMIT 1",
    [chave]
  );
  return rows[0]?.valor ?? fallback;
}

function formatarProduto(row) {
  return {
    id: row.id,
    codigo: row.codigo,
    nome: row.nome,
    descricao: row.descricao || "",
    preco: moeda(row.preco),
    duracaoDias: Number(row.duracao_dias || 0),
    ativo: Boolean(Number(row.status || 0)),
    destaque: Boolean(Number(row.destaque || 0)),
    ordem: Number(row.ordem || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function formatarPagamento(row) {
  return {
    id: row.id,
    codigo: row.codigo,
    nome: row.nome,
    taxaPercentual: numero(row.taxa_percentual),
    ativo: Boolean(Number(row.status || 0)),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function formatarCupom(row) {
  return {
    id: row.id,
    codigo: row.codigo,
    tipo: row.tipo,
    valor: moeda(row.valor),
    limiteUsos: Number(row.limite_usos || 0),
    usos: Number(row.usos || 0),
    validoAte: row.valido_ate || "",
    ativo: Boolean(Number(row.status || 0)),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function formatarVenda(row) {
  return {
    id: row.id,
    _id: row.id,
    clienteId: row.cliente_id || "",
    clienteNome: row.cliente_nome || "",
    clienteEmail: row.cliente_email || "",
    clienteTelefone: row.cliente_telefone || "",
    alunoId: row.cliente_id || "",
    alunoNome: row.cliente_nome || "",
    alunoEmail: row.cliente_email || "",
    alunoTelefone: row.cliente_telefone || "",
    vendedorId: row.vendedor_id || "",
    vendedorNome: row.vendedor_nome || "",
    vendedorEmail: row.vendedor_email || "",
    produtoId: row.produto_id || "",
    produtoCodigo: row.produto_codigo || "",
    produtoNome: row.produto_nome || "",
    plano: row.produto_codigo || "",
    valorBruto: moeda(row.valor_bruto),
    desconto: moeda(row.desconto),
    valor: moeda(row.valor),
    formaPagamento: row.forma_pagamento || "pix",
    parcelas: Number(row.parcelas || 1),
    status: row.status || "pendente",
    porcentagemComissao: numero(row.porcentagem_comissao),
    comissao: moeda(row.comissao),
    comissaoStatus: row.comissao_status || "prevista",
    cupomCodigo: row.cupom_codigo || "",
    dataVenda: row.data_venda || "",
    pagoEm: row.pago_em || "",
    canceladoEm: row.cancelado_em || "",
    observacoes: row.observacoes || "",
    origem: row.origem || "painel-vendas",
    criadoPor: row.criado_por || "",
    atualizadoPor: row.atualizado_por || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

async function buscarUsuarioCliente(body) {
  const clienteId = texto(body.clienteId || body.alunoId, 24);
  const clienteEmail = email(body.clienteEmail || body.alunoEmail);
  let usuario = null;
  if (clienteId) usuario = await Usuario.findById(clienteId);
  if (!usuario && clienteEmail) usuario = await Usuario.findOne({ email: clienteEmail });
  return usuario;
}

async function buscarVendedor(body, req) {
  const podeEscolher = cargoTemVisaoCompleta(req.usuario);
  if (!podeEscolher) return req.usuarioDoc || req.usuario;
  const id = texto(body.vendedorId, 24);
  const vendedorEmail = email(body.vendedorEmail);
  let usuario = null;
  if (id) usuario = await Usuario.findById(id);
  if (!usuario && vendedorEmail) usuario = await Usuario.findOne({ email: vendedorEmail });
  return usuario || req.usuarioDoc || req.usuario;
}

async function buscarProduto(body) {
  const produtoId = texto(body.produtoId, 24);
  const codigo = normalizarPlano(body.produtoCodigo || body.plano);
  let rows = [];
  if (produtoId) rows = await database.query("SELECT * FROM produtos_planos WHERE id = ? LIMIT 1", [produtoId]);
  if (!rows.length && codigo) rows = await database.query("SELECT * FROM produtos_planos WHERE codigo = ? LIMIT 1", [codigo]);
  return rows[0] || null;
}

async function calcularCupom(codigoInformado, valorBruto) {
  const codigo = texto(codigoInformado, 60).toUpperCase();
  if (!codigo) return { codigo: "", desconto: 0, cupom: null };
  const rows = await database.query(
    `SELECT * FROM cupons_desconto
      WHERE UPPER(codigo) = ? AND status = 1
        AND (valido_ate IS NULL OR valido_ate >= NOW())
        AND (limite_usos = 0 OR usos < limite_usos)
      LIMIT 1`,
    [codigo]
  );
  const cupom = rows[0];
  if (!cupom) throw new Error("Cupom inválido, expirado ou sem usos disponíveis.");
  const desconto = cupom.tipo === "fixo"
    ? Math.min(valorBruto, numero(cupom.valor))
    : Math.min(valorBruto, (valorBruto * numero(cupom.valor)) / 100);
  return { codigo: cupom.codigo, desconto: moeda(desconto), cupom };
}

async function aplicarPlanoAoUsuario(venda) {
  if (venda.status !== "pago") return;
  let usuario = null;
  if (venda.clienteId) usuario = await Usuario.findById(venda.clienteId);
  if (!usuario && venda.clienteEmail) usuario = await Usuario.findOne({ email: venda.clienteEmail });
  if (!usuario) return;
  const produtos = await database.query(
    "SELECT duracao_dias FROM produtos_planos WHERE codigo = ? LIMIT 1",
    [venda.produtoCodigo]
  );
  const dias = Number(produtos[0]?.duracao_dias || 30);
  const expira = dataMaisDias(usuario.dataExpiracao, dias);
  await Usuario.updateOne(
    { _id: usuario._id },
    { $set: { plano: venda.produtoCodigo || "black30", status: "ativo", aprovado: true, suspenso: false, dataExpiracao: expira, aprovadoEm: new Date().toISOString() } }
  );
}

async function montarVenda(body, req, vendaAtual = null) {
  const produto = await buscarProduto(body);
  if (!produto) throw new Error("Produto ou plano não encontrado.");
  const cliente = await buscarUsuarioCliente(body);
  const vendedor = await buscarVendedor(body, req);
  const valorBruto = moeda(body.valorBruto ?? body.valor ?? produto.preco);
  const cupom = await calcularCupom(body.cupomCodigo, valorBruto);
  const descontoManual = cargoTemVisaoCompleta(req.usuario) ? Math.max(0, moeda(body.descontoManual || 0)) : 0;
  const desconto = Math.min(valorBruto, moeda(cupom.desconto + descontoManual));
  const valorFinal = Math.max(0, moeda(valorBruto - desconto));
  const comissaoPadrao = numero(await obterConfiguracao("comissao_padrao", "20"), 20);
  const porcentagem = cargoTemVisaoCompleta(req.usuario)
    ? Math.max(0, numero(body.porcentagemComissao, comissaoPadrao))
    : numero(vendedor?.comissao, comissaoPadrao);
  const status = normalizarStatus(body.status ?? vendaAtual?.status);
  const clienteNome = texto(body.clienteNome || body.alunoNome || cliente?.nome, 160);
  const clienteEmail = email(body.clienteEmail || body.alunoEmail || cliente?.email);
  const clienteTelefone = texto(body.clienteTelefone || body.alunoTelefone || cliente?.telefone, 40);
  if (!clienteNome) throw new Error("Informe o nome do cliente.");
  if (!cliente && !clienteEmail) throw new Error("Selecione um aluno ou informe o e-mail do cliente.");
  return {
    clienteId: String(cliente?._id || body.clienteId || body.alunoId || ""),
    clienteNome, clienteEmail, clienteTelefone,
    vendedorId: String(vendedor?._id || vendedor?.id || vendedorIdAtual(req)),
    vendedorNome: texto(vendedor?.nome || req.usuario?.nome, 160),
    vendedorEmail: email(vendedor?.email || req.usuario?.email),
    produtoId: produto.id, produtoCodigo: produto.codigo, produtoNome: produto.nome,
    valorBruto, desconto, valor: valorFinal,
    formaPagamento: normalizarCodigo(body.formaPagamento || "pix") || "pix",
    parcelas: Math.max(1, Math.min(24, Number(body.parcelas || 1))),
    status, porcentagemComissao: porcentagem,
    comissao: moeda((valorFinal * porcentagem) / 100),
    comissaoStatus: status === "pago" ? (vendaAtual?.comissaoStatus || "disponivel") : "prevista",
    cupomCodigo: cupom.codigo,
    dataVenda: texto(body.dataVenda || vendaAtual?.dataVenda || hojeSql(), 10),
    pagoEm: status === "pago" ? (vendaAtual?.pagoEm || agoraSql()) : null,
    canceladoEm: ["cancelado", "estornado"].includes(status) ? agoraSql() : null,
    observacoes: texto(body.observacoes, 5000),
    origem: texto(body.origem || "painel-vendas", 50),
    cupom: cupom.cupom
  };
}

async function buscarVenda(id) {
  const rows = await database.query("SELECT * FROM vendas WHERE id = ? LIMIT 1", [texto(id, 24)]);
  return rows[0] || null;
}

function filtroEscopo(req, alias = "") {
  if (cargoTemVisaoCompleta(req.usuario)) return { sql: "1 = 1", params: [] };
  const prefixo = alias ? `${alias}.` : "";
  return { sql: `${prefixo}vendedor_id = ?`, params: [vendedorIdAtual(req)] };
}

router.use(async (req, res, next) => {
  try {
    await garantirEstrutura();
    next();
  } catch (error) {
    console.error("Erro ao preparar módulo MySQL de vendas:", error);
    res.status(500).json({ erro: "Não foi possível preparar o módulo de vendas." });
  }
});

router.get("/vendas/status", (req, res) => res.json({ status: "online", modulo: "vendas-mysql", banco: "MySQL" }));

router.get("/vendas/painel/contexto", auth, requirePermission("painelVendas"), async (req, res) => {
  const cargo = getCargo(req.usuarioDoc || req.usuario);
  const produtos = await database.query("SELECT * FROM produtos_planos ORDER BY ordem, nome");
  const pagamentos = await database.query("SELECT * FROM formas_pagamento ORDER BY nome");
  res.json({ sucesso: true, origem: "mysql", usuario: req.usuario, cargo, dev: cargo === "dev", podeVerTudo: cargoTemVisaoCompleta(req.usuario), podeExcluir: cargo === "dev", produtos: produtos.map(formatarProduto), formasPagamento: pagamentos.map(formatarPagamento) });
});

router.get("/vendas/dashboard", auth, requirePermission("painelVendas"), async (req, res) => {
  try {
    const dias = Math.min(Math.max(Number(req.query.dias || 30), 7), 365);
    const escopo = filtroEscopo(req, "v");
    const inicio = new Date(Date.now() - (dias - 1) * 86400000).toISOString().slice(0, 10);
    const inicioAnterior = new Date(Date.now() - (dias * 2 - 1) * 86400000).toISOString().slice(0, 10);
    const fimAnterior = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
    const [resumoRows, anteriorRows, serieRows, rankingRows, recentesRows, pagamentosRows, usuariosRows] = await Promise.all([
      database.query(`SELECT COUNT(*) AS total,SUM(status='pago') AS pagas,SUM(status='pendente') AS pendentes,SUM(status IN ('cancelado','estornado')) AS canceladas,COALESCE(SUM(CASE WHEN status='pago' THEN valor ELSE 0 END),0) AS faturamento,COALESCE(SUM(CASE WHEN status='pago' THEN comissao ELSE 0 END),0) AS comissoes FROM vendas v WHERE ${escopo.sql} AND v.data_venda >= ?`, [...escopo.params, inicio]),
      database.query(`SELECT COUNT(*) AS total,SUM(status='pago') AS pagas,COALESCE(SUM(CASE WHEN status='pago' THEN valor ELSE 0 END),0) AS faturamento FROM vendas v WHERE ${escopo.sql} AND v.data_venda BETWEEN ? AND ?`, [...escopo.params, inicioAnterior, fimAnterior]),
      database.query(`SELECT data_venda AS data,SUM(status='pago') AS vendas,COALESCE(SUM(CASE WHEN status='pago' THEN valor ELSE 0 END),0) AS faturamento FROM vendas v WHERE ${escopo.sql} AND v.data_venda >= ? GROUP BY data_venda ORDER BY data_venda`, [...escopo.params, inicio]),
      database.query(`SELECT vendedor_id,vendedor_nome,vendedor_email,COUNT(*) AS total_vendas,COALESCE(SUM(valor),0) AS faturamento,COALESCE(SUM(comissao),0) AS comissao FROM vendas v WHERE ${escopo.sql} AND status='pago' AND data_venda >= ? GROUP BY vendedor_id,vendedor_nome,vendedor_email ORDER BY faturamento DESC,total_vendas DESC LIMIT 10`, [...escopo.params, inicio]),
      database.query(`SELECT * FROM vendas v WHERE ${escopo.sql} ORDER BY created_at DESC LIMIT 12`, escopo.params),
      database.query(`SELECT forma_pagamento,COUNT(*) AS total FROM vendas v WHERE ${escopo.sql} AND status='pago' AND data_venda >= ? GROUP BY forma_pagamento ORDER BY total DESC`, [...escopo.params, inicio]),
      database.query(`SELECT SUM(cargo='aluno' AND status='ativo') AS ativos,SUM(cargo='aluno' AND status='pendente') AS pendentes,SUM(cargo='aluno' AND status='suspenso') AS suspensos,SUM(cargo='aluno') AS total FROM usuarios WHERE conta_dev=0`)
    ]);
    const atual = resumoRows[0] || {};
    const anterior = anteriorRows[0] || {};
    const crescimento = (a, b) => { a = numero(a); b = numero(b); return b ? Number((((a - b) / b) * 100).toFixed(1)) : a > 0 ? 100 : 0; };
    const mapaSerie = new Map();
    for (let i = dias - 1; i >= 0; i -= 1) {
      const data = new Date(); data.setHours(0, 0, 0, 0); data.setDate(data.getDate() - i);
      const chave = data.toISOString().slice(0, 10);
      mapaSerie.set(chave, { data: chave, rotulo: chave.slice(8, 10) + "/" + chave.slice(5, 7), vendas: 0, faturamento: 0 });
    }
    serieRows.forEach((row) => { const chave = new Date(row.data).toISOString().slice(0, 10); if (mapaSerie.has(chave)) mapaSerie.set(chave, { ...mapaSerie.get(chave), vendas: Number(row.vendas || 0), faturamento: moeda(row.faturamento) }); });
    const totalPagamentos = pagamentosRows.reduce((s, item) => s + Number(item.total || 0), 0);
    const pagas = Number(atual.pagas || 0), faturamento = moeda(atual.faturamento), pendentes = Number(atual.pendentes || 0), canceladas = Number(atual.canceladas || 0);
    res.json({ sucesso: true, origem: "mysql", periodo: { dias, inicio, fim: hojeSql() }, indicadores: { faturamento, vendasConfirmadas: pagas, vendasPendentes: pendentes, ticketMedio: pagas ? moeda(faturamento / pagas) : 0, comissoes: moeda(atual.comissoes), crescimentoFaturamento: crescimento(atual.faturamento, anterior.faturamento), crescimentoVendas: crescimento(atual.pagas, anterior.pagas), crescimentoPendentes: 0 }, serie: Array.from(mapaSerie.values()), ranking: rankingRows.map((row, index) => ({ posicao: index + 1, vendedorId: row.vendedor_id, nome: row.vendedor_nome || "Vendedor", email: row.vendedor_email || "", vendas: Number(row.total_vendas || 0), faturamento: moeda(row.faturamento), comissao: moeda(row.comissao) })), recentes: recentesRows.map(formatarVenda), funil: [{ etapa: "Leads recebidos", total: Number(atual.total || 0) + pendentes + canceladas }, { etapa: "Em negociação", total: pendentes }, { etapa: "Aguardando pagamento", total: pendentes }, { etapa: "Vendas confirmadas", total: pagas }, { etapa: "Canceladas", total: canceladas }], pagamentos: pagamentosRows.map((row) => ({ codigo: row.forma_pagamento, total: Number(row.total || 0), percentual: totalPagamentos ? Number(((Number(row.total || 0) / totalPagamentos) * 100).toFixed(1)) : 0 })), alunos: { ativos: Number(usuariosRows[0]?.ativos || 0), pendentes: Number(usuariosRows[0]?.pendentes || 0), suspensos: Number(usuariosRows[0]?.suspensos || 0), total: Number(usuariosRows[0]?.total || 0) } });
  } catch (error) {
    console.error("Erro no dashboard MySQL de vendas:", error);
    res.status(500).json({ erro: "Erro interno ao carregar o painel de vendas." });
  }
});

router.get("/vendas/clientes", auth, requirePermission("painelVendas"), async (req, res) => {
  const busca = texto(req.query.busca, 160), params = [];
  let where = "cargo='aluno' AND conta_dev=0";
  if (busca) { where += " AND (nome LIKE ? OR email LIKE ? OR telefone LIKE ?)"; params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`); }
  const rows = await database.query(`SELECT id,nome,email,telefone,plano,status,data_expiracao,created_at FROM usuarios WHERE ${where} ORDER BY created_at DESC LIMIT 500`, params);
  res.json({ sucesso: true, clientes: rows.map((row) => ({ id: row.id, nome: row.nome, email: row.email, telefone: row.telefone, plano: row.plano, status: row.status, dataExpiracao: row.data_expiracao, createdAt: row.created_at })) });
});

router.get("/vendas/vendedores", auth, requirePermission("painelVendas"), async (req, res) => {
  const rows = await database.query(`SELECT id,nome,email,cargo,comissao,status FROM usuarios WHERE cargo IN ('dev','dono','superadmin','admin','financeiro','vendedor') ORDER BY nome`);
  res.json({ sucesso: true, vendedores: rows.map((row) => ({ id: row.id, nome: row.nome, email: row.email, cargo: row.cargo, comissao: numero(row.comissao, 20), status: row.status })) });
});

router.get("/vendas/produtos", auth, requirePermission("painelVendas"), async (req, res) => { const rows = await database.query("SELECT * FROM produtos_planos ORDER BY ordem,nome"); res.json({ sucesso: true, produtos: rows.map(formatarProduto) }); });
router.post("/vendas/produtos", auth, requireDev, async (req, res) => {
  try {
    const codigo = normalizarCodigo(req.body.codigo || req.body.nome), nome = texto(req.body.nome, 160);
    if (!codigo || !nome) return res.status(400).json({ erro: "Código e nome são obrigatórios." });
    const id = id24();
    await database.query(`INSERT INTO produtos_planos(id,codigo,nome,descricao,preco,duracao_dias,status,destaque,ordem) VALUES(?,?,?,?,?,?,?,?,?)`, [id, codigo, nome, texto(req.body.descricao, 600), moeda(req.body.preco), Math.max(1, Number(req.body.duracaoDias || 30)), booleano(req.body.ativo, true) ? 1 : 0, booleano(req.body.destaque) ? 1 : 0, Number(req.body.ordem || 0)]);
    await registrarLog(req, "", "produto_criado", { id, codigo, nome });
    const rows = await database.query("SELECT * FROM produtos_planos WHERE id=?", [id]);
    res.status(201).json({ sucesso: true, produto: formatarProduto(rows[0]) });
  } catch (error) { res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({ erro: error.code === "ER_DUP_ENTRY" ? "Já existe um produto com esse código." : "Erro ao criar produto." }); }
});
router.put("/vendas/produtos/:id", auth, requireDev, async (req, res) => {
  const id = texto(req.params.id, 24), atual = await database.query("SELECT * FROM produtos_planos WHERE id=? LIMIT 1", [id]);
  if (!atual.length) return res.status(404).json({ erro: "Produto não encontrado." });
  const row = atual[0];
  await database.query(`UPDATE produtos_planos SET codigo=?,nome=?,descricao=?,preco=?,duracao_dias=?,status=?,destaque=?,ordem=? WHERE id=?`, [normalizarCodigo(req.body.codigo ?? row.codigo), texto(req.body.nome ?? row.nome, 160), texto(req.body.descricao ?? row.descricao, 600), moeda(req.body.preco ?? row.preco), Math.max(1, Number(req.body.duracaoDias ?? row.duracao_dias)), booleano(req.body.ativo, Boolean(row.status)) ? 1 : 0, booleano(req.body.destaque, Boolean(row.destaque)) ? 1 : 0, Number(req.body.ordem ?? row.ordem), id]);
  const rows = await database.query("SELECT * FROM produtos_planos WHERE id=?", [id]);
  res.json({ sucesso: true, produto: formatarProduto(rows[0]) });
});
router.delete("/vendas/produtos/:id", auth, requireDev, async (req, res) => {
  const id = texto(req.params.id, 24), uso = await database.query("SELECT COUNT(*) total FROM vendas WHERE produto_id=?", [id]);
  if (Number(uso[0]?.total || 0) > 0) { await database.query("UPDATE produtos_planos SET status=0 WHERE id=?", [id]); return res.json({ sucesso: true, mensagem: "Produto desativado porque possui vendas vinculadas." }); }
  await database.query("DELETE FROM produtos_planos WHERE id=?", [id]); res.json({ sucesso: true });
});

router.get("/vendas/formas-pagamento", auth, requirePermission("painelVendas"), async (req, res) => { const rows = await database.query("SELECT * FROM formas_pagamento ORDER BY nome"); res.json({ sucesso: true, formasPagamento: rows.map(formatarPagamento) }); });
router.post("/vendas/formas-pagamento", auth, requireDev, async (req, res) => {
  const id = id24(), nome = texto(req.body.nome, 120), codigo = normalizarCodigo(req.body.codigo || nome);
  if (!nome || !codigo) return res.status(400).json({ erro: "Nome é obrigatório." });
  try { await database.query("INSERT INTO formas_pagamento(id,codigo,nome,taxa_percentual,status) VALUES(?,?,?,?,?)", [id, codigo, nome, numero(req.body.taxaPercentual), booleano(req.body.ativo, true) ? 1 : 0]); const rows = await database.query("SELECT * FROM formas_pagamento WHERE id=?", [id]); res.status(201).json({ sucesso: true, formaPagamento: formatarPagamento(rows[0]) }); }
  catch (error) { res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({ erro: error.code === "ER_DUP_ENTRY" ? "Forma de pagamento já cadastrada." : "Erro ao cadastrar forma de pagamento." }); }
});
router.put("/vendas/formas-pagamento/:id", auth, requireDev, async (req, res) => {
  const id = texto(req.params.id, 24), rows = await database.query("SELECT * FROM formas_pagamento WHERE id=? LIMIT 1", [id]);
  if (!rows.length) return res.status(404).json({ erro: "Forma de pagamento não encontrada." });
  const row = rows[0];
  await database.query("UPDATE formas_pagamento SET codigo=?,nome=?,taxa_percentual=?,status=? WHERE id=?", [normalizarCodigo(req.body.codigo ?? row.codigo), texto(req.body.nome ?? row.nome, 120), numero(req.body.taxaPercentual ?? row.taxa_percentual), booleano(req.body.ativo, Boolean(row.status)) ? 1 : 0, id]);
  const atual = await database.query("SELECT * FROM formas_pagamento WHERE id=?", [id]); res.json({ sucesso: true, formaPagamento: formatarPagamento(atual[0]) });
});
router.delete("/vendas/formas-pagamento/:id", auth, requireDev, async (req, res) => { await database.query("UPDATE formas_pagamento SET status=0 WHERE id=?", [texto(req.params.id, 24)]); res.json({ sucesso: true }); });

router.get("/vendas/cupons", auth, requirePermission("painelVendas"), async (req, res) => { const rows = await database.query("SELECT * FROM cupons_desconto ORDER BY created_at DESC"); res.json({ sucesso: true, cupons: rows.map(formatarCupom) }); });
router.post("/vendas/cupons", auth, requireDev, async (req, res) => {
  const id = id24(), codigo = texto(req.body.codigo, 60).toUpperCase(); if (!codigo) return res.status(400).json({ erro: "Informe o código do cupom." });
  try { await database.query(`INSERT INTO cupons_desconto(id,codigo,tipo,valor,limite_usos,valido_ate,status) VALUES(?,?,?,?,?,?,?)`, [id, codigo, req.body.tipo === "fixo" ? "fixo" : "percentual", moeda(req.body.valor), Math.max(0, Number(req.body.limiteUsos || 0)), req.body.validoAte || null, booleano(req.body.ativo, true) ? 1 : 0]); const rows = await database.query("SELECT * FROM cupons_desconto WHERE id=?", [id]); res.status(201).json({ sucesso: true, cupom: formatarCupom(rows[0]) }); }
  catch (error) { res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({ erro: error.code === "ER_DUP_ENTRY" ? "Cupom já existe." : "Erro ao criar cupom." }); }
});
router.put("/vendas/cupons/:id", auth, requireDev, async (req, res) => {
  const id = texto(req.params.id, 24), rows = await database.query("SELECT * FROM cupons_desconto WHERE id=? LIMIT 1", [id]); if (!rows.length) return res.status(404).json({ erro: "Cupom não encontrado." }); const row = rows[0];
  await database.query(`UPDATE cupons_desconto SET codigo=?,tipo=?,valor=?,limite_usos=?,valido_ate=?,status=? WHERE id=?`, [texto(req.body.codigo ?? row.codigo, 60).toUpperCase(), req.body.tipo === "fixo" ? "fixo" : "percentual", moeda(req.body.valor ?? row.valor), Math.max(0, Number(req.body.limiteUsos ?? row.limite_usos)), req.body.validoAte ?? row.valido_ate, booleano(req.body.ativo, Boolean(row.status)) ? 1 : 0, id]);
  const atual = await database.query("SELECT * FROM cupons_desconto WHERE id=?", [id]); res.json({ sucesso: true, cupom: formatarCupom(atual[0]) });
});
router.delete("/vendas/cupons/:id", auth, requireDev, async (req, res) => { await database.query("UPDATE cupons_desconto SET status=0 WHERE id=?", [texto(req.params.id, 24)]); res.json({ sucesso: true }); });

router.get("/vendas/configuracoes", auth, requireDev, async (req, res) => { const rows = await database.query("SELECT chave,valor,updated_at FROM vendas_configuracoes ORDER BY chave"); res.json({ sucesso: true, configuracoes: Object.fromEntries(rows.map((r) => [r.chave, r.valor])) }); });
router.put("/vendas/configuracoes", auth, requireDev, async (req, res) => { for (const [chave, valor] of Object.entries(req.body || {})) { const key = normalizarCodigo(chave); if (key) await database.query("INSERT INTO vendas_configuracoes(chave,valor) VALUES(?,?) ON DUPLICATE KEY UPDATE valor=VALUES(valor)", [key, String(valor ?? "")]); } res.json({ sucesso: true }); });

router.get("/vendas/ranking", auth, requirePermission("painelVendas"), async (req, res) => {
  const dias = Math.min(Math.max(Number(req.query.dias || 30), 1), 365), inicio = new Date(Date.now() - (dias - 1) * 86400000).toISOString().slice(0, 10), escopo = filtroEscopo(req, "v");
  const rows = await database.query(`SELECT vendedor_id,vendedor_nome,vendedor_email,COUNT(*) total_vendas,COALESCE(SUM(valor),0) faturamento,COALESCE(SUM(comissao),0) comissao FROM vendas v WHERE ${escopo.sql} AND status='pago' AND data_venda>=? GROUP BY vendedor_id,vendedor_nome,vendedor_email ORDER BY faturamento DESC LIMIT 100`, [...escopo.params, inicio]);
  res.json({ sucesso: true, ranking: rows.map((r, i) => ({ posicao: i + 1, vendedorId: r.vendedor_id, nome: r.vendedor_nome, email: r.vendedor_email, vendas: Number(r.total_vendas || 0), faturamento: moeda(r.faturamento), comissao: moeda(r.comissao) })) });
});

router.get("/vendas/comissoes", auth, requirePermission("painelVendas"), async (req, res) => {
  const escopo = filtroEscopo(req, "v"), rows = await database.query(`SELECT * FROM vendas v WHERE ${escopo.sql} AND status='pago' ORDER BY pago_em DESC,created_at DESC LIMIT 1000`, escopo.params), vendas = rows.map(formatarVenda), resumo = { prevista: 0, disponivel: 0, paga: 0 };
  vendas.forEach((v) => { const chave = v.comissaoStatus === "paga" ? "paga" : v.comissaoStatus === "disponivel" ? "disponivel" : "prevista"; resumo[chave] += v.comissao; }); Object.keys(resumo).forEach((k) => resumo[k] = moeda(resumo[k]));
  res.json({ sucesso: true, resumo, vendas });
});
router.post("/vendas/comissoes/:id/pagar", auth, requirePermission("painelVendas"), async (req, res) => {
  if (!cargoTemVisaoCompleta(req.usuario)) return res.status(403).json({ erro: "Somente Dev, Dono, Admin ou Financeiro pode confirmar comissões." });
  const id = texto(req.params.id, 24), venda = await buscarVenda(id); if (!venda) return res.status(404).json({ erro: "Venda não encontrada." });
  await database.query("UPDATE vendas SET comissao_status='paga',atualizado_por=? WHERE id=?", [req.usuario.email || "", id]); await registrarLog(req, id, "comissao_paga", {}); res.json({ sucesso: true });
});

router.get("/vendas", auth, requirePermission("painelVendas"), async (req, res) => {
  const escopo = filtroEscopo(req, "v"), filtros = [escopo.sql], params = [...escopo.params], busca = texto(req.query.busca, 160), status = texto(req.query.status, 30), vendedor = texto(req.query.vendedorId, 24), produto = texto(req.query.produtoCodigo, 60), inicio = texto(req.query.inicio, 10), fim = texto(req.query.fim, 10);
  if (busca) { filtros.push("(v.cliente_nome LIKE ? OR v.cliente_email LIKE ? OR v.vendedor_nome LIKE ? OR v.produto_nome LIKE ?)"); params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`, `%${busca}%`); }
  if (["pendente", "pago", "cancelado", "estornado"].includes(status)) { filtros.push("v.status=?"); params.push(status); }
  if (vendedor && cargoTemVisaoCompleta(req.usuario)) { filtros.push("v.vendedor_id=?"); params.push(vendedor); }
  if (produto) { filtros.push("v.produto_codigo=?"); params.push(produto); }
  if (inicio) { filtros.push("v.data_venda>=?"); params.push(inicio); }
  if (fim) { filtros.push("v.data_venda<=?"); params.push(fim); }
  const limite = Math.min(Math.max(Number(req.query.limite || 500), 1), 2000), rows = await database.query(`SELECT * FROM vendas v WHERE ${filtros.join(" AND ")} ORDER BY v.created_at DESC LIMIT ${limite}`, params);
  res.json({ sucesso: true, total: rows.length, vendas: rows.map(formatarVenda) });
});

router.get("/vendas/:id", auth, requirePermission("painelVendas"), async (req, res) => {
  const row = await buscarVenda(req.params.id); if (!row) return res.status(404).json({ erro: "Venda não encontrada." });
  if (!cargoTemVisaoCompleta(req.usuario) && row.vendedor_id !== vendedorIdAtual(req)) return res.status(403).json({ erro: "Sem acesso a esta venda." });
  res.json({ sucesso: true, venda: formatarVenda(row) });
});

router.post("/vendas", auth, requirePermission("painelVendas"), async (req, res) => {
  try {
    const venda = await montarVenda(req.body || {}, req), id = id24();
    await database.query(`INSERT INTO vendas(id,cliente_id,cliente_nome,cliente_email,cliente_telefone,vendedor_id,vendedor_nome,vendedor_email,produto_id,produto_codigo,produto_nome,valor_bruto,desconto,valor,forma_pagamento,parcelas,status,porcentagem_comissao,comissao,comissao_status,cupom_codigo,data_venda,pago_em,cancelado_em,observacoes,origem,criado_por,atualizado_por) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [id, venda.clienteId, venda.clienteNome, venda.clienteEmail, venda.clienteTelefone, venda.vendedorId, venda.vendedorNome, venda.vendedorEmail, venda.produtoId, venda.produtoCodigo, venda.produtoNome, venda.valorBruto, venda.desconto, venda.valor, venda.formaPagamento, venda.parcelas, venda.status, venda.porcentagemComissao, venda.comissao, venda.comissaoStatus, venda.cupomCodigo, venda.dataVenda, venda.pagoEm, venda.canceladoEm, venda.observacoes, venda.origem, req.usuario.email || "", req.usuario.email || ""]);
    if (venda.cupom) await database.query("UPDATE cupons_desconto SET usos=usos+1 WHERE id=?", [venda.cupom.id]);
    const formatada = formatarVenda(await buscarVenda(id)); await aplicarPlanoAoUsuario(formatada); await registrarLog(req, id, "venda_criada", { status: venda.status, valor: venda.valor });
    res.status(201).json({ sucesso: true, mensagem: "Venda registrada com sucesso.", venda: formatada });
  } catch (error) { console.error("Erro ao criar venda MySQL:", error); res.status(400).json({ erro: error.message || "Erro ao registrar venda." }); }
});

router.put("/vendas/:id", auth, requirePermission("painelVendas"), async (req, res) => {
  try {
    const id = texto(req.params.id, 24), row = await buscarVenda(id); if (!row) return res.status(404).json({ erro: "Venda não encontrada." });
    if (!cargoTemVisaoCompleta(req.usuario) && row.vendedor_id !== vendedorIdAtual(req)) return res.status(403).json({ erro: "Sem permissão para editar esta venda." });
    const venda = await montarVenda(req.body || {}, req, formatarVenda(row));
    await database.query(`UPDATE vendas SET cliente_id=?,cliente_nome=?,cliente_email=?,cliente_telefone=?,vendedor_id=?,vendedor_nome=?,vendedor_email=?,produto_id=?,produto_codigo=?,produto_nome=?,valor_bruto=?,desconto=?,valor=?,forma_pagamento=?,parcelas=?,status=?,porcentagem_comissao=?,comissao=?,comissao_status=?,cupom_codigo=?,data_venda=?,pago_em=?,cancelado_em=?,observacoes=?,atualizado_por=? WHERE id=?`, [venda.clienteId, venda.clienteNome, venda.clienteEmail, venda.clienteTelefone, venda.vendedorId, venda.vendedorNome, venda.vendedorEmail, venda.produtoId, venda.produtoCodigo, venda.produtoNome, venda.valorBruto, venda.desconto, venda.valor, venda.formaPagamento, venda.parcelas, venda.status, venda.porcentagemComissao, venda.comissao, venda.comissaoStatus, venda.cupomCodigo, venda.dataVenda, venda.pagoEm, venda.canceladoEm, venda.observacoes, req.usuario.email || "", id]);
    const nova = formatarVenda(await buscarVenda(id)); await aplicarPlanoAoUsuario(nova); await registrarLog(req, id, "venda_atualizada", { status: nova.status }); res.json({ sucesso: true, venda: nova });
  } catch (error) { res.status(400).json({ erro: error.message || "Erro ao atualizar venda." }); }
});

router.post("/vendas/:id/status", auth, requirePermission("painelVendas"), async (req, res) => {
  const id = texto(req.params.id, 24), row = await buscarVenda(id); if (!row) return res.status(404).json({ erro: "Venda não encontrada." });
  if (!cargoTemVisaoCompleta(req.usuario) && row.vendedor_id !== vendedorIdAtual(req)) return res.status(403).json({ erro: "Sem permissão para alterar esta venda." });
  const status = normalizarStatus(req.body.status), pago = status === "pago" ? (row.pago_em || agoraSql()) : null, cancelado = ["cancelado", "estornado"].includes(status) ? agoraSql() : null, comissaoStatus = status === "pago" ? "disponivel" : "prevista";
  await database.query("UPDATE vendas SET status=?,pago_em=?,cancelado_em=?,comissao_status=?,atualizado_por=? WHERE id=?", [status, pago, cancelado, comissaoStatus, req.usuario.email || "", id]);
  const venda = formatarVenda(await buscarVenda(id)); await aplicarPlanoAoUsuario(venda); await registrarLog(req, id, "status_alterado", { status }); res.json({ sucesso: true, venda });
});

router.delete("/vendas/:id", auth, requireDev, async (req, res) => {
  const id = texto(req.params.id, 24), row = await buscarVenda(id); if (!row) return res.status(404).json({ erro: "Venda não encontrada." });
  await registrarLog(req, id, "venda_excluida", formatarVenda(row)); await database.query("DELETE FROM vendas WHERE id=?", [id]); res.json({ sucesso: true, mensagem: "Venda apagada." });
});

module.exports = router;
