# Como contribuir

## Fluxo obrigatório de toda issue (TDD)

Toda funcionalidade, correção ou refatoração segue **esta ordem**, sem pular etapas:

1. **Testes unitários primeiro** — escreva os testes que descrevem os critérios de aceite da issue. Eles devem **falhar** (vermelho). Use fixtures HTML **anonimizadas** em `tests/fixtures/` para simular as telas do SGHx.
2. **Código** — implemente o mínimo para os testes passarem (verde). Refatore mantendo verde.
3. **Implementação/integração** — ligue o código à extensão (painel, configuração, detecção de tela) e teste manualmente no navegador com a extensão carregada em modo desenvolvedor.
4. **Pull Request** — só com tudo funcionando (testes verdes no CI + teste manual ok) abra o PR com `Closes #N` para avaliação. Nada vai para `main` sem PR revisado.

## Definição de pronto (DoD)

- [ ] Testes unitários cobrindo os critérios de aceite, escritos antes do código
- [ ] `npm test` verde localmente e no CI
- [ ] Testado manualmente no SGHx (ou ambiente equivalente)
- [ ] Ações que **salvam** no prontuário exigem confirmação explícita do médico (salvo configuração explícita em contrário)
- [ ] Nenhum dado real de paciente ou credencial no código, fixtures, prints, commits ou issues
- [ ] CHANGELOG / versão do `manifest.json` atualizados quando aplicável

## Organização das issues

- **Épico** (`type:epic`): agrupa uma funcionalidade; as fases são **sub-issues**.
- **Fases** padrão de uma funcionalidade:
  - **F1 — MVP com texto fixo**: comportamento fixo no código, sem opções.
  - **F2 — Lista de possibilidades**: o médico escolhe entre opções pré-definidas.
  - **F3 — Configuração**: opções editáveis na página de configuração.
  - **F4 — Botões de atalho**: múltiplos botões rápidos no painel.
- Cada fase é uma issue = um PR. Uma issue só entra em `status:ready` quando suas dependências estão fechadas.
- Prioridade: `priority:P0` → milestone **MVP**; `P1` → **Pós-MVP**; `P2` → **Futuro**.

## Branches e commits

- Branch por issue: `feat/<n>-descricao`, `fix/<n>-descricao`, `chore/<n>-descricao`.
- Commits no padrão Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`, `docs:`, `refactor:`).

## Código legado

O *PEP Form Bot* (v1.5.9.4) fica em `legacy/` **apenas localmente** (fora do git). Use-o como referência de seletores DOM e regras de negócio; não copie em bloco — migre função por função, com testes.
