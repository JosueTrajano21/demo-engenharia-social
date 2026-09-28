'use strict';
const { isIP } = require('node:net');

// Injeção de dependências permite testar sem enviar IPs nem consumir créditos.
function criarLocalizador({ requisitar = (...args) => fetch(...args),
  obterChave = () => process.env.IPGEOLOCATION_API_KEY,
  agora = Date.now, timeoutMs = 6000 } = {}) {
  const cache = new Map();
  const pendentes = new Map();
  const limite = 500;
  const falha = status => ({ status, cidade: null, regiao: null, pais: null,
    operadora: null, latitude: null, longitude: null });
  const texto = valor => typeof valor === 'string' ? valor.slice(0, 200) : null;
  const coordenada = (valor, maximo) => {
    if (valor == null || valor === '') return null;
    const numero = Number(valor);
    return Number.isFinite(numero) && Math.abs(numero) <= maximo ? numero : null;
  };
  async function consultar(ip, chave) {
    const url = new URL('https://api.ipgeolocation.io/v3/ipgeo');
    url.searchParams.set('apiKey', chave);
    url.searchParams.set('ip', ip); // Sem isso, seria consultado o IP do Render.
    const controle = new AbortController();
    const temporizador = setTimeout(() => controle.abort(), timeoutMs);
    try {
      // A URL contém um segredo: não registrar URL, resposta bruta ou erros em logs.
      const resposta = await requisitar(url, { signal: controle.signal, redirect: 'error',
        headers: { Accept: 'application/json' } });
      if (!resposta.ok) {
        const motivos = { 401: 'Chave da API ausente ou inválida',
          403: 'Acesso à API recusado; confira a chave e o plano',
          429: 'Limite de créditos ou consultas da API atingido' };
        return falha((motivos[resposta.status] || 'Falha no serviço de localização') + ' (HTTP ' + resposta.status + ')');
      }
      const dados = await resposta.json();
      const local = dados?.location;
      if (!local || typeof local !== 'object' || Array.isArray(local) || dados.error) {
        return falha('Resposta inesperada do serviço de localização');
      }
      return { status: 'Aproximada, baseada no IP — pode estar incorreta',
        cidade: texto(local.city), regiao: texto(local.state_prov), pais: texto(local.country_name),
        operadora: texto(dados.asn?.organization),
        latitude: coordenada(local.latitude, 90), longitude: coordenada(local.longitude, 180) };
    } catch (erro) {
      return falha(controle.signal.aborted ? 'Serviço de localização excedeu o tempo de espera'
        : erro instanceof SyntaxError ? 'Serviço de localização não retornou JSON válido'
          : 'Não foi possível consultar o serviço de localização');
    } finally { clearTimeout(temporizador); }
  }
  return async function localizar(endereco) {
    const ip = (endereco || '').replace(/^::ffff:/i, '');
    if (!isIP(ip)) return falha('IP inválido ou indisponível');
    // Não enviar endereços locais: eles não possuem localização pública útil.
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(ip)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
      || /^(::1$|::$|f[cd]|fe[89ab])/i.test(ip)) return falha('IP local ou privado: sem localização pública');
    const chave = obterChave()?.trim();
    if (!chave) return falha('Localização não configurada: defina IPGEOLOCATION_API_KEY no servidor');
    for (const [chaveCache, item] of cache) if (item.expira <= agora()) cache.delete(chaveCache);
    if (cache.has(ip)) return cache.get(ip).valor;
    if (pendentes.has(ip)) return pendentes.get(ip);
    if (pendentes.size >= 20) return falha('Muitas consultas simultâneas; tente novamente mais tarde');
    const tarefa = consultar(ip, chave).then(valor => {
      if (cache.size >= limite) cache.delete(cache.keys().next().value);
      // Sucessos por 5 minutos; falhas por 15 segundos para conter repetições.
      cache.set(ip, { valor, expira: agora() + (valor.status.startsWith('Aproximada') ? 300000 : 15000) });
      return valor;
    }).finally(() => pendentes.delete(ip));
    pendentes.set(ip, tarefa);
    return tarefa;
  };
}
module.exports = { criarLocalizador };
