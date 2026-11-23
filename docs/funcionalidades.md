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
| Listas fixas (unidades, filas…) | `src/core/catalog.js`: a configuração guarda só o **código**, o nome vem daqui |
| Regras de valor (limites, listas aceitas) | `src/core/storage/settings-rules.js` |
| Campos na página de opções | `src/options/options.html`, num `<fieldset data-setting="<chave>">` |
| Conversão formulário ⇄ configuração | `src/options/form.js` (`settingsToForm` / `formToSettings`) |
| Testes | `tests/unit/storage-settings-rules.test.js`, `options-form.test.js`, `options-page.test.js` |

Regras:

- **Toda automação** (algo que age sozinho: login, atualizar a fila…) tem um **liga/desliga**, que começa
  **desligado**.
- A funcionalidade lê com `ctx.settings.get('<chave>')` e reage a mudanças com `ctx.settings.subscribe`, **sem
  recarregar** a página nem a extensão.
- Nada de dado de paciente nem senha nas configurações (senhas vão para o cofre, #64). Por isso, **sem texto
  livre**: escolhas viram códigos de um catálogo. Texto livre só com justificativa na issue e regra que o restrinja.
  **Exceção temporária (#10, fase de teste):** `autoLogin.user`/`autoLogin.password` (modo usuário e senha do
  login automático) ficam nas configurações, em texto puro, até o cofre da #64. A senha só é gravada nesse modo,
  nunca aparece em mensagem de erro nem no console e nunca passa pela ponte.
- Escolha que muda **o que o médico vê** (ex.: qual fila acompanhar) **não tem padrão silencioso**: começa vazia e
  a automação não liga sem ela.
- A mudança vale no **próximo ciclo** da automação, nunca no meio de uma ação em andamento.
- **Configurações nunca vão para a página do SGHx** pela ponte (mundo MAIN).
- Premissa: **um perfil do Chrome por médico**. Opção que age com a identidade do médico (ex.: login automático)
  avisa na página para não usar em computador compartilhado.
- **Trava automática:** o teste da página de opções confere que cada chave de `DEFAULT_SETTINGS` tem a sua seção
  `data-setting` na página. Opção que o médico não consegue ver não passa no CI.

## 3. Camada de interface (quando houver ação ou estado visível)

Se a funcionalidade tem botão, atalho ou estado que o médico precisa ver (ex.: pausar/retomar a fila), ela
registra uma **seção no painel** do SGHx, habilitada conforme a tela (`screen.current().id`).

**Automação de leitura** (ex.: atualizar a fila) mostra no painel, sempre:

- **o que está acompanhando** (ex.: o nome da fila);
- **"atualizado há X s"**;
- um **alerta visível** (não um aviso que some sozinho) quando falhar, parar (sessão expirada, modal aberto, erro de
  rede) ou passar de 2× o intervalo sem atualizar. O médico nunca pode achar que a tela está atual quando não está.

A API de seções e mensagens está em [ui-panel.md](ui-panel.md) (`ctx.ui`). A funcionalidade **não cria UI
própria solta** na página do SGHx: tudo passa pelo painel.

### Exemplo: atualizar a fila (#13, `src/features/queue-refresh`)

Na tela da fila, a cada 30 s (valor fixo na F1) clica em `#FilaToolbar_Atualizar` e reseleciona a categoria de
`settings.queueRefresh.queue`. Só roda com `queueRefresh.enabled` ligado e fila definida. Não atualiza com modal
(`.lightbox`) visível nem com o médico digitando (foco em campo de texto ou tecla nos últimos 5 s); tenta de novo
a cada 1 s, sem esperar outros 30 s. O painel mostra a fila, "atualizado há X s", o estado e **Pausar/Retomar**
(a pausa vale até recarregar a página). Fila vazia some da lista do SGHx: não é erro, o painel avisa. Botão
Atualizar ausente, erro no ciclo ou mais de 2× o intervalo sem atualizar viram alerta de erro visível. O timer
para ao sair da fila.

## 4. Segurança do paciente

- **Nunca salvar no prontuário sem confirmação do médico.** Nenhuma configuração pode dispensar isso: o botão
  final do SGHx (Salvar, Assinar, Imprimir, Enviar) é sempre clicado pelo médico. Um teste recusa opções do tipo
  `autoSave`/`autoSubmit` em `DEFAULT_SETTINGS`.
- **Paciente certo, também dentro do SGHx.** Antes de preencher com dados da sessão, conferir que o paciente na
  tela é o do atendimento da sessão; se não for, não preencher e avisar. Caso conhecido: consulta complementar que
  reaproveita o `#Consulta_Modal` sem reabrir o atendimento ([storage.md](storage.md) › Limites conhecidos).
- A confirmação mostra **de qual paciente** é a ação (nome e um identificador), sem gravar nada fora da sessão.
- O preenchimento é feito **na tela, à vista do médico**, nunca em segundo plano.
- Em outros sites, mostrar de qual paciente é o atendimento antes de agir ([storage.md](storage.md) › Paciente
  certo).

## Checklist do PR de uma funcionalidade

- [ ] `id` único e `init(ctx)` registrado
- [ ] Opções (se houver): padrão em `defaults.js`, regras em `settings-rules.js`, seção `data-setting` na página
- [ ] Sem texto livre nas configurações (códigos + catálogo); nada é repassado à página do SGHx
- [ ] Automação: liga/desliga começando desligado; escolhas que mudam o que o médico vê sem padrão silencioso;
      mudança aplicada via `subscribe` no próximo ciclo
- [ ] Ação ou estado visível: seção no painel (#7); automação de leitura mostra o que acompanha, "atualizado há
      X s" e alerta visível de falha
- [ ] **Nada grava no prontuário sem o clique do médico**
- [ ] Paciente na tela conferido com o da sessão antes de preencher
- [ ] Testes das regras, da leitura da configuração e do fallback para o padrão
