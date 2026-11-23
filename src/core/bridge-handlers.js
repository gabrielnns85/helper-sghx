import { createResponse } from './bridge-protocol.js';
import { setPageFieldValue } from './dom/page-fields.js';

/** Modal "Certificado em Nuvem" da tela de login (skill sghx, MAPA.md §1 passo 2a). */
const CLOUD_PROVIDER_MODAL = '#modalProvedorCertificado';
const MODAL_SUBMIT = '#modalLoginEntra';

/** Visível de verdade: nem ele nem um ancestral escondido. */
function isShown(win, el) {
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    const style = win.getComputedStyle(node);
    if (node.hidden || style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return Boolean(el);
}

/**
 * Entrar do Certificado em Nuvem (#10). O botão é <a href="javascript:provedorEscolhido()">:
 * clicado do mundo isolado, a CSP da extensão bloqueia o javascript:, então o clique sai daqui.
 * Só esse botão, só com o modal aberto: leva ao provedor escolhido (VIDAAS), não grava nada.
 */
function submitCloudProvider(win) {
  const modal = win.document.querySelector(CLOUD_PROVIDER_MODAL);
  if (!isShown(win, modal)) throw new Error('O modal "Certificado em Nuvem" não está aberto');
  const provider = modal.querySelector('#comboProvedor')?.selectedOptions?.[0]?.text ?? '';
  if (!/vidaas/i.test(provider)) throw new Error('O provedor escolhido não é o VIDAAS; não cliquei em entrar');
  const button = modal.querySelector(MODAL_SUBMIT);
  if (!button) throw new Error('Botão "entrar" do Certificado em Nuvem não encontrado');
  button.click();
  return { clicked: true };
}

/**
 * Comandos que a ponte (mundo MAIN) aceita. Nada aqui pode salvar no
 * prontuário: os comandos só leem o estado da página ou preenchem campos,
 * como o usuário faria. Qualquer script da página consegue chamar estes
 * comandos, então nunca exponha algo que a própria página não possa fazer.
 */
export function createPageHandlers(win) {
  return {
    ping() {
      return { ko: Boolean(win.ko), jquery: Boolean(win.jQuery) };
    },
    // Preenche widget DevExtreme ou observable do Knockout (ver src/core/dom/fields.js).
    setFieldValue(payload) {
      return setPageFieldValue(win, payload);
    },
    submitCloudProvider() {
      return submitCloudProvider(win);
    },
  };
}

export async function handleRequest(request, handlers) {
  if (!Object.hasOwn(handlers, request.type)) {
    return createResponse(request, { ok: false, error: `Comando desconhecido: ${request.type}` });
  }
  try {
    const payload = await handlers[request.type](request.payload);
    return createResponse(request, { ok: true, payload });
  } catch (err) {
    return createResponse(request, { ok: false, error: err?.message ?? err });
  }
}
