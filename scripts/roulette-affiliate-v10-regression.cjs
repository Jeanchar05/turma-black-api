"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");

const affiliate = fs.readFileSync("public/roulette-esportiva-affiliate-v10.js", "utf8");
const navigation = fs.readFileSync("public/page-navigation.js", "utf8");
const styles = fs.readFileSync("public/roulette-esportiva-affiliate-v10.css", "utf8");

assert.match(affiliate, /https:\/\/go\.aff\.esportiva\.bet\/bhotuu7q/, "CTA deve usar o link de afiliado oficial");
assert.match(affiliate, /rel = \"noopener noreferrer sponsored\"/, "Links externos devem ser marcados como sponsored e seguros");
assert.match(affiliate, /route\(\) !== \"\/roleta\"/, "CTA deve existir apenas na Roleta Operacional");
assert.match(navigation, /roulette-esportiva-affiliate-v10\.js/, "Navegação deve carregar o script do CTA");
assert.match(navigation, /roulette-esportiva-affiliate-v10\.css/, "Navegação deve carregar o CSS do CTA");
assert.match(styles, /html\[data-theme=\"light\"\]/, "CTA deve ter tratamento específico para tema claro");
assert.match(styles, /@media\(max-width:760px\)/, "CTA deve ter layout mobile");

console.log("roulette affiliate v10 regression: ok");
