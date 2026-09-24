"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const nav = read("public/page-navigation.js");
const fixes = read("public/platform-fixes-v18.js");
const auth = read("public/auth-registration-v18.js");
const notifications = read("public/dashboard-notifications-live-v18.js");
const roulette = read("public/roleta.html");

assert.match(nav, /platform-fixes-v18\.js/);
assert.match(nav, /auth-registration-v18\.js/);
assert.match(nav, /dashboard-notifications-live-v18\.js/);
assert.doesNotMatch(nav, /platform-fixes-v17\.js/);
assert.doesNotMatch(nav, /dashboard-notifications-live\.js\?v=20260923-v17/);

assert.match(fixes, /hero-jean-transparent\.webp/);
assert.match(fixes, /primo-portrait-light-v5\.webp/);
assert.match(fixes, /data-provider=|data-provider/);
assert.match(fixes, /real-v18-art/);
assert.doesNotMatch(fixes, /primo-login-(?:dark|light)-v34\.webp/);

assert.match(auth, /addEventListener\("submit", submit, true\)/);
assert.match(auth, /stopImmediatePropagation\(\)/);
assert.match(auth, /data\.sucesso === true \|\| data\.success === true \|\| Boolean\(data\.usuario\)/);
assert.match(auth, /senha\.length < 10/);

assert.match(notifications, /credentials: "same-origin"/);
assert.match(notifications, /\/minhas-notificacoes/);
assert.match(notifications, /\/notificacoes\/minhas/);
assert.match(notifications, /window\.addEventListener\("online"/);
assert.match(notifications, /notification-v18-badge/);

for (const label of [
  "Roullete immersive (Evolution)",
  "Roleta Brasileira (Playtech)",
  "Roleta Brasileira (Pragmatic)",
  "Tukias roullet"
]) assert.ok(roulette.includes(label), `Mesa ausente: ${label}`);
for (const url of [
  "https://esportiva.bet.br/games/evolution/immersive-roulette",
  "https://esportiva.bet.br/games/playtech/roleta-brasileira",
  "https://esportiva.bet.br/games/pragmaticplay/roleta-brasileira",
  "https://esportiva.bet.br/games/imaginelive/turkce-rulet",
  "https://go.aff.esportiva.bet/bhotuu7q"
]) assert.ok(roulette.includes(url), `Link protegido ausente: ${url}`);
assert.doesNotMatch(roulette, /Turistas roullet/i);

console.log("platform-v18-regression: ok");
