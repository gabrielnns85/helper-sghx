# Camada de armazenamento

Issue #6 · decisões em [ADR 0002](adr/0002-armazenamento-sessao-configuracoes.md) · código em `src/core/storage/`.

## Três camadas

| Camada | O que guarda | Onde | Some quando |
|---|---|---|---|
| **Sessão** | dados do paciente e do atendimento em tela | `chrome.storage.session` (memória), só pelo service worker | volta à fila, login/logout, saída da página, aba fechada, navegador fechado |
| **Configurações** | preferências sem segredo (unidade, fila, liga/desliga) | `chrome.storage.local` (um perfil do Chrome por médico) | nunca, até o médico mudar |
| **Cofre** (#64) | senhas dos outros sites | `chrome.storage.local`, criptografado numa segunda etapa | nunca |

**Dados de paciente nunca vão para `local` nem `sync`.** Testes estáticos conferem que o código da sessão não usa
`storage.local`/`sync`, e `settings.set` só aceita chaves e formas declaradas em `defaults.js`.

## Sites

`src/core/sites.js` é a lista única de sites (usada pelo manifest e pelo service worker):

| id | URL | Sessão |
|---|---|---|
| `sghx` | `https://*.smsprefeiturasp.com.br/*` | dono: abre, assume e apaga |
| `mobilemed` | `https://laudos.mobilemed.com.br/*` | lê e grava no atendimento ativo |
| `siresp` | `https://www.siresp.saude.sp.gov.br/*` | lê e grava no atendimento ativo |
| `lisnet` | `https://biomega.lisnet.com.br/laudos/*` | lê e grava no atendimento ativo |

Os sites externos têm o próprio content script (`src/sites/external.js`), sem ponte com a página. Eles funcionam
**com ou sem o SGHx aberto**: sem atendimento, `session.current()` é `null` e a funcionalidade roda isolada
(login, copiar dados para a área de transferência). Site novo = entrada em `sites.js` + `matches` no manifest
(o teste do manifest confere as duas coisas).

## Sessão do atendimento

```js
// ctx.session, em qualquer content script
await session.current();                 // { id } ou null
await session.get('paciente');           // valor congelado, ou null
await session.set('paciente', { ... });  // JSON puro
await session.set('rx', laudo, { expectId: id }); // recusa se o atendimento mudou
await session.clear();                   // só o SGHx
```

- **Por aba do SGHx.** Cada aba em consulta tem o próprio atendimento. O **ativo** é o da aba do SGHx usada por
  último (ficou visível ou recebeu foco), e é ele que os outros sites enxergam. No SGHx, `get`/`set` agem sempre
  no atendimento da própria aba.
- **Ciclo de vida** (`bindSessionToScreen`, só no SGHx): entrar na consulta abre um atendimento com `id` novo;
  modais dentro dela (prescrição, atestado, EMAD) não mudam nada; voltar à `fila` ou ao `login` apaga; sair da
  página (`pagehide`) apaga; tela `unknown` (ex.: sessão expirada) não muda nada. Fechar a aba apaga
  (`tabs.onRemoved` no worker).
- **Paciente certo.** Funcionalidades em outros sites devem mostrar ao médico de qual paciente é o atendimento
  ativo antes de agir, e gravar com `expectId` para não escrever num atendimento que mudou no meio.
- **Remetentes.** O worker só aceita mensagens desta extensão, vindas de uma aba, de um site da lista. Só o SGHx
  pode `start`/`claim`/`clear`.
- **Erros** chegam como `Error` com mensagem em português; nada de dado do paciente vai para o console.

## Configurações

```js
await settings.get();                    // padrões + salvas, congelado
await settings.get('queueRefresh');      // { enabled, intervalSec }
await settings.set({ queueRefresh: { enabled: true, intervalSec: 45 } });
```

- Cada chave substitui a anterior inteira e precisa ter **a mesma forma do padrão** (mesmas chaves, mesmos tipos).
  Chave ou campo desconhecido é recusado e nada é gravado.
- Valor salvo inválido (versão antiga) é ignorado com aviso e vale o padrão. Falha ao ler: aviso + padrões.
  Falha ao gravar: `Error`.
- Opção nova entra em `defaults.js` junto com a issue que a usa. Regras finas (ex.: intervalo mínimo de 15 s)
  e o aviso de mudança "sem recarregar" ficam com a #8.
