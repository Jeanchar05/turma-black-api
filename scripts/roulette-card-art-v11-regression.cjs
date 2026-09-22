"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");

const art = fs.readFileSync("public/roulette-card-art-v11.js", "utf8");
const nav = fs.readFileSync("public/page-navigation.js", "utf8");
const assets = [
  "immersive-dark.svg", "immersive-light.svg",
  "playtech-dark.svg", "playtech-light.svg",
  "pragmatic-dark.svg", "pragmatic-light.svg",
  "turistas-dark.svg", "turistas-light.svg"
];

for (const asset of assets) {
  assert.ok(fs.existsSync(`public/assets/roulette/cards/${asset}`), `Arte ausente: ${asset}`);
}
assert.match(nav, /roulette-card-art-v11\.js/, "Roleta precisa carregar o controlador de artes");
assert.match(art, /Roullete immersive \(Evolution\)/, "Nome da Immersive deve permanecer padronizado");
assert.match(art, /Roleta Brasileira \(Playtech\)/, "Nome da Playtech deve permanecer padronizado");
assert.match(art, /Roleta Brasileira \(Pragmatic\)/, "Nome da Pragmatic deve permanecer padronizado");
assert.match(art, /Turistas roullet/, "Nome da Turistas roullet deve permanecer padronizado");
assert.match(art, /data-theme/, "Artes precisam reagir ao tema claro e escuro");
assert.match(art, /MutationObserver/, "Troca de tema deve atualizar as imagens sem recarregar");
assert.match(art, /slice\(3\)/, "Ferramentas opcionais devem ficar limitadas a três");
console.log("roulette card art v11 regression: ok");
