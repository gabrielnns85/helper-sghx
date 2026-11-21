# Detecção da tela ativa (`src/core/screen`)

Cada automação só pode agir na tela certa (issue #5). O módulo identifica a tela
ativa do SGHx pelo DOM e avisa quando ela muda. Roda no **mundo isolado**
(`content.js`) e chega às funcionalidades como `ctx.screen`.

## Telas reconhecidas

| `id` | Como é reconhecida (skill `sghx`, `referencia/MAPA.md`) |
|---|---|
| `login` | `#inputUsuario` (tela de login) ou `#comboEstabelecimento` (modal de contexto) — §1 |
| `fila` | `#Fila_CodAgrupamento`, sem modal de tela aberto — §2 |
| `consulta` | `#Consulta_Modal` no topo (consulta normal **e** complementar) — §3 |
| `prescricao` | `#PrescricaoMedicamento_Modal` no topo; os submodais `#PosologiaMedicamentoModal`, `#PosologiaModal` e `#JustificativaFarmaciaExternaModal` também contam como prescrição — §4.6 |
| `solicitacao-procedimento` | `#SolicitacaoProcedimentos_Modal` no topo — §4.3 |
| `atestado` | `#ModalQuestionario` no topo **com título "Atestado Médico"** — §4.8 |
| `unknown` | Modal não mapeado no topo (EMAD, Orientações…) ou nenhuma regra casou |

Regras:

- A tela ativa é a do **modal de tela visível de cima** (o último `.lightbox` visível
  na ordem do DOM). Sem modal, vale a tela de fundo (login ou fila).
- **Pop-ups** (`.lightbox` com `.bootstrap-dialog-message`) não mudam a tela.
- Modal desconhecido por cima dá `unknown`, **nunca a tela de baixo**: assim nenhuma
  automação preenche uma consulta escondida atrás de outro modal.
- `stack` traz a pilha do fundo para o topo, ex.: `['fila', 'consulta', 'prescricao']`.

## Uso numa funcionalidade

```js
import { SCREEN } from '../core/screen/index.js';

export const atestado = {
  id: 'atestado',
  init({ screen }) {
    if (screen.current().id === SCREEN.ATESTADO) mostrarBotoes();
    screen.subscribe(({ previous, current }) => {
      if (current.id === SCREEN.ATESTADO) mostrarBotoes();
      else if (previous.id === SCREEN.ATESTADO) esconderBotoes();
    });
  },
};
```

- `screen.current()` → `{ id, stack }` (objeto congelado).
- `screen.subscribe(fn)` → devolve a função para cancelar. O evento é
  `{ previous, current }` e só sai quando a pilha muda; digitar ou abrir um pop-up
  não emite nada.
- O erro de um ouvinte é registrado no console e não impede os outros.
- Para checar uma vez, sem observar: `detectScreen({ root })`.

## Limites conhecidos

- O atestado aberto pelo menu (*Usuário > Atestado*, `AtestadoMedico/AtestadoMedicoToModal`)
  ainda não está mapeado na skill e aparece como `unknown`. Só o atestado das
  Ferramentas do SOAP é reconhecido.
- O "modal de cima" é o último na ordem do DOM (mesma premissa de `getOpenDialogs`).

## Tela nova

1. Mapeie a tela na skill `sghx` (id do modal e, se o modal for genérico, o título).
2. Acrescente a regra em `src/core/screen/screens.js` (`MODAL_RULES` ou `PAGE_RULES`).
3. Crie a fixture sintética em `tests/fixtures/` e o caso em `tests/unit/screen-detect.test.js`.
