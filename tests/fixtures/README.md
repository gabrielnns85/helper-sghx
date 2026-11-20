# Fixtures HTML das telas do SGHx

Os testes unitários simulam as telas do SGHx carregando trechos de HTML no jsdom:

```js
import { loadFixture, clearFixture } from '../helpers/load-fixture.js';

afterEach(clearFixture);

it('acha o modal de consulta', () => {
  loadFixture('exemplo-consulta'); // tests/fixtures/exemplo-consulta.html
  expect(document.querySelector('#Consulta_Modal')).not.toBeNull();
});
```

> ⚠️ **Este repositório é público.** Uma fixture com dado real de paciente é um
> vazamento de dados de saúde (LGPD). Na dúvida, **não commite**: escreva a fixture à mão.

## De onde vêm os dados

Use **somente**:

- o **paciente de teste** da skill `sghx`: TESTE TESTE, prontuário/CodUsuario `782657`;
- ou dados **sintéticos** escritos à mão.

Nunca capture uma tela com outro paciente aberto, nem para "anonimizar depois".

## Como capturar

1. Abra a tela no SGHx **com o paciente de teste**, seguindo as regras de somente leitura
   da skill `sghx` (não clique em Salvar).
2. DevTools (F12) → Elements → clique com o botão direito **no modal ou contêiner que o
   teste precisa** (ex.: `#Consulta_Modal`) → *Copy* → *Copy outerHTML*.
   Nunca copie a página inteira: ela traz o cabeçalho com o profissional logado,
   a fila com outros pacientes e o GUID de sessão.
3. Cole em `tests/fixtures/<tela>.html` e **reduza** ao mínimo que o teste usa: tire
   `<script>`, estilos inline grandes, listas longas e opções de select que não importam.

## Como anonimizar (obrigatório, mesmo com o paciente de teste)

Substitua por valores fictícios ou apague:

| Dado | Onde costuma aparecer | Trocar por |
|---|---|---|
| Nome do paciente, da mãe, acompanhante | cabeçalho, `NomUsuario`, `title` | `TESTE TESTE` |
| CPF, Cartão SUS (CNS), RG | dados do paciente, `data-model` | apagar ou `xxx` |
| Prontuário / `CodUsuario` / `NumAtendimento` | atributos, `data-model`, URLs | `782657` / número fictício pequeno |
| Data de nascimento, endereço, telefone, e-mail | ficha do paciente | apagar ou valor obviamente falso |
| Nome e CRM/COREN de profissionais | cabeçalho, "Atendido por", assinaturas | `MEDICO TESTE` |
| GUID de `session`, tokens, cookies | inputs ocultos, URLs, `data-*` | apagar |
| Texto clínico (queixa, evolução, SOAP) | textareas, histórico | texto sintético curto |
| JSON em `data-model` / `data-bind` com valores | linhas de fila (`tr[data-model]`) | manter só as chaves usadas, valores fictícios |

## Trava automática

`tests/unit/fixtures-privacy.test.js` varre todas as fixtures (menos os `.md`) e **falha o
`npm test` e o CI** se encontrar algo com cara de dado real: CPF, sequências de 11 ou 15
dígitos (CPF, telefone, CNS), CNS formatado, GUID, e-mail, telefone ou `CodUsuario`
diferente de `782657`.

A trava é uma rede de segurança, **não substitui a revisão**: ela não reconhece nomes,
endereços nem texto clínico. Se ela acusar um falso positivo, mude o valor fictício
(ex.: use menos dígitos). Não afrouxe a regra.

## Convenções

- Nome do arquivo: tela ou modal em minúsculas, com hífens: `consulta-soap.html`,
  `prescricao-medicamento.html`, `fila-pronto-atendimento.html`.
- Comece o arquivo com um comentário dizendo se é **sintética** ou **capturada e
  anonimizada**, de qual tela e qual versão do SGHx (ex.: `v5.161`).
- Uma fixture por tela/estado. Variações (ex.: modal vazio × preenchido) em arquivos separados.

## Checklist antes do commit

- [ ] Só paciente de teste (782657) ou dados sintéticos
- [ ] Nenhum nome real de paciente ou profissional, CPF, CNS, endereço, telefone, GUID de sessão
- [ ] Texto clínico substituído por texto sintético
- [ ] Reduzida ao trecho que o teste usa
- [ ] `npm test` verde (inclui a trava de privacidade)
