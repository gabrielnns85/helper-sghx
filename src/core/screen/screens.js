/**
 * Telas do SGHx que a extensão reconhece. A referência dos seletores é a skill
 * `sghx` (referencia/MAPA.md): §1 login, §2 fila, §3 consulta, §4.3 solicitação
 * de procedimentos, §4.6 prescrição, §4.8 atestado.
 */
export const SCREEN = Object.freeze({
  LOGIN: 'login',
  FILA: 'fila',
  CONSULTA: 'consulta',
  PRESCRICAO: 'prescricao',
  SOLICITACAO_PROCEDIMENTO: 'solicitacao-procedimento',
  ATESTADO: 'atestado',
  UNKNOWN: 'unknown',
});

/**
 * Telas de fundo (página sem modal). A primeira com elemento visível vale.
 * O modal de contexto depois do login (município/estabelecimento) conta como login.
 */
export const PAGE_RULES = Object.freeze([
  { id: SCREEN.LOGIN, selector: '#inputUsuario, #comboEstabelecimento' },
  { id: SCREEN.FILA, selector: '#Fila_CodAgrupamento' },
]);

/**
 * Modais de tela (.lightbox). Com `title`, o título do modal (.title3) também
 * precisa casar: o #ModalQuestionario é o mesmo para atestado, EMAD, resumo de alta…
 * Consulta complementar usa o mesmo #Consulta_Modal e conta como consulta.
 * A página de login tem modais próprios (contexto, certificado, dois fatores, termo
 * de uso…), conferidos no SGHx em 21/11/2026: todos contam como login.
 * Os submodais da prescrição (posologia, justificativa do externo) contam como
 * prescrição: são abertos pela própria automação no meio do preenchimento.
 */
export const MODAL_RULES = Object.freeze([
  {
    id: SCREEN.LOGIN,
    selector:
      '#modalLogin, #modalProvedorCertificado, #modalListaCertificado, #modalAutentDoisFatores, ' +
      '#trocarSenhaUsuario, #esqueciMinhaSenha, #termoUsoSistema, #comboEstabelecimento',
  },
  { id: SCREEN.CONSULTA, selector: '#Consulta_Modal' },
  {
    id: SCREEN.PRESCRICAO,
    selector: '#PrescricaoMedicamento_Modal, #PosologiaMedicamentoModal, #PosologiaModal, #JustificativaFarmaciaExternaModal',
  },
  { id: SCREEN.SOLICITACAO_PROCEDIMENTO, selector: '#SolicitacaoProcedimentos_Modal' },
  { id: SCREEN.ATESTADO, selector: '#ModalQuestionario', title: 'atestado medico' },
]);
