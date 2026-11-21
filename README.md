# helper-sghx

[![CI](https://github.com/gabrielnns85/helper-sghx/actions/workflows/ci.yml/badge.svg)](https://github.com/gabrielnns85/helper-sghx/actions/workflows/ci.yml)

Extensão de navegador (Chrome/Edge, Manifest V3) que auxilia o médico no PEP **SGHx (Fastmedic)** usado nas unidades da SMS-SP: leitura de fila e dados do paciente, preenchimento de SOAP, prescrições, procedimentos, exames, documentos (atestado, CAT, encaminhamento) e integração com laudos do Biomega/Lisnet.

> Projeto experimental, sucessor do *PEP Form Bot & Inspector* (v1.5.9.4). Sem vínculo oficial com a SMS-SP ou a Fastmedic.

## Como trabalhamos

- **Issues** são a fonte da verdade. Use os templates: ✨ Feature, 🐛 Bug, 🔧 Tarefa técnica.
- **Milestone `MVP`** agrupa o que é essencial para a primeira versão utilizável.
- Prioridades: `priority:P0` (MVP) · `priority:P1` (logo após) · `priority:P2` (futuro).
- **TDD obrigatório:** testes unitários → código → integração → PR. Detalhes em [CONTRIBUTING.md](CONTRIBUTING.md).
- Cada PR fecha uma issue (`Closes #N`) e segue o checklist do template.

## Desenvolvimento

Requer Node.js 22.12+.

```bash
npm install
npm test            # testes unitários (Vitest + jsdom)
npm run test:watch  # testes em modo watch
npm run build       # gera dist/extension/ e dist/helper-sghx-<versão>.zip
npm run dev         # recompila dist/extension/ a cada mudança em src/
```

Para carregar no navegador (Chrome ou Edge 111+): abra `chrome://extensions` ou `edge://extensions`, ative o **Modo do desenvolvedor**, clique em **Carregar sem compactação** e escolha `dist/extension/`. Ao abrir o SGHx, o console da página mostra `[helper-sghx] <versão> carregado`.

O CI (GitHub Actions) roda `npm test` e `npm run build` em todo PR e na `main`, e publica o `.zip` como artefato. A `main` é protegida: só recebe merge por PR com o check `test` verde.

### Estrutura

- `src/manifest.json`: manifest MV3 (roda só em `*.smsprefeiturasp.com.br`)
- `src/content.js`: content script no mundo isolado (UI, funcionalidades, `chrome.*`)
- `src/page-bridge.js`: ponte no mundo `MAIN` da página (Knockout/jQuery). Ver [ADR 0001](docs/adr/0001-mundo-de-execucao.md)
- `src/core/`: infraestrutura compartilhada (protocolo e cliente da ponte)
- `src/core/dom/`: helpers de DOM (preencher campos, aguardar elementos, pop-ups). Ver [guia](docs/dom-helpers.md)
- `src/core/screen/`: detecção da tela ativa (login, fila, consulta, prescrição…) e evento de mudança de tela. Ver [guia](docs/screen-detection.md)
- `src/features/`: registro das funcionalidades
- `src/ui/`: interface (painel)
- `tests/unit/`: testes; `tests/fixtures/`: HTML anonimizado das telas ([como capturar e anonimizar](tests/fixtures/README.md)); `tests/helpers/`: utilitários de teste

## Privacidade (LGPD)

Este repositório é **público**. Nunca commitar, anexar ou colar em issues: dados de paciente (nome, CPF, Cartão SUS, prontuário, endereço), credenciais, ou prints sem tarja. Use dados fictícios em exemplos e testes.
