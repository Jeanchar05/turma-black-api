"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const express = require("express");
const { siteNavigation, canonicalPage } = require("../middleware/site-navigation");
const { securityHeaders } = require("../middleware/security-headers");
const { authPagina } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const PermissaoSistema = require("../models/PermissaoSistema");
const source = fs.readFileSync(path.join(__dirname, "../public/page-navigation.js"), "utf8");

function pageContext(url, state = null, type = "navigate") {
  const location = new URL(url);
  let redirected = "";
  location.replace = destination => { redirected = destination; };
  const listeners = {};
  const history = { state, replaceState(data, _, destination) { this.state = data; location.href = new URL(destination, location).href; }, pushState(data, _, destination) { this.state = data; location.href = new URL(destination, location).href; } };
  const window = { addEventListener(name, callback) { listeners[name] = callback; }, dispatchEvent(event) { listeners[event.type]?.(event); } };
  const context = { location, history, window, URL, DOMException, performance:{getEntriesByType:()=>[{type}]}, HashChangeEvent:class{constructor(){this.type="hashchange";}} };
  vm.runInNewContext(source, context);
  return { ...context, redirected:()=>redirected };
}

async function main() {
  assert.equal(canonicalPage("/ADMIN%2ehtml"), "/admin");
  assert.equal(canonicalPage("/dashboard.html/"), "/dashboard");
  assert.equal(canonicalPage("/index.html"), "/");
  assert.equal(canonicalPage("//evil.example"), null);
  assert.equal(canonicalPage("/%GG"), null);
  assert.equal(canonicalPage("/vendas/command-center"), null);

  const initial = pageContext("https://example.test/dashboard-free?origem=teste#premium");
  assert.equal(initial.location.href, "https://example.test/");
  assert.equal(initial.window.TurmaNavigation.pathname, "/dashboard-free");
  assert.equal(initial.window.TurmaNavigation.hash, "#premium");
  initial.history.replaceState(null, "", "#aulas");
  assert.equal(initial.location.href, "https://example.test/");
  assert.equal(initial.window.TurmaNavigation.hash, "#aulas");
  assert.equal(initial.history.state.turmaPage, "/dashboard-free?origem=teste#aulas");
  assert.throws(() => initial.history.pushState(null, "", "https://evil.example/"), /mesmo site/);
  const refreshed = pageContext("https://example.test/", initial.history.state, "reload");
  assert.equal(refreshed.redirected(), "/dashboard-free?origem=teste#aulas");
  assert.equal(pageContext("https://example.test/", null, "navigate").redirected(), "");
  assert.equal(pageContext("https://example.test/", {turmaPage:"https://evil.example/"}, "reload").redirected(), "");
  assert.equal(pageContext("https://example.test/", {turmaPage:"//evil.example/"}, "reload").redirected(), "");

  const originalObter = PermissaoSistema.obter;
  PermissaoSistema.obter = async () => ({matriz:{}});
  const app = express();
  app.use(securityHeaders);
  app.use(siteNavigation);
  app.get("/dashboard", authPagina, (_,res)=>res.send("private"));
  app.get(["/admin","/painel-admin"], (req,_,next)=>{req.usuario={id:"fixture",cargo:"aluno"};next();}, requirePermission("painelAdmin"), (_,res)=>res.send("private"));
  app.get("/painel-vendas", (req,_,next)=>{req.usuario={id:"fixture",cargo:"aluno"};next();}, requirePermission("painelVendas"), (_,res)=>res.send("private"));
  app.use((_,res)=>res.status(404).end());
  const server = await new Promise(resolve=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s));});
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const route of ["/admin.html", "/ADMIN%2ehtml", "/painel-admin.html", "/painel-vendas.html"]) {
      const response = await fetch(base+route, {redirect:"manual"});
      assert.equal(response.status, 308, route);
      assert.equal(response.headers.get("x-frame-options"), "DENY");
      const final = await fetch(base+response.headers.get("location"), {redirect:"manual"});
      assert.equal(final.status, 403, `${route}: student must not receive staff page`);
    }
    const anonymous = await fetch(base+"/dashboard", {redirect:"manual"});
    assert.equal(anonymous.status, 302);
    assert.equal(anonymous.headers.get("location"), "/");
    assert.match(anonymous.headers.get("content-security-policy"), /frame-ancestors 'none'/);
    assert.match(anonymous.headers.get("permissions-policy"), /display-capture=\(\)/);
  } finally { PermissaoSistema.obter=originalObter; await new Promise(resolve=>server.close(resolve)); }
  console.log("Navigation regression: clean URLs, refresh, tab isolation, redirects, permission denial and frame protections OK.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
