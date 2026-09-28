'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { criarLocalizador } = require('../geolocalizacao');

test('consulta IP explícito, mapeia v3, agrupa chamadas e expira cache', async () => {
  let chamadas = 0;
  let tempo = 0;
  const localizar = criarLocalizador({ obterChave: () => 'chave-de-teste', agora: () => tempo,
    requisitar: async url => {
      chamadas++;
      assert.equal(url.origin, 'https://api.ipgeolocation.io');
      assert.equal(url.searchParams.get('ip'), '8.8.8.8');
      assert.equal(url.searchParams.get('apiKey'), 'chave-de-teste');
      return { ok: true, json: async () => ({ location: { city: 'Exemplo', state_prov: 'Região',
        country_name: 'País', latitude: '0', longitude: '-30.5' }, asn: { organization: 'Rede' } }) };
    } });
  const [a, b] = await Promise.all([localizar('::ffff:8.8.8.8'), localizar('8.8.8.8')]);
  assert.deepEqual(a, b);
  assert.equal(a.cidade, 'Exemplo');
  assert.equal(a.latitude, 0);
  assert.equal(a.operadora, 'Rede');
  assert.equal(JSON.stringify(a).includes('chave-de-teste'), false);
  await localizar('8.8.8.8');
  assert.equal(chamadas, 1);
  tempo = 300001;
  await localizar('8.8.8.8');
  assert.equal(chamadas, 2);
});

test('IP local e chave ausente não geram consultas externas', async () => {
  const localizar = criarLocalizador({ obterChave: () => '', requisitar: () => { throw new Error('Não deveria consultar'); } });
  for (const ip of ['127.0.0.1', '::1', '::ffff:192.168.0.1', '10.0.0.1', 'fc00::1']) {
    assert.match((await localizar(ip)).status, /local ou privado/);
  }
  assert.match((await localizar('8.8.8.8')).status, /não configurada/);
});

test('falhas da API não vazam segredo e permitem continuar o registro', async () => {
  for (const codigo of [401, 403, 429, 500]) {
    const localizar = criarLocalizador({ obterChave: () => 'segredo',
      requisitar: async () => ({ ok: false, status: codigo }) });
    assert.match((await localizar('8.8.8.8')).status, new RegExp('HTTP ' + codigo));
  }
  const localizar = criarLocalizador({ obterChave: () => 'segredo',
    requisitar: async () => { throw new Error('URL com segredo'); } });
  assert.equal(JSON.stringify(await localizar('8.8.8.8')).includes('segredo'), false);
});

test('timeout aborta a consulta', async () => {
  const localizar = criarLocalizador({ obterChave: () => 'teste', timeoutMs: 10,
    requisitar: (url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('abortado')), { once: true });
    }) });
  assert.match((await localizar('8.8.8.8')).status, /tempo de espera/);
});
