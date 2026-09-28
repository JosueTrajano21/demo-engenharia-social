'use strict';
const express = require('express');
const path = require('node:path');
const { isIP } = require('node:net');
const { criarLocalizador } = require('./geolocalizacao');
const localizar = criarLocalizador();
const app = express();
const registros = []; // Apenas RAM: reiniciar o processo elimina os registros.
const MAX_REGISTROS = 500;
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  next();
});
app.use(express.json({ limit: '16kb' }));

// Lista explícita: o feedback e campos arbitrários não são retidos.
const campos = ['userAgent', 'language', 'languages', 'platform', 'hardwareConcurrency',
  'deviceMemory', 'screen', 'viewport', 'devicePixelRatio', 'timeZone',
  'maxTouchPoints', 'effectiveType', 'cookieEnabled', 'battery', 'localDateTime'];
function valorSimples(valor) {
  return typeof valor === 'string' ? valor.slice(0, 1500)
    : typeof valor === 'boolean' || (typeof valor === 'number' && Number.isFinite(valor)) ? valor : null;
}
app.post('/api/coletar', async (req, res) => {
  if (!req.is('application/json') || !req.body || Array.isArray(req.body) || typeof req.body !== 'object') {
    return res.status(400).json({ ok: false, erro: 'Envie um objeto JSON.' });
  }
  const dados = {};
  for (const campo of campos) {
    dados[campo] = campo === 'languages' && Array.isArray(req.body[campo])
      ? req.body[campo].slice(0, 20).map(valorSimples) : valorSimples(req.body[campo]);
  }
  // Ative somente atrás de um proxy confiável que normalize x-forwarded-for.
  const encaminhado = process.env.TRUST_PROXY === 'true'
    ? req.get('x-forwarded-for')?.split(',')[0].trim() : null;
  const registro = { ...dados, ip: encaminhado && isIP(encaminhado) ? encaminhado : req.socket.remoteAddress,
    timestamp: new Date().toISOString() };
  // O servidor determina o IP; ignora localização e IP enviados no corpo pelo navegador.
  registro.localizacao = await localizar(registro.ip);
  registros.unshift(registro);
  registros.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  if (registros.length > MAX_REGISTROS) registros.length = MAX_REGISTROS;
  // Devolver o próprio registro permite mostrar também IP e hora do servidor.
  res.json({ ok: true, registro });
});
app.get('/api/lista', (req, res) => res.json(registros));
app.get('/painel', (req, res) => res.sendFile(path.join(__dirname, 'public', 'painel.html')));
app.use(express.static(path.join(__dirname, 'public'), { etag: false, lastModified: false }));
app.use((err, req, res, next) => {
  res.status(err.type === 'entity.too.large' ? 413 : 400).json({ ok: false, erro: 'JSON inválido ou maior que 16 KB.' });
});
if (require.main === module) {
  app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('Demonstração iniciada. Nenhum registro é gravado em disco.'));
}
module.exports = app;
