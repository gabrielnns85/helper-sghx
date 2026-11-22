/**
 * Sites em que a extensão roda. Fonte única para os content scripts do manifest e
 * para a lista de remetentes aceitos pelo service worker (ver docs/storage.md).
 * Só o SGHx é dono da sessão do atendimento; os outros sites também funcionam
 * sem atendimento aberto (login, copiar dados).
 */
export const SITE = Object.freeze({
  SGHX: 'sghx',
  MOBILEMED: 'mobilemed',
  SIRESP: 'siresp',
  LISNET: 'lisnet',
});

/**
 * @typedef {Readonly<{ id: string, host?: string, hostSuffix?: string, pathPrefix?: string,
 *   ownsSession: boolean, matches: ReadonlyArray<string> }>} Site
 */

const site = (def) => Object.freeze({ ownsSession: false, ...def, matches: Object.freeze([...def.matches]) });

/** @type {ReadonlyArray<Site>} */
export const SITES = Object.freeze([
  site({
    id: SITE.SGHX,
    hostSuffix: 'smsprefeiturasp.com.br',
    ownsSession: true,
    matches: ['https://*.smsprefeiturasp.com.br/*'],
  }),
  site({ id: SITE.MOBILEMED, host: 'laudos.mobilemed.com.br', matches: ['https://laudos.mobilemed.com.br/*'] }),
  site({ id: SITE.SIRESP, host: 'www.siresp.saude.sp.gov.br', matches: ['https://www.siresp.saude.sp.gov.br/*'] }),
  site({
    id: SITE.LISNET,
    host: 'biomega.lisnet.com.br',
    pathPrefix: '/laudos/',
    matches: ['https://biomega.lisnet.com.br/laudos/*'],
  }),
]);

const hostMatches = (s, hostname) =>
  s.host ? hostname === s.host : hostname === s.hostSuffix || hostname.endsWith(`.${s.hostSuffix}`);
const pathMatches = (s, pathname) => !s.pathPrefix || pathname.startsWith(s.pathPrefix);

function parseUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * Site conhecido a que a URL pertence (só https, porta padrão, mesmo caminho do manifest), ou null.
 * @param {string | undefined} url
 * @returns {string | null} id do site (SITE.*)
 */
export function siteForUrl(url) {
  const parsed = typeof url === 'string' ? parseUrl(url) : null;
  if (!parsed || parsed.protocol !== 'https:' || parsed.port !== '') return null;
  return SITES.find((s) => hostMatches(s, parsed.hostname) && pathMatches(s, parsed.pathname))?.id ?? null;
}

/** @param {string} id @returns {Site | null} */
export const getSite = (id) => SITES.find((s) => s.id === id) ?? null;
