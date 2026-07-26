"use strict";

const database = require("../config/database");

function parseJson(valor, fallback) {
  if (valor === null || valor === undefined || valor === "") return fallback;
  if (typeof valor === "object") return valor;

  try {
    return JSON.parse(valor);
  } catch (_) {
    return fallback;
  }
}

class PermissaoSistemaDocumento {
  constructor(dados = {}) {
    this.chave = dados.chave || "matriz-principal";
    this.matriz = dados.matriz || {};
    this.historico = dados.historico || [];
    this.atualizadoPor = dados.atualizadoPor || "";
    this.createdAt = dados.createdAt || dados.created_at || "";
    this.updatedAt = dados.updatedAt || dados.updated_at || "";
  }

  markModified() {}

  toObject() {
    return {
      chave: this.chave,
      matriz: this.matriz,
      historico: this.historico,
      atualizadoPor: this.atualizadoPor,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toJSON() {
    return this.toObject();
  }

  async save() {
    await database.query(
      `INSERT INTO permissoes_sistema (
        chave, matriz, historico, atualizado_por
      ) VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        matriz = VALUES(matriz),
        historico = VALUES(historico),
        atualizado_por = VALUES(atualizado_por),
        updated_at = CURRENT_TIMESTAMP`,
      [
        this.chave,
        JSON.stringify(this.matriz || {}),
        JSON.stringify(this.historico || []),
        this.atualizadoPor || ""
      ]
    );

    return this;
  }
}

function documentoDaLinha(row) {
  if (!row) return null;

  return new PermissaoSistemaDocumento({
    chave: row.chave,
    matriz: parseJson(row.matriz, {}),
    historico: parseJson(row.historico, []),
    atualizadoPor: row.atualizado_por || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  });
}

class PermissaoSistema {
  static async findOne(filtro = {}) {
    const chave = filtro.chave || "matriz-principal";
    const rows = await database.query(
      "SELECT * FROM permissoes_sistema WHERE chave = ? LIMIT 1",
      [chave]
    );
    return documentoDaLinha(rows[0]);
  }

  static async create(dados = {}) {
    const documento = new PermissaoSistemaDocumento(dados);
    await documento.save();
    return documento;
  }

  static async obter() {
    let registro = await this.findOne({ chave: "matriz-principal" });

    if (!registro) {
      registro = await this.create({
        chave: "matriz-principal",
        matriz: {},
        historico: []
      });
    }

    return registro;
  }

  static async findOneAndUpdate(filtro = {}, update = {}, options = {}) {
    let documento = await this.findOne(filtro);

    if (!documento && options.upsert) {
      documento = new PermissaoSistemaDocumento({
        chave: filtro.chave || "matriz-principal"
      });
    }

    if (!documento) return null;

    const valores = update.$set || update;

    if (valores.matriz !== undefined) documento.matriz = valores.matriz;
    if (valores.historico !== undefined) documento.historico = valores.historico;
    if (valores.atualizadoPor !== undefined) documento.atualizadoPor = valores.atualizadoPor;

    if (update.$push?.historico !== undefined) {
      documento.historico = [
        ...(Array.isArray(documento.historico) ? documento.historico : []),
        update.$push.historico
      ];
    }

    await documento.save();
    return documento;
  }
}

module.exports = PermissaoSistema;
