# helper-sghx — instruções para o Claude

- Leia `CONTRIBUTING.md`: o fluxo é **TDD obrigatório** (testes → código → integração → PR). Nunca implemente sem antes escrever os testes da issue.
- **Sempre prefira os agentes/comandos/skills do ECC** a qualquer fluxo padrão do Claude Code para trabalho de código (ver seção "ECC é o padrão" abaixo).
- Uma issue = uma branch = um PR com `Closes #N`. Nunca commitar direto na `main`.
- Repositório **público**: jamais incluir dados de paciente, credenciais ou prints sem tarja em código, fixtures, commits ou issues.
- **Não usar o código legado** (`legacy/`). A referência de telas, seletores, endpoints e catálogos do SGHx é a skill `sghx` (`~/.claude/skills/sghx`, carregar via Skill). Tela não mapeada → mapear na skill antes de implementar.
- A extensão preenche campos, mas **nunca salva sem confirmação do médico**. Ao mapear telas com a skill, seguir as regras de somente leitura dela.
- Idioma: código e identificadores em inglês; issues, docs, textos de UI e commits em português.

## ECC é o padrão para tudo que envolve código

O plugin **ECC** (`ecc@ecc`, instalado globalmente) é **preferido ao comportamento padrão do Claude Code**. Antes de criar, alterar, revisar, depurar ou refatorar código, **procure primeiro o agente, comando ou skill do ECC** que cubra a tarefa e use-o. Só siga sem ECC se nenhum se aplicar — e diga isso explicitamente. Se o plugin não estiver disponível na sessão, avise antes de continuar.

### Fluxo de uma issue

1. `/ecc:issue-review <número>` — confrontar a issue com o código atual.
2. `/ecc:plan` antes de escrever qualquer código; **aguardar aprovação do plano**.
3. Implementar com a skill `tdd-workflow` do ECC (teste falhando primeiro, depois o código) — é o TDD obrigatório do `CONTRIBUTING.md`.
4. Antes de concluir, rodar `/ecc:code-review` (revisão com contexto limpo) e corrigir os achados.
5. Build ou testes quebrados → `/ecc:build-fix`.
6. Conferência final com a skill `verification-loop`; referenciar `#N` nos commits e `Closes #N` no PR.

### Qual agente ECC usar

| Situação | Agente / comando ECC |
|---|---|
| Entender o código antes de mudar | `code-explorer` |
| Planejar / desenhar solução | `/ecc:plan` (`planner`), `architect` |
| Implementar | skill `tdd-workflow`, agente `tdd-guide` |
| Revisar | `/ecc:code-review`, `code-reviewer`, `typescript-reviewer` |
| Segurança e dados de paciente | `security-reviewer`, `healthcare-reviewer` |
| Build / testes quebrados | `/ecc:build-fix` (`build-error-resolver`) |
| Limpeza e documentação | `refactor-cleaner`, `doc-updater` |

Instalação (uma vez, dentro do Claude Code): `/plugin marketplace add https://github.com/affaan-m/ECC` e `/plugin install ecc@ecc`.
