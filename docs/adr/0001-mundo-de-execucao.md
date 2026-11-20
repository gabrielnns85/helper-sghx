# ADR 0001 — Mundo de execução dos content scripts

- **Status:** aceita
- **Data:** 2026-11-20
- **Issue:** #2

## Contexto

O SGHx é ASP.NET MVC + jQuery + **Knockout.js** + DevExtreme. Várias automações
previstas precisam do estado da página, que só existe no JavaScript dela: `ko.contextFor(...)`,
`jQuery`, `ajax`, `loadModal`, `globalCodFces` etc. (skill `sghx`, SKILL.md › Mapa rápido).

No Manifest V3 um content script roda em um de dois mundos:

| | Mundo isolado (padrão) | Mundo `MAIN` |
|---|---|---|
| Acesso a `ko`, `jQuery`, globais do SGHx | não | sim |
| Acesso a `chrome.storage`, `chrome.runtime` | sim | não |
| A página pode alterar nosso código | não | sim |

As issues #6 (armazenamento) e #8 (configuração) dependem de `chrome.storage`.

## Decisão

**Modelo híbrido:**

1. `content.js`, no **mundo isolado**, tem a interface (`src/ui`), as funcionalidades
   (`src/features`) e todo acesso a `chrome.*`.
2. `page-bridge.js`, declarado no manifest com `"world": "MAIN"`, é uma **ponte mínima**
   que executa apenas os comandos de uma lista fechada (`src/core/bridge-handlers.js`).
3. Os dois conversam por `window.postMessage` com o protocolo de `src/core/bridge-protocol.js`:
   `{ source: 'helper-sghx', v: 1, dir: 'request' | 'response', id, type, payload | ok/error }`.
   Os dois lados aceitam só mensagens da própria janela (`event.source === window`) e da
   própria origem, e o `targetOrigin` é sempre `location.origin`.

`world: "MAIN"` no manifest exige Chrome/Edge **111+** (`minimum_chrome_version`).

## Regras para a ponte

- Toda a lógica fica no mundo isolado. A ponte só lê o estado da página ou chama funções dela.
- **Qualquer script da página pode chamar a ponte**: ela nunca deve expor algo que a página
  não possa fazer sozinha, nem dados vindos de `chrome.storage`.
- Do lado isolado, as **respostas da ponte não são confiáveis** (a página pode forjá-las).
  Valide antes de usar e nunca as insira como HTML.
- Comando novo = handler novo em `createPageHandlers` + teste. Comandos que **salvam** no
  prontuário continuam sujeitos à confirmação do médico, que é feita no mundo isolado.

## Alternativas descartadas

- **Tudo no mundo `MAIN`:** perde `chrome.storage`/`chrome.runtime` (exigiria ponte no sentido
  contrário) e deixa toda a extensão exposta à página.
- **Tudo no mundo isolado, injetando `<script>` inline quando preciso:** depende da CSP da
  página e espalha código injetado pelo projeto. A ponte declarada no manifest centraliza isso.

## Consequências

- Acesso a Knockout é assíncrono (`await bridge.request(...)`).
- Os dois scripts são injetados de forma independente: o cliente usa timeout e o
  `content.js` repete o `ping` inicial algumas vezes.
