# Painel flutuante (`src/ui`)

Issue #7. Ponto único para o médico acionar as automações no SGHx. Chega às funcionalidades como `ctx.ui`.

## Comportamento

- Fica na **borda direita**, centralizado na vertical, **acima dos modais** do SGHx (`z-index` máximo), com 280 px
  quando aberto. Recolhido, vira uma aba de 24 px (fica vermelha se houver erro); o `title` da aba diz a tela ativa.
- Aberto/recolhido é **lembrado** em `chrome.storage.local`, na chave `uiState` (fora de `settings`: não é opção
  do médico). Se a leitura ou a gravação falhar, o painel segue (padrão: aberto).
- Mostra a **tela ativa** (`ctx.screen`), inclusive "Tela não reconhecida" (`unknown`): as automações estão inativas.
- **Shadow DOM**: o CSS do SGHx não vaza para o painel nem o contrário. Todo texto entra por `textContent`.
- Se o painel não montar, `initUi` registra o erro e devolve uma API inerte: as funcionalidades continuam.

## API (`ctx.ui`)

```js
ui.registerSection({
  id: 'fila',                 // único
  title: 'Fila',
  screens: [SCREEN.FILA],     // só aparece nessas telas (habilitada conforme a tela)
  render(el, { screen, signal }) {  // el é o contêiner da seção; pode ser async
    el.textContent = 'Acompanhando: …';
    const id = setInterval(atualizar, 1000);
    signal.addEventListener('abort', () => clearInterval(id)); // limpe timers e ouvintes aqui
  },
});

const clear = ui.notify({ level: 'error', text: 'Sessão expirada' }); // 'info' | 'error'
clear(); // remove a mensagem
```

- `info` some sozinha em 8 s. `error` **fica** até ser dispensada (×) ou limpa por `clear()`, e **abre o painel**
  se ele estiver recolhido (sem mudar a preferência gravada).
- Seção que lança erro (ou rejeita, se `render` for async) não derruba as outras: o painel mostra **um** erro por
  seção (some quando ela volta a renderizar sem falhar) e registra no console.
- `render` roda de novo a cada troca de tela; registrar uma seção nova só renderiza a nova. O `signal` é abortado
  antes de cada nova renderização e no `destroy`: use-o para limpar timers e ouvintes.
- `ui.notify` valida nível (`info`|`error`) e texto não vazio, com ou sem painel montado.

## Limites conhecidos

- Posição fixa (sem arrastar). A conferência de que não cobre botões ou campos do SGHx é **manual**
  (o jsdom não mede layout): fila, consulta, prescrição e atestado.
