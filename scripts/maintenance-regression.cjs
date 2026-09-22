"use strict";

const assert = require("node:assert/strict");
const maintenance = require("../services/maintenance-mode");

assert.equal(maintenance.shouldBypass("tp_maintenance_bypass=1"), true);
assert.equal(maintenance.shouldBypass("foo=bar; tp_maintenance_bypass=1; x=y"), true);
assert.equal(maintenance.shouldBypass("tp_maintenance_bypass=0"), false);
assert.equal(maintenance.shouldBypass(""), false);

assert.equal(maintenance.shouldShowMaintenance({ method: "GET", path: "/", headers: { accept: "text/html" } }), true);
assert.equal(maintenance.shouldShowMaintenance({ method: "GET", path: "/dashboard", headers: { accept: "text/html,application/xhtml+xml" } }), true);
assert.equal(maintenance.shouldShowMaintenance({ method: "GET", path: "/assets/logo.svg", headers: { accept: "image/avif,image/webp" } }), false);
assert.equal(maintenance.shouldShowMaintenance({ method: "POST", path: "/webhooks/bestfy", headers: { accept: "application/json" } }), false);
assert.equal(maintenance.shouldShowMaintenance({ method: "GET", path: "/api/status", headers: { accept: "application/json" } }), false);
assert.equal(maintenance.shouldShowMaintenance({ method: "GET", path: "/sair", headers: { accept: "text/html" } }), false);

console.log("Maintenance regression: OK");
