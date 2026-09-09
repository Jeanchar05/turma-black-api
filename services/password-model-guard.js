"use strict";

const Usuario = require("../models/Usuario");
const { ensurePasswordHash, isPasswordHash } = require("./passwords");

const proto = Usuario?.Document?.prototype;
const MARKER = Symbol.for("turma.passwordModelGuard.v1");

if (proto && !proto[MARKER]) {
  const originalSave = proto.save;

  proto.save = async function guardedSave(...args) {
    if (Object.prototype.hasOwnProperty.call(this, "senha") && this.senha) {
      const current = String(this.senha);
      if (!isPasswordHash(current)) {
        this.senha = await ensurePasswordHash(current);
      }
    }
    return originalSave.apply(this, args);
  };

  Object.defineProperty(proto, MARKER, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });
}

module.exports = Usuario;
