"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const nav = read("public/page-navigation.js");
const js = read("public/roulette-affiliate-v10.js");
const css = read("public/roulette-affiliate-v10.css");
const page = read("public/roleta.html");
const affiliate = "https://go.aff.esportiva.bet/bhotuu7q";

assert(nav.includes("roulette-affiliate-v10.js"), "Roleta precisa carregar o CTA afiliado");
assert(nav.includes("roulette-affiliate-v10.css"), "Roleta precisa carregar o CSS do CTA afiliado");
assert(js.includes(affiliate), "CTA deve usar o link oficial de afiliado");
assert(js.includes("roulette-affiliate-banner"), "CTA inferior precisa existir");
assert(js.includes("esportivaAccess"), "CTA atual da plataforma precisa ser reaproveitado");
assert(css.includes('[data-theme="light"]'), "CTA precisa ter tratamento próprio para tema claro");
assert(css.includes("@media"), "CTA precisa ser responsivo");
assert(page.includes("Roleta Operacional"), "Página de Roleta Operacional precisa permanecer disponível");
console.log("Esportiva affiliate CTA regression: OK");
