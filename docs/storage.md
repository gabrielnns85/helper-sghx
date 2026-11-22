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
| `sghx` | `https://*.smsprefeiturasp.com.br/*` | dono: abre, assume e apaga; lê e grava tudo na própria aba |
| `mobilemed` | `https://laudos.mobilemed.com.br/*` | lê o atendimento ativo; grava só em `mobilemed.*` |
| `siresp` | `https://www.siresp.saude.sp.gov.br/*` | lê o atendimento ativo; grava só em `siresp.*` |
| `lisnet` | `https://biomega.lisnet.com.br/laudos/*` | lê o atendimento ativo; grava só em `lisnet.*` |

Os sites externos têm o próprio content script (`src/sites/external.js`), sem ponte com a página. Eles funcionam
**com ou sem o SGHx aberto**: sem atendimento, `session.current()` é `null` e a funcionalidade roda isolada
(login, copiar dados para a área de transferência). Site novo = entrada em `sites.js` + `matches` no manifest
(o teste do manifest confere as duas coisas).

## Sessão do atendimento

```js
// No SGHx (ctx.session): age no atendimento da própria aba
await session.set('paciente', { ... });  // JSON puro, até 1 MB
await session.get('paciente');           // valor congelado, ou null

// Nos outros sites: sempre amarrado ao atendimento lido em current()
const atendimento = await session.current();          // { id } ou null (sem atendimento: modo isolado)
if (atendimento) {
  const paciente = await session.get('paciente', { expectId: atendimento.id });
  // mostrar ao médico de quem é o atendimento ANTES de agir
  await session.set('mobilemed.rx', laudo, { expectId: atendimento.id });
}
```

`get`/`set` com `expectId` recusam ("o atendimento mudou") se, entre `current()` e a chamada, o ativo trocou ou
foi apagado. Fora do SGHx o `expectId` é **obrigatório** e a gravação só vale em chaves `<site>.*`.

- **Por aba do SGHx.** Cada aba em consulta tem o próprio atendimento. O **ativo** é o da aba do SGHx que o
  médico usou por último, e é ele que os outros sites enxergam. "Usou" = foco na janela (com `document.hasFocus()`),
  clique ou tecla. Só ficar visível (a janela da frente fechou) **não** muda o ativo. Usar uma aba do SGHx fora
  da consulta (ex.: na fila) deixa o navegador **sem** atendimento ativo.
- **Ciclo de vida** (`bindSessionToScreen`, só no SGHx):
  - entrar na consulta abre um atendimento com `id` novo (ativo só se a janela tiver foco);
  - modais sobre a consulta (prescrição, atestado, EMAD, sessão expirada) não mudam nada;
  - sair da consulta para qualquer tela (fila, login, modal não mapeado sobre a fila) apaga;
  - sair da página (`pagehide`) apaga; voltar do bfcache refaz; fechar a aba apaga (`tabs.onRemoved` no worker).
- **Paciente certo.** Funcionalidades em outros sites devem mostrar ao médico de qual paciente é o atendimento
  ativo antes de agir, e usar sempre o `expectId` (o worker exige).
- **Remetentes.** O worker só aceita mensagens desta extensão, do frame de topo de uma aba, de um site da lista
  (inclusive o caminho: Lisnet só em `/laudos/`). Só o SGHx pode `start`/`claim`/`clear`.
- **Erros** chegam como `Error` com mensagem em português; nada de dado do paciente vai para o console.

## Limites conhecidos

- **Conferido no SGHx (22/11/2026):** consulta normal e complementar (retorno) abrem o atendimento; voltar à fila
  apaga. Filas de pronto atendimento só deixam um paciente aberto por vez.
- **Sala de Observação** (`#LeitoObservacao_Modal`) ainda não é reconhecida e permite vários pacientes em abas
  diferentes: fica para a #65 (atendimento de observação + aviso de vários pacientes abertos).
- **Troca de paciente sem fechar o `#Consulta_Modal`** (ex.: consulta complementar reaproveitando o modal): a
  pilha de telas não muda, então o atendimento não é reaberto. Quem ler a identidade do paciente (#16) deve
  chamar `session.start()` quando ela mudar.
- **`pagehide` perdido** (aba travada ou descartada): o atendimento fica até a aba fechar, o navegador fechar ou
  o SGHx carregar de novo (o content script apaga ao iniciar fora da consulta).
- **Curinga `*.smsprefeiturasp.com.br`:** necessário para as outras unidades da SMS-SP; qualquer subdomínio
  desse domínio é tratado como SGHx.

## Configurações

```js
await settings.get();                    // padrões + salvas, congelado
await settings.get('queueRefresh');      // { enabled, intervalSec, queue }
await settings.set({ queueRefresh: { ...atual, enabled: true, intervalSec: 45 } });
await settings.reset();                  // apaga o que foi salvo: voltam os padrões
const parar = settings.subscribe((todas) => { /* aplica sem recarregar */ });
```

- Cada chave substitui a anterior inteira e precisa ter **a mesma forma do padrão** (mesmas chaves, mesmos tipos).
  Chave ou campo desconhecido é recusado e nada é gravado.
- **Regras de valor** em `settings-rules.js` (`validateSetting(chave, valor)` devolve os erros por campo):
  intervalo da fila de 30 a 360 s, CodFces só 28 (UPA Jaçanã), nome da unidade e da fila não vazios, códigos da
  fila inteiros. `set` recusa valor fora das regras; a página de opções mostra o erro no campo.
- Valor salvo inválido (versão antiga, edição manual) é ignorado com aviso e vale o padrão. Falha ao ler: aviso +
  padrões. Falha ao gravar ou restaurar: `Error` com mensagem em português.
- **Sem recarregar:** `subscribe` escuta `chrome.storage.onChanged` e entrega as configurações completas (padrões +
  salvas válidas) a cada mudança, em todas as abas. Devolve a função que cancela a inscrição.
- A fila é guardada como o SGHx a identifica: `{ codAcaoDestino, codEspecialidade, indSituacao, label }`. A página
  de opções oferece as filas conhecidas da skill (`src/options/queues.js`); a #14 passa a listar pelo endpoint.
- Opção nova segue o [contrato de funcionalidade](funcionalidades.md): padrão em `defaults.js`, regras em
  `settings-rules.js` e seção na página de opções (`src/options/`).
