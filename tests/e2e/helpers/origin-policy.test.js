// @ts-check
// helpers/origin-policy.test.js — Pruebas unitarias del clasificador de origin.
// Ejecutar con: npm run test:unit

const test = require('node:test');
const assert = require('node:assert');
const { createOriginPolicy } = require('./origin-policy');

// Base simulando la IP real de la LAN (el caso que motivó el cambio).
const policy = createOriginPolicy('http://192.168.1.50:8080');

test('mismo origin → interno', () => {
  assert.equal(policy.isExternalRequest('http://192.168.1.50:8080/'), false);
  assert.equal(policy.isExternalRequest('http://192.168.1.50:8080/modulos/mate-201/'), false);
});

test('localhost con el mismo puerto → externo (origin distinto)', () => {
  assert.equal(policy.isExternalRequest('http://localhost:8080/'), true);
});

test('127.0.0.1 con el mismo puerto → externo', () => {
  assert.equal(policy.isExternalRequest('http://127.0.0.1:8080/'), true);
});

test('hostname LAN educonnect.local → externo', () => {
  assert.equal(policy.isExternalRequest('http://educonnect.local:8080/'), true);
});

test('ruta relativa /api/modulos → interno', () => {
  assert.equal(policy.isExternalRequest('/api/modulos'), false);
});

test('mismo host con puerto diferente → externo', () => {
  assert.equal(policy.isExternalRequest('http://192.168.1.50:9090/'), true);
});

test('mismo host con esquema diferente → externo', () => {
  assert.equal(policy.isExternalRequest('https://192.168.1.50:8080/'), true);
});

test('host que EMPIEZA igual pero no es el mismo (192.168.1.50.evil.test) → externo', () => {
  assert.equal(policy.isExternalRequest('http://192.168.1.50.evil.test/'), true);
});

test('Google Analytics → externo', () => {
  assert.equal(
    policy.isExternalRequest('https://www.google-analytics.com/analytics.js'),
    true
  );
});

test('data:, blob: y javascript: no se clasifican como tráfico HTTP externo', () => {
  assert.equal(policy.isExternalRequest('data:text/html;base64,PGgxPmE8L2gxPg=='), false);
  assert.equal(policy.isExternalRequest('blob:http://192.168.1.50:8080/uuid'), false);
  assert.equal(policy.isExternalRequest('javascript:void(0)'), false);
});

test('normaliza la base quitando trailing slash', () => {
  const p = createOriginPolicy('http://192.168.1.50:8080/');
  assert.equal(p.baseUrl, 'http://192.168.1.50:8080');
  assert.equal(p.baseOrigin, 'http://192.168.1.50:8080');
});

test('URL malformada → no se clasifica como externa', () => {
  assert.equal(policy.isExternalRequest('not a url'), false);
});
