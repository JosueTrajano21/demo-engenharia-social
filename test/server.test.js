'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');

test('rotas, coleta temporária e validação', async () => {
  const servidor = app.listen(0, '127.0.0.1');
  await new Promise(resolve => servidor.once('listening', resolve));
  const base = 'http://127.0.0.1:' + servidor.address().port;
  try {
    for (const rota of ['/', '/painel']) {
      const resposta = await fetch(base + rota);
      assert.equal(resposta.status, 200);
      assert.match(await resposta.text(), /<!doctype html>/i);
    }
    assert.deepEqual(await (await fetch(base + '/api/lista')).json(), []);
    const resposta = await fetch(base + '/api/coletar', { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.77' },
      body: JSON.stringify({ userAgent: '<script>teste</script>', languages: ['pt-BR'],
        feedback: 'NÃO RETER', timestamp: 'falso', localizacao: { cidade: 'Teste' } }) });
    const retorno = await resposta.json();
    assert.equal(retorno.ok, true);
    assert.equal(retorno.registro.ip, '127.0.0.1');
    assert.equal(retorno.registro.feedback, undefined);
    assert.equal(retorno.registro.localizacao.cidade, null);
    assert.match(retorno.registro.localizacao.status, /local ou privado/);
    assert.notEqual(retorno.registro.timestamp, 'falso');
    const lista = await fetch(base + '/api/lista');
    assert.equal(lista.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await lista.json(), [retorno.registro]);
    const invalido = await fetch(base + '/api/coletar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '[]' });
    assert.equal(invalido.status, 400);
    const malformado = await fetch(base + '/api/coletar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformado.status, 400);
  } finally { await new Promise(resolve => servidor.close(resolve)); }
});
