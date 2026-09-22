"use strict";

const assert = require("node:assert/strict");
const Profile = require("../services/profile-security-v6");

assert.equal(Profile.normalizePhone("(33) 99809-7595"), "+5533998097595");
assert.equal(Profile.normalizePhone("+55 33 99809-7595"), "+5533998097595");
assert.equal(Profile.normalizePhone("33998097595"), "+5533998097595");
assert.equal(Profile.normalizePhone("123"), "");

const code = Profile.generateCode(() => 0.123456);
assert.equal(code, "211110");
assert.equal(code.length, 6);
assert.match(code, /^\d{6}$/);

const secret = "test-profile-secret";
const userId = "0123456789abcdef01234567";
const phone = "+5533998097595";
const digest = Profile.hashCode({ code, userId, phone, secret });
assert.equal(Profile.verifyCode({ code, userId, phone, secret, digest }), true);
assert.equal(Profile.verifyCode({ code: "000000", userId, phone, secret, digest }), false);
assert.equal(Profile.verifyCode({ code, userId, phone: "+5533999999999", secret, digest }), false);

assert.equal(Profile.safeDisplayName("  João   da Silva  "), "João da Silva");
assert.equal(Profile.safeDisplayName("A".repeat(240)).length, 160);

console.log("Profile V6 regression: OK");
