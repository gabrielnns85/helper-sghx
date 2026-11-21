# Helpers de DOM (`src/core/dom`)

Biblioteca única usada por todas as automações para preencher campos, esperar
elementos e lidar com pop-ups do SGHx (issue #4). Tudo é importado de
`src/core/dom/index.js` e roda no **mundo isolado** (`content.js`). O que exige o
JavaScript da página vai pela ponte (ver [ADR 0001](adr/0001-mundo-de-execucao.md)).

> A extensão preenche, mas **nunca salva sem confirmação do médico**. Nenhum helper
> clica em Salvar, e `confirmDialog` recusa pop-ups que parecem gravar no prontuário.

## Esperar

```js
import { waitFor, waitForElement, waitForGone } from '../core/dom/index.js';

const modal = await waitForElement('#Consulta_Modal', { visible: true });
await waitFor(() => document.querySelectorAll('tr[data-model]').length > 0, {
  timeout: 15000,
  description: 'linhas da fila',
});
await waitForGone('.loading');
```

- Timeout padrão: 10 s. Ao estourar, lança `TimeoutError` com a mensagem
  `Tempo esgotado (15000 ms) aguardando: linhas da fila`, mais o último erro da
  condição, se houve.
- "Visível" = conectado ao documento, sem ancestral `display:none`/`hidden` e sem
  `visibility:hidden`.

## Preencher campos

```js
import { setFieldValue } from '../core/dom/index.js';

await setFieldValue('#txtNomeAcompanhante', 'TEXTO');
await setFieldValue('#bpaPrincipal', '0301060096');            // value
await setFieldValue('#bpaPrincipal', 'atendimento medico em unidade de pronto atendimento'); // texto inteiro
await setFieldValue('#IndImprimeDescricaoCid', true);           // checkbox
await setFieldValue('#CodEncaminhamento1', 'US dentro do município'); // radio do grupo, pelo label
await setFieldValue('.comboMedicamento', 'DIPIRONA 500 MG COMPRIMIDO', { bridge }); // DevExtreme
await setFieldValue('#algumElemento', 5, { observable: 'NumDias', bridge });       // view-model
```

| Campo | Como preenche |
|---|---|
| input, textarea, data (datepicker) | setter nativo + `input`, `change`, `blur` |
| select | pelo `value` ou pelo texto completo da opção (sem acentos/maiúsculas) |
| checkbox / radio | clique de verdade (o binding `checked` do Knockout escuta `click`) |
| `.dx-widget` (DevExtreme) | ponte → `instance.option('value', …)`; em SelectBox/Lookup/TagBox casa pelo valor ou pelo texto exibido |
| opção `observable` | ponte → `ko.dataFor(el)[nome](valor)` |

Os eventos nativos bastam para os bindings `value`, `textInput`, `checked` e
`options` do Knockout e para handlers jQuery: não é preciso a ponte para campos
comuns.

Erros: `ElementNotFoundError`, `OptionNotFoundError` (lista as opções),
`ValueNotAppliedError` (a página mudou ou recusou o valor) e `DomHelperError`
(campo desabilitado/somente leitura, falta a ponte etc.). Opções: `blur: false`,
`verify: false` (campos com máscara que reformatam o valor) e `force: true`
(readonly/disabled).

Para a ponte achar o mesmo elemento, o lado isolado marca o elemento com
`data-helper-sghx-ref` e envia esse seletor.

## Pop-ups

O framework da Fastmedic monta a marcação do BootstrapDialog à mão:
`div.lightbox > .modal-content.light-content` com `.bootstrap-dialog-title`,
`.bootstrap-dialog-message` e os botões em `.bootstrap-dialog-footer-buttons a`.
Pop-up de erro tem `.modal-header.erro`. Clicar num botão remove o `.lightbox`.

```js
import { getOpenDialogs, waitForDialog, confirmDialog } from '../core/dom/index.js';

getOpenDialogs(); // [{ el, title, message, isError, buttons: [{ el, text }] }], o último é o de cima
const erro = await waitForDialog({ text: /obrigatório/i, timeout: 3000 });
await confirmDialog({ text: /sair sem salvar/, button: 'Sim' });
```

`confirmDialog` exige `text` e `button`: não existe botão padrão. Ele recusa pop-ups
com "salvar", "gravar", "assinar", "alta" ou "liberado" (exceto "sair sem salvar").
Use `allowSave: true` só quando o médico já confirmou a gravação no painel.

## Clicar e esperar

```js
import { clickAndWait } from '../core/dom/index.js';

await clickAndWait('span.btn-pesquisar', '#modalPesquisaProcedimentoCompleto');
await clickAndWait('#btnFiltrar', () => document.querySelector('#grid tbody tr'));
const aviso = await clickAndWait('#btnInserir', { dialog: /já existe/i }); // só pop-up novo
await clickAndWait('#btnFechar', { gone: '#ModalX' });
```

Um único clique nativo. Não clica em elemento desabilitado. O erro de timeout diz o
que foi clicado.

## Testes

`tests/unit/dom-*.test.js` com fixtures sintéticas `tests/fixtures/dom-*.html`.
Knockout e jQuery são os reais (devDependencies); o DevExtreme é um stub
(`tests/helpers/fake-devextreme.js`). `tests/helpers/dialogs.js` cria pop-ups com a
mesma estrutura do framework.

## Fora do escopo

- **jqGrid**: não aparece no SGHx mapeado; as grades são tabelas com Knockout.
- **Editor rich-text** (Orientações) e outros widgets DevExtreme além do SelectBox:
  DateBox/TextBox etc. só pelo `option('value')` genérico. Mapear na skill `sghx`
  antes de precisar.
- `#popupMSG`: estrutura ainda não mapeada.
