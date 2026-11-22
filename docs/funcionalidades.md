# Contrato de funcionalidade

Issue #8. Toda funcionalidade da extensão (login, fila, atestado, prescrição…) tem até duas camadas além do
próprio código: **configuração** (página de opções) e **interface** (painel no SGHx). Este contrato diz onde cada
uma fica, para que as fases F3 (configuração) e F4 (botões) de cada épico sejam previsíveis.

## 1. Registro

A funcionalidade é `{ id, init(ctx) }`, registrada em `src/features/index.js`. O `ctx` traz `site`, `session` e
`settings` em todos os sites e, no SGHx, também `bridge` e `screen`. Ver [storage.md](storage.md) e
[screen-detection.md](screen-detection.md).

## 2. Camada de configuração (quando houver opções)

Funcionalidades F1 (texto fixo) não têm opções. A partir da F3:

| O quê | Onde |
|---|---|
| Padrões (forma e tipos) | `src/core/storage/defaults.js`, numa chave própria (ex.: `queueRefresh`) |
| Regras de valor (limites, listas aceitas) | `src/core/storage/settings-rules.js` |
| Campos na página de opções | `src/options/options.html`, num `<fieldset data-setting="<chave>">` |
| Conversão formulário ⇄ configuração | `src/options/form.js` (`settingsToForm` / `formToSettings`) |
| Testes | `tests/unit/storage-settings-rules.test.js`, `options-form.test.js`, `options-page.test.js` |

Regras:

- **Toda automação** (algo que age sozinho: login, atualizar a fila…) tem um **liga/desliga**, que começa
  **desligado**.
- A funcionalidade lê com `ctx.settings.get('<chave>')` e reage a mudanças com `ctx.settings.subscribe`, **sem
  recarregar** a página nem a extensão.
- Nada de dado de paciente nem senha nas configurações (senhas vão para o cofre, #64).
- **Trava automática:** o teste da página de opções confere que cada chave de `DEFAULT_SETTINGS` tem a sua seção
  `data-setting` na página. Opção que o médico não consegue ver não passa no CI.

## 3. Camada de interface (quando houver ação ou estado visível)

Se a funcionalidade tem botão, atalho ou estado que o médico precisa ver (ex.: pausar/retomar a fila), ela
registra uma **seção no painel** do SGHx, habilitada conforme a tela (`screen.current().id`).

> A API de seções do painel nasce na #7. Até lá, este item fica como contrato: a funcionalidade não cria UI
> própria solta na página do SGHx.

## 4. Segurança

- A extensão preenche campos, mas **nunca salva no prontuário sem confirmação do médico** (salvo configuração
  explícita em contrário, que então é uma opção desta página, desligada por padrão).
- Funcionalidades em outros sites mostram de qual paciente é o atendimento antes de agir (ver
  [storage.md](storage.md) › Paciente certo).

## Checklist do PR de uma funcionalidade

- [ ] `id` único e `init(ctx)` registrado
- [ ] Opções (se houver): padrão em `defaults.js`, regras em `settings-rules.js`, seção `data-setting` na página
- [ ] Automação: liga/desliga começando desligado; mudança aplicada via `subscribe`
- [ ] Ação ou estado visível: seção no painel (#7)
- [ ] Testes das regras, da leitura da configuração e do fallback para o padrão
