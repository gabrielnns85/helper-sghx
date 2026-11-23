/**
 * Registro das seções do painel. Cada funcionalidade registra as suas:
 * { id, title, screens: [SCREEN.*], render(el, { screen }) }.
 */
export function createSectionRegistry() {
  const sections = [];

  const assertValid = (s) => {
    if (!s || typeof s.id !== 'string' || !s.id) throw new TypeError('Seção do painel sem id');
    if (typeof s.title !== 'string' || !s.title) throw new TypeError(`Seção "${s.id}" sem título`);
    if (typeof s.render !== 'function') throw new TypeError(`Seção "${s.id}" sem render()`);
    if (!Array.isArray(s.screens) || s.screens.length === 0) throw new TypeError(`Seção "${s.id}" sem telas`);
    if (sections.some((x) => x.id === s.id)) throw new Error(`Seção duplicada: ${s.id}`);
  };

  return {
    register(section) {
      assertValid(section);
      sections.push(Object.freeze({ ...section, screens: Object.freeze([...section.screens]) }));
    },
    list: () => [...sections],
    forScreen: (screenId) => sections.filter((s) => s.screens.includes(screenId)),
  };
}
