# ADR 0002 — Armazenamento: sessão do atendimento × configurações × credenciais

- **Status:** aceita
- **Data:** 2026-11-22
- **Issue:** #6 (cofre: #64)

## Contexto

- Dados do paciente são sensíveis e efêmeros: valem enquanto o atendimento está em tela.
- Funcionalidades vão operar também em outros sites (imagens MobileMed, SIRESP, laboratório Biomega/Lisnet),
  sempre sobre o mesmo atendimento aberto no SGHx, mas também **sem** o SGHx aberto (login, copiar dados).
- Pacientes internados talvez permitam dois atendimentos abertos em abas diferentes (a conferir no SGHx).
- Configurações do médico e senhas dos outros sites precisam persistir. Cada médico usa o próprio perfil do Chrome.

## Decisão

1. **Sessão em `chrome.storage.session`, com o service worker como único dono.**
   - Fica em memória: nunca vai para o disco e some ao fechar o navegador ou atualizar a extensão.
   - Sobrevive ao F5 e ao service worker ser encerrado pelo MV3 (por isso não basta uma variável no worker).
   - Com o nível de acesso padrão, só contextos confiáveis leem essa área. Os content scripts pedem por
     mensagem e o worker valida o remetente (extensão, aba, site da lista em `src/core/sites.js`).
2. **Um atendimento por aba do SGHx + ponteiro do atendimento ativo** (a aba do SGHx usada por último).
   Os outros sites só veem o ativo; o SGHx vê o da própria aba. Gravações de outros sites podem exigir o `id` do
   atendimento (`expectId`). Isso evita usar o paciente de outra aba.
3. **Só o SGHx abre, assume e apaga atendimentos**, guiado pela detecção de tela (#5): entra na consulta → abre;
   fila/login/saída da página → apaga. Aba fechada → o worker apaga.
4. **Configurações em `chrome.storage.local`**, não em `sync`: um perfil do Chrome por médico já separa os dados, e
   o `sync` tem cotas pequenas (8 KB por item) para os kits de prescrição futuros. Só chaves e formas declaradas
   em `defaults.js` são aceitas.
5. **Senhas num cofre separado (#64)**, também em `chrome.storage.local` e acessado só pelo worker. Primeira etapa
   (junto com a #8): sem PIN. Segunda etapa: criptografia AES-GCM com chave derivada de um PIN.

## Alternativas descartadas

- **Sessão em memória no content script do SGHx:** simples, mas os outros sites não enxergariam o atendimento, e um
  F5 apagaria tudo.
- **`chrome.storage.session` com `setAccessLevel(TRUSTED_AND_UNTRUSTED_CONTEXTS)`:** daria acesso direto aos
  content scripts, mas sem validar quem abre/apaga atendimentos nem isolar por aba.
- **Sessão global única (sem aba):** com dois atendimentos abertos, o último sobrescreveria o primeiro e um site
  externo poderia agir no paciente errado.
- **`chrome.storage.sync` para configurações:** cotas pequenas e dependência da conta Google no Chrome.

## Consequências

- A API da sessão é assíncrona (`await session.get(...)`) em todos os sites.
- O manifest ganha `permissions: ["storage"]`, `background.service_worker` e um content script para os sites
  externos (o Chrome avisa dessas permissões ao instalar).
- Saída da página por caminhos que não disparam `pagehide` (ex.: travamento da aba) deixa o atendimento até a aba
  fechar ou o SGHx carregar de novo (o content script apaga ao iniciar fora da consulta).
