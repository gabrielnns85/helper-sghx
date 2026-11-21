/**
 * Monta um pop-up com a mesma estrutura que o framework da Fastmedic usa no SGHx
 * (estilo BootstrapDialog dentro de .lightbox) e liga os botões como ele faz:
 * clicar remove o pop-up.
 */
let seq = 0;

export function addDialog({ title = 'Atenção!', message, buttons = ['OK'], error = false, root = document.body } = {}) {
  seq += 1;
  const id = `dlg-teste-${seq}`;
  const wrap = document.createElement('div');
  wrap.id = id;
  wrap.className = 'lightbox';
  wrap.style.display = 'block';
  wrap.innerHTML = `
    <div class="light-bg"></div>
    <div class="modal-content light-content">
      <div class="modal-header${error ? ' erro' : ''}">
        <div class="bootstrap-dialog-header"><div class="bootstrap-dialog-title">${title}</div></div>
      </div>
      <div class="modal-body"><div class="bootstrap-dialog-body"><div class="bootstrap-dialog-message">${message}</div></div></div>
      <div class="modal-footer" style="display: block;"><div class="bootstrap-dialog-footer"><div class="bootstrap-dialog-footer-buttons">
        <div class="btn-box">${buttons.map((b) => `<a href="#" class="btn">${b}</a>`).join('')}</div>
      </div></div></div>
    </div>`;
  root.appendChild(wrap);
  wireDialogButtons(wrap);
  return wrap;
}

/** Botões que removem o pop-up ao clicar, como no framework. */
export function wireDialogButtons(scope = document) {
  for (const a of scope.querySelectorAll('.bootstrap-dialog-footer-buttons a')) {
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      a.closest('.lightbox')?.remove();
    });
  }
}
