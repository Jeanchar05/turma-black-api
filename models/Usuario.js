"use strict";

const crypto = require("crypto");
const database = require("../config/database");

const FIELD_TO_COLUMN = {
  _id: "id",
  id: "id",
  nome: "nome",
  email: "email",
  senha: "senha",
  tipo: "tipo",
  cargo: "cargo",
  contaDev: "conta_dev",
  permissoesPersonalizadas: "permissoes_personalizadas",
  vendedor: "vendedor",
  comissao: "comissao",
  aprovado: "aprovado",
  suspenso: "suspenso",
  status: "status",
  codigo: "codigo",
  plano: "plano",
  dataExpiracao: "data_expiracao",
  telefone: "telefone",
  foto: "foto",
  acessos: "acessos",
  dispositivos: "dispositivos",
  ultimoLogin: "ultimo_login",
  aprovadoEm: "aprovado_em",
  criadoPor: "criado_por",
  atualizadoPor: "atualizado_por",
  createdAt: "created_at",
  updatedAt: "updated_at"
};

const COLUMN_TO_FIELD = Object.fromEntries(
  Object.entries(FIELD_TO_COLUMN)
    .filter(([field]) => field !== "id")
    .map(([field, column]) => [column, field])
);

const JSON_FIELDS = new Set(["permissoesPersonalizadas", "dispositivos"]);
const BOOLEAN_FIELDS = new Set(["contaDev", "vendedor", "aprovado", "suspenso"]);

function gerarId() {
  return crypto.randomBytes(12).toString("hex");
}

function normalizarJson(valor, fallback) {
  if (valor === null || valor === undefined || valor === "") return fallback;
  if (typeof valor === "object") return valor;

  try {
    return JSON.parse(valor);
  } catch (_) {
    return fallback;
  }
}

function paraBanco(field, valor) {
  if (JSON_FIELDS.has(field)) {
    return JSON.stringify(valor ?? (field === "dispositivos" ? [] : {}));
  }

  if (BOOLEAN_FIELDS.has(field)) {
    return valor ? 1 : 0;
  }

  if (valor === undefined || valor === null) {
    return "";
  }

  return valor;
}

function escaparLike(valor) {
  return String(valor).replace(/[\\%_]/g, "\\$&");
}

function coluna(field) {
  return FIELD_TO_COLUMN[field] || null;
}

function compilarCampo(field, valor, params) {
  const col = coluna(field);

  if (!col) {
    return "1 = 1";
  }

  if (valor && typeof valor === "object" && !Array.isArray(valor)) {
    if (Object.prototype.hasOwnProperty.call(valor, "$regex")) {
      const termo = String(valor.$regex || "")
        .replace(/^\^|\$$/g, "")
        .replace(/[.*+?()[\]{}|]/g, "");
      params.push(`%${escaparLike(termo)}%`);
      return `\`${col}\` LIKE ? ESCAPE '\\\\'`;
    }

    if (Array.isArray(valor.$in)) {
      if (!valor.$in.length) return "1 = 0";
      const valores = valor.$in.map((item) => paraBanco(field, item));
      params.push(...valores);
      return `\`${col}\` IN (${valores.map(() => "?").join(", ")})`;
    }

    if (Array.isArray(valor.$nin)) {
      if (!valor.$nin.length) return "1 = 1";
      const valores = valor.$nin.map((item) => paraBanco(field, item));
      params.push(...valores);
      return `\`${col}\` NOT IN (${valores.map(() => "?").join(", ")})`;
    }

    const operadores = {
      $ne: "<>",
      $gt: ">",
      $gte: ">=",
      $lt: "<",
      $lte: "<="
    };

    for (const [operador, sql] of Object.entries(operadores)) {
      if (Object.prototype.hasOwnProperty.call(valor, operador)) {
        params.push(paraBanco(field, valor[operador]));
        return `\`${col}\` ${sql} ?`;
      }
    }

    if (Object.prototype.hasOwnProperty.call(valor, "$exists")) {
      return valor.$exists
        ? `\`${col}\` IS NOT NULL`
        : `\`${col}\` IS NULL`;
    }
  }

  if (valor === null) {
    return `\`${col}\` IS NULL`;
  }

  params.push(paraBanco(field, valor));
  return `\`${col}\` = ?`;
}

function compilarFiltro(filtro = {}, params = []) {
  if (!filtro || typeof filtro !== "object" || !Object.keys(filtro).length) {
    return { sql: "1 = 1", params };
  }

  const partes = [];

  for (const [field, valor] of Object.entries(filtro)) {
    if (field === "$or" && Array.isArray(valor)) {
      const grupos = valor.map((item) => {
        const compilado = compilarFiltro(item, params);
        return `(${compilado.sql})`;
      });
      partes.push(grupos.length ? `(${grupos.join(" OR ")})` : "1 = 0");
      continue;
    }

    if (field === "$and" && Array.isArray(valor)) {
      const grupos = valor.map((item) => {
        const compilado = compilarFiltro(item, params);
        return `(${compilado.sql})`;
      });
      partes.push(grupos.length ? `(${grupos.join(" AND ")})` : "1 = 1");
      continue;
    }

    partes.push(compilarCampo(field, valor, params));
  }

  return {
    sql: partes.length ? partes.join(" AND ") : "1 = 1",
    params
  };
}

function aplicarUpdate(documento, update = {}) {
  const possuiOperadores = Object.keys(update).some((key) => key.startsWith("$"));

  if (!possuiOperadores) {
    Object.assign(documento, update);
    return documento;
  }

  if (update.$set && typeof update.$set === "object") {
    Object.assign(documento, update.$set);
  }

  if (update.$inc && typeof update.$inc === "object") {
    for (const [field, valor] of Object.entries(update.$inc)) {
      documento[field] = Number(documento[field] || 0) + Number(valor || 0);
    }
  }

  if (update.$unset && typeof update.$unset === "object") {
    for (const field of Object.keys(update.$unset)) {
      delete documento[field];
    }
  }

  return documento;
}

function selecionarCampos(objeto, select) {
  if (!select) return objeto;

  const tokens = Array.isArray(select)
    ? select
    : String(select).split(/\s+/).filter(Boolean);

  if (!tokens.length) return objeto;

  const exclusivos = tokens.filter((item) => item.startsWith("-"));
  const inclusivos = tokens.filter((item) => !item.startsWith("-"));

  if (inclusivos.length) {
    const resultado = {};
    for (const field of inclusivos) {
      if (Object.prototype.hasOwnProperty.call(objeto, field)) {
        resultado[field] = objeto[field];
      }
    }
    if (objeto._id !== undefined) resultado._id = objeto._id;
    return resultado;
  }

  const resultado = { ...objeto };
  for (const field of exclusivos) {
    delete resultado[field.slice(1)];
  }
  return resultado;
}

class UsuarioDocumento {
  constructor(dados = {}, isNew = false) {
    Object.assign(this, dados);
    this._id = String(dados._id || dados.id || gerarId());
    this.id = this._id;
    this.isNew = isNew;
  }

  markModified() {}

  toObject() {
    const resultado = {};

    for (const [key, value] of Object.entries(this)) {
      if (key === "isNew") continue;
      resultado[key] = value;
    }

    resultado._id = this._id;
    resultado.id = this._id;
    return resultado;
  }

  toJSON() {
    return this.toObject();
  }

  async save() {
    const agora = new Date().toISOString().slice(0, 19).replace("T", " ");
    const conhecido = {};
    const extras = {};

    for (const [field, value] of Object.entries(this.toObject())) {
      if (field === "id" || field === "_id") continue;

      if (FIELD_TO_COLUMN[field]) {
        conhecido[field] = value;
      } else {
        extras[field] = value;
      }
    }

    if (this.isNew) {
      const payload = {
        nome: conhecido.nome || "",
        email: String(conhecido.email || "").trim().toLowerCase(),
        senha: String(conhecido.senha || ""),
        tipo: conhecido.tipo || "aluno",
        cargo: conhecido.cargo || "aluno",
        contaDev: Boolean(conhecido.contaDev),
        permissoesPersonalizadas: conhecido.permissoesPersonalizadas || {},
        vendedor: Boolean(conhecido.vendedor),
        comissao: Number(conhecido.comissao ?? 20),
        aprovado: Boolean(conhecido.aprovado),
        suspenso: Boolean(conhecido.suspenso),
        status: conhecido.status || "pendente",
        codigo: conhecido.codigo || "",
        plano: conhecido.plano || "free",
        dataExpiracao: conhecido.dataExpiracao || "",
        telefone: conhecido.telefone || "",
        foto: conhecido.foto || "",
        acessos: Number(conhecido.acessos || 0),
        dispositivos: conhecido.dispositivos || [],
        ultimoLogin: conhecido.ultimoLogin || "",
        aprovadoEm: conhecido.aprovadoEm || "",
        criadoPor: conhecido.criadoPor || "",
        atualizadoPor: conhecido.atualizadoPor || ""
      };

      await database.query(
        `INSERT INTO usuarios (
          id, nome, email, senha, tipo, cargo, conta_dev,
          permissoes_personalizadas, vendedor, comissao, aprovado,
          suspenso, status, codigo, plano, data_expiracao, telefone,
          foto, acessos, dispositivos, ultimo_login, aprovado_em,
          criado_por, atualizado_por, extras, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )`,
        [
          this._id,
          payload.nome,
          payload.email,
          payload.senha,
          payload.tipo,
          payload.cargo,
          payload.contaDev ? 1 : 0,
          JSON.stringify(payload.permissoesPersonalizadas),
          payload.vendedor ? 1 : 0,
          payload.comissao,
          payload.aprovado ? 1 : 0,
          payload.suspenso ? 1 : 0,
          payload.status,
          payload.codigo,
          payload.plano,
          payload.dataExpiracao,
          payload.telefone,
          payload.foto,
          payload.acessos,
          JSON.stringify(payload.dispositivos),
          payload.ultimoLogin,
          payload.aprovadoEm,
          payload.criadoPor,
          payload.atualizadoPor,
          JSON.stringify(extras),
          agora,
          agora
        ]
      );

      this.createdAt = this.createdAt || agora;
      this.updatedAt = agora;
      this.isNew = false;
      return this;
    }

    const sets = [];
    const params = [];

    for (const [field, columnName] of Object.entries(FIELD_TO_COLUMN)) {
      if (field === "_id" || field === "id" || field === "createdAt" || field === "updatedAt") {
        continue;
      }

      if (!Object.prototype.hasOwnProperty.call(conhecido, field)) continue;
      sets.push(`\`${columnName}\` = ?`);
      params.push(paraBanco(field, conhecido[field]));
    }

    sets.push("`extras` = ?");
    params.push(JSON.stringify(extras));
    sets.push("`updated_at` = ?");
    params.push(agora);
    params.push(this._id);

    await database.query(
      `UPDATE usuarios SET ${sets.join(", ")} WHERE id = ?`,
      params
    );

    this.updatedAt = agora;
    return this;
  }
}

function documentoDeLinha(row) {
  if (!row) return null;

  const dados = {
    _id: row.id,
    id: row.id
  };

  for (const [columnName, field] of Object.entries(COLUMN_TO_FIELD)) {
    let value = row[columnName];

    if (JSON_FIELDS.has(field)) {
      value = normalizarJson(
        value,
        field === "dispositivos" ? [] : {}
      );
    } else if (BOOLEAN_FIELDS.has(field)) {
      value = Boolean(Number(value || 0));
    }

    dados[field] = value;
  }

  const extras = normalizarJson(row.extras, {});
  Object.assign(dados, extras);
  dados._id = row.id;
  dados.id = row.id;

  return new UsuarioDocumento(dados, false);
}

class UsuarioQuery {
  constructor({ filtro = {}, single = false } = {}) {
    this.filtro = filtro;
    this.single = single;
    this.sortValue = null;
    this.limitValue = null;
    this.skipValue = 0;
    this.selectValue = null;
    this.leanValue = false;
  }

  sort(value) {
    this.sortValue = value;
    return this;
  }

  limit(value) {
    this.limitValue = Number(value);
    return this;
  }

  skip(value) {
    this.skipValue = Number(value);
    return this;
  }

  select(value) {
    this.selectValue = value;
    return this;
  }

  lean() {
    this.leanValue = true;
    return this;
  }

  async exec() {
    const { sql, params } = compilarFiltro(this.filtro, []);
    let comando = `SELECT * FROM usuarios WHERE ${sql}`;

    if (this.sortValue && typeof this.sortValue === "object") {
      const ordenacoes = Object.entries(this.sortValue)
        .map(([field, direction]) => {
          const col = coluna(field);
          if (!col) return null;
          return `\`${col}\` ${Number(direction) < 0 ? "DESC" : "ASC"}`;
        })
        .filter(Boolean);

      if (ordenacoes.length) {
        comando += ` ORDER BY ${ordenacoes.join(", ")}`;
      }
    }

    if (this.single) {
      comando += " LIMIT 1";
    } else if (Number.isFinite(this.limitValue) && this.limitValue > 0) {
      comando += ` LIMIT ${Math.floor(this.limitValue)}`;
    }

    if (!this.single && Number.isFinite(this.skipValue) && this.skipValue > 0) {
      if (!(Number.isFinite(this.limitValue) && this.limitValue > 0)) {
        comando += " LIMIT 18446744073709551615";
      }
      comando += ` OFFSET ${Math.floor(this.skipValue)}`;
    }

    const rows = await database.query(comando, params);
    const documentos = rows.map(documentoDeLinha);

    const transformar = (doc) => {
      if (!doc) return null;
      const base = this.leanValue ? doc.toObject() : doc;
      return selecionarCampos(base, this.selectValue);
    };

    if (this.single) {
      return transformar(documentos[0] || null);
    }

    return documentos.map(transformar);
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }

  finally(handler) {
    return this.exec().finally(handler);
  }
}

class Usuario {
  static find(filtro = {}) {
    return new UsuarioQuery({ filtro });
  }

  static findOne(filtro = {}) {
    return new UsuarioQuery({ filtro, single: true });
  }

  static findById(id) {
    return new UsuarioQuery({ filtro: { _id: String(id || "") }, single: true });
  }

  static async exists(filtro = {}) {
    const encontrado = await this.findOne(filtro).select("_id").lean();
    return Boolean(encontrado);
  }

  static async countDocuments(filtro = {}) {
    const { sql, params } = compilarFiltro(filtro, []);
    const rows = await database.query(
      `SELECT COUNT(*) AS total FROM usuarios WHERE ${sql}`,
      params
    );
    return Number(rows[0]?.total || 0);
  }

  static async create(dados, options) {
    if (Array.isArray(dados)) {
      const documentos = [];
      for (const item of dados) {
        const documento = new UsuarioDocumento(item, true);
        await documento.save(options);
        documentos.push(documento);
      }
      return documentos;
    }

    const documento = new UsuarioDocumento(dados, true);
    await documento.save(options);
    return documento;
  }

  static async updateOne(filtro = {}, update = {}, options = {}) {
    let documento = await this.findOne(filtro);
    const criadoPorUpsert = !documento && options.upsert;

    if (!documento && options.upsert) {
      const base = { ...filtro };
      delete base.$or;
      delete base.$and;
      documento = new UsuarioDocumento(base, true);
    }

    if (!documento) {
      return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    }

    aplicarUpdate(documento, update);
    await documento.save();

    return {
      acknowledged: true,
      matchedCount: criadoPorUpsert ? 0 : 1,
      modifiedCount: 1,
      upsertedId: criadoPorUpsert ? documento._id : null
    };
  }

  static async updateMany(filtro = {}, update = {}) {
    const documentos = await this.find(filtro);

    for (const documento of documentos) {
      aplicarUpdate(documento, update);
      await documento.save();
    }

    return {
      acknowledged: true,
      matchedCount: documentos.length,
      modifiedCount: documentos.length
    };
  }

  static async findOneAndUpdate(filtro = {}, update = {}, options = {}) {
    const anterior = await this.findOne(filtro);
    let documento = anterior;

    if (!documento && options.upsert) {
      const base = { ...filtro };
      delete base.$or;
      delete base.$and;
      documento = new UsuarioDocumento(base, true);
    }

    if (!documento) return null;

    aplicarUpdate(documento, update);
    await documento.save();

    return options.new || options.returnDocument === "after"
      ? documento
      : anterior;
  }

  static async findByIdAndUpdate(id, update = {}, options = {}) {
    return this.findOneAndUpdate({ _id: id }, update, options);
  }

  static async deleteOne(filtro = {}) {
    const documento = await this.findOne(filtro);

    if (!documento) {
      return { acknowledged: true, deletedCount: 0 };
    }

    await database.query("DELETE FROM usuarios WHERE id = ?", [documento._id]);
    return { acknowledged: true, deletedCount: 1 };
  }

  static async deleteMany(filtro = {}) {
    const { sql, params } = compilarFiltro(filtro, []);
    const resultado = await database.query(
      `DELETE FROM usuarios WHERE ${sql}`,
      params
    );

    return {
      acknowledged: true,
      deletedCount: Number(resultado.affectedRows || 0)
    };
  }

  static async findByIdAndDelete(id) {
    const documento = await this.findById(id);
    if (!documento) return null;
    await this.deleteOne({ _id: id });
    return documento;
  }

  static async findOneAndDelete(filtro = {}) {
    const documento = await this.findOne(filtro);
    if (!documento) return null;
    await this.deleteOne({ _id: documento._id });
    return documento;
  }

  static async distinct(field, filtro = {}) {
    const documentos = await this.find(filtro).lean();
    return [...new Set(documentos.map((item) => item[field]).filter((item) => item !== undefined))];
  }

  static async aggregate(pipeline = []) {
    let dados = await this.find({}).lean();

    for (const etapa of pipeline) {
      if (etapa.$match) {
        const ids = (await this.find(etapa.$match).select("_id").lean()).map((item) => item._id);
        const permitidos = new Set(ids);
        dados = dados.filter((item) => permitidos.has(item._id));
      } else if (etapa.$sort) {
        const entradas = Object.entries(etapa.$sort);
        dados.sort((a, b) => {
          for (const [field, direction] of entradas) {
            if (a[field] === b[field]) continue;
            return (a[field] > b[field] ? 1 : -1) * (Number(direction) < 0 ? -1 : 1);
          }
          return 0;
        });
      } else if (etapa.$limit) {
        dados = dados.slice(0, Number(etapa.$limit));
      } else if (etapa.$count) {
        dados = [{ [etapa.$count]: dados.length }];
      }
    }

    return dados;
  }
}

Usuario.Document = UsuarioDocumento;
Usuario.Query = UsuarioQuery;

module.exports = Usuario;
