# helper-sghx — instruções para o Claude

- Leia `CONTRIBUTING.md`: o fluxo é **TDD obrigatório** (testes → código → integração → PR). Nunca implemente sem antes escrever os testes da issue.
- Uma issue = uma branch = um PR com `Closes #N`. Nunca commitar direto na `main`.
- Repositório **público**: jamais incluir dados de paciente, credenciais ou prints sem tarja em código, fixtures, commits ou issues.
- **Não usar o código legado** (`legacy/`). A referência de telas, seletores, endpoints e catálogos do SGHx é a skill `sghx` (`~/.claude/skills/sghx`, carregar via Skill). Tela não mapeada → mapear na skill antes de implementar.
- A extensão preenche campos, mas **nunca salva sem confirmação do médico**. Ao mapear telas com a skill, seguir as regras de somente leitura dela.
- Idioma: código e identificadores em inglês; issues, docs, textos de UI e commits em português.
