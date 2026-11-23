import { describe, it, expect, afterEach, vi } from 'vitest';
import { loadFixture, clearFixture } from '../helpers/load-fixture.js';
import { createTypingTracker, blockedReason } from '../../src/features/queue-refresh/guards.js';

const GRACE = 5000;

function addLightbox(visible = true) {
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.style.display = visible ? 'block' : 'none';
  document.body.appendChild(box);
  return box;
}

function addField(tag, attrs = {}) {
  const field = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) field.setAttribute(k, v);
  document.body.appendChild(field);
  return field;
}

afterEach(() => {
  clearFixture();
  vi.useRealTimers();
});

describe('createTypingTracker', () => {
  it('não está digitando com a tela parada', () => {
    loadFixture('fila-categorias');
    const typing = createTypingTracker({ root: document, graceMs: GRACE });
    expect(typing.isTyping()).toBe(false);
    typing.stop();
  });

  it.each([
    ['input de texto', 'input', { type: 'text' }],
    ['input sem type', 'input', {}],
    ['textarea', 'textarea', {}],
    ['contenteditable', 'div', { contenteditable: 'true', tabindex: '0' }],
  ])('está digitando com o foco em %s', (_name, tag, attrs) => {
    const typing = createTypingTracker({ root: document, graceMs: GRACE });
    addField(tag, attrs).focus();
    expect(typing.isTyping()).toBe(true);
    typing.stop();
  });

  it.each([['button'], ['checkbox'], ['radio']])('foco em input %s não é digitação', (type) => {
    const typing = createTypingTracker({ root: document, graceMs: GRACE });
    addField('input', { type }).focus();
    expect(typing.isTyping()).toBe(false);
    typing.stop();
  });

  it('uma tecla recente conta como digitação até passar a tolerância', () => {
    vi.useFakeTimers();
    const typing = createTypingTracker({ root: document, graceMs: GRACE });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(typing.isTyping()).toBe(true);
    vi.advanceTimersByTime(GRACE - 1);
    expect(typing.isTyping()).toBe(true);
    vi.advanceTimersByTime(2);
    expect(typing.isTyping()).toBe(false);
    typing.stop();
  });

  it('depois de stop() deixa de ouvir o teclado', () => {
    const typing = createTypingTracker({ root: document, graceMs: GRACE });
    typing.stop();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(typing.isTyping()).toBe(false);
  });
});

describe('createTypingTracker: foco que não é digitação', () => {
  it('foco num select (ex.: filtro da fila) não bloqueia a atualização', () => {
    const typing = createTypingTracker({ root: document, graceMs: GRACE });
    addField('select').focus();
    expect(typing.isTyping()).toBe(false);
    typing.stop();
  });
});

describe('blockedReason', () => {
  const notTyping = { isTyping: () => false };

  it('devolve null com a fila livre', () => {
    loadFixture('fila-categorias');
    expect(blockedReason({ root: document, typing: notTyping })).toBeNull();
  });

  it('modal visível bloqueia; modal oculto não', () => {
    loadFixture('fila-categorias');
    addLightbox(false);
    expect(blockedReason({ root: document, typing: notTyping })).toBeNull();
    addLightbox(true);
    expect(blockedReason({ root: document, typing: notTyping })).toBe('modal');
  });

  it('digitação bloqueia', () => {
    loadFixture('fila-categorias');
    expect(blockedReason({ root: document, typing: { isTyping: () => true } })).toBe('typing');
  });
});
