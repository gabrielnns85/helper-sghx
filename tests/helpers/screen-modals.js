/**
 * Monta um modal de tela (.lightbox sem .bootstrap-dialog-message) como o
 * framework da Fastmedic faz no SGHx, para simular modais abertos por cima.
 */
export function addScreenModal({ id, title = '', root = document.querySelector('.content') ?? document.body } = {}) {
  const wrap = document.createElement('div');
  if (id) wrap.id = id;
  wrap.className = 'lightbox';
  wrap.style.display = 'block';
  wrap.innerHTML = `
    <div class="light-bg"></div>
    <div class="light-content-box -form">
      <div class="title-modal"><h3 class="title3">${title}</h3></div>
    </div>`;
  root.appendChild(wrap);
  return wrap;
}
