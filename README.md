# Demonstração educacional de Engenharia Social

Node.js + Express e duas páginas HTML com CSS e JavaScript puro. Sem banco de dados, cookies de rastreamento, armazenamento local ou gravação de registros em disco pelo aplicativo.

## Rodar localmente

Instale Node.js 22 ou superior com npm. No terminal, dentro desta pasta:

```sh
npm install
npm start
```

Abra http://localhost:3000 e http://localhost:3000/painel. Para testar no celular na mesma rede, use o IP de rede do computador, por exemplo `http://192.168.1.10:3000`. Libere a porta no firewall se necessário. `localhost` no celular aponta para o próprio celular. Recursos como bateria podem ficar indisponíveis fora de HTTPS ou localhost.

A porta usa `process.env.PORT`, com padrão 3000. Para encerrar, pressione Ctrl+C. Reiniciar esvazia a memória.

## Arquivos

- `package.json`: única dependência de execução: Express.
- `server.js`: servidor, validação e array temporário.
- `public/index.html`: formulário, coleta e resultado.
- `public/painel.html`: painel público atualizado a cada 2 segundos.
- `test/server.test.js`: verificação das rotas, validação e isolamento dos campos.

## Como funciona

A coleta explícita começa ao clicar em Enviar Feedback. O navegador já envia seu IP ao visitar qualquer servidor; aqui os dados do experimento só entram no array no POST. O texto do textarea não é enviado, para não coletar informações pessoais digitadas acidentalmente.

`POST /api/coletar` aceita JSON de até 16 KB e retorna `{ "ok": true, "registro": {...} }`. O campo adicional permite exibir IP e horário do servidor na página pública. `GET /api/lista` retorna os registros mais recentes primeiro.

O banner solicitado está acompanhado da explicação de retenção: não há armazenamento permanente **pelo aplicativo**, mas até 500 registros ficam na RAM, disponíveis no painel público. Ao exceder esse limite, o mais antigo é descartado. Não há autenticação neste painel: qualquer pessoa com acesso ao site pode consultar a lista.

O navegador consulta `https://ipapi.co/json/` diretamente. Isso expõe o IP do visitante ao serviço externo, cujas políticas e registros não são controlados por este aplicativo. A hospedagem também pode manter logs de acesso. Portanto, não prometa ausência de armazenamento por terceiros. Documentação: https://ipapi.co/api/

Localização por IP pode apontar para a sede do provedor, uma VPN ou outra cidade. As coordenadas retornadas são estimativas por IP, não GPS. `org` identifica a organização da rede, que pode diferir da operadora comercial. Não há chamada a `navigator.geolocation` nem solicitação de câmera/microfone.

RAM, bateria e tipo de conexão não estão disponíveis em todos os navegadores. Falhas, bloqueios, limites da API e tempo excedido aparecem como indisponíveis. Núcleos são processadores lógicos reportados; RAM é aproximada; telas usam pixels CSS. `maxTouchPoints` indica suporte a toque, não prova que o dispositivo é mobile. User agent e platform podem ser reduzidos ou falsificados. Ausência de uma janela de permissão não significa ausência de implicações de privacidade.

## IP e proxy

Localmente, o servidor usa `req.socket.remoteAddress` (pode ser `127.0.0.1`, `::1`, endereço privado ou IPv4 mapeado em IPv6). Não é possível garantir um IP público em todos os ambientes.

Atrás de um proxy confiável, configure `TRUST_PROXY=true` para usar o primeiro IP válido de `x-forwarded-for`. Só ative se a infraestrutura substituir/normalizar esse cabeçalho: em acesso direto, ele pode ser falsificado. Confirme a configuração e a cadeia de proxies da hospedagem antes da palestra.

## Deploy no Render.com

1. Envie esta pasta para um repositório Git, sem `node_modules`.
2. No Render, escolha **New → Web Service** e conecte o repositório.
3. Se o projeto estiver numa subpasta, configure essa pasta como **Root Directory**.
4. Selecione o runtime **Node**, build command `npm install` e start command `npm start`.
5. O servidor já escuta em `0.0.0.0` e respeita a variável `PORT` da plataforma. Configure `TRUST_PROXY=true` somente conforme a seção acima.
6. Aguarde o deploy e abra o endereço HTTPS fornecido. Use esse endereço no QR Code e acrescente `/painel` para o palestrante.
7. Mantenha **uma única instância/processo**: arrays em memória não são compartilhados entre instâncias. Reinícios, suspensão e novos deploys apagam os registros.

Passos baseados na documentação oficial: https://render.com/docs/deploy-node-express-app e https://render.com/docs/web-services

Não há necessidade de disco persistente ou banco. Teste o endereço publicado antes do evento, pois rede, políticas do navegador e cotas do serviço de localização podem afetar a demonstração.

## Verificação

```sh
npm test
```

Na página pública, envie com o textarea vazio: os dados devem aparecer no terminal e no painel. Bloqueie o acesso ao ipapi.co: o envio deve continuar com localização indisponível. Reinicie o servidor: a lista deve estar vazia. Evite registrar dados reais em capturas ou gravações da palestra sem autorização dos participantes.
