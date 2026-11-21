import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadFixture, clearFixture } from '../helpers/load-fixture.js';
import { addDialog } from '../helpers/dialogs.js';
import { addScreenModal } from '../helpers/screen-modals.js';
import { watchScreen, SCREEN } from '../../src/core/screen/index.js';

/** Deixa o MutationObserver do jsdom entregar as mudanças pendentes. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let watcher;

beforeEach(() => {
  loadFixture('fila-pronto-atendimento');
});

afterEach(() => {
  watcher?.stop();
  watcher = undefined;
  vi.restoreAllMocks();
  clearFixture();
});

describe('watchScreen', () => {
  it('current() já devolve a tela ao começar, sem emitir evento', async () => {
    const onChange = vi.fn();
    watcher = watchScreen({ onChange });
    await flush();
    expect(watcher.current()).toEqual({ id: SCREEN.FILA, stack: ['fila'] });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('emite { previous, current } quando um modal abre e quando fecha', async () => {
    const onChange = vi.fn();
    watcher = watchScreen({ onChange });

    const consulta = addScreenModal({ id: 'Consulta_Modal', title: 'Consulta Médica' });
    await flush();
    expect(onChange).toHaveBeenLastCalledWith({
      previous: { id: SCREEN.FILA, stack: ['fila'] },
      current: { id: SCREEN.CONSULTA, stack: ['fila', 'consulta'] },
    });

    consulta.style.display = 'none';
    await flush();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.lastCall[0].current.id).toBe(SCREEN.FILA);
    expect(watcher.current().id).toBe(SCREEN.FILA);
  });

  it('não emite quando o DOM muda mas a tela continua a mesma', async () => {
    const onChange = vi.fn();
    watcher = watchScreen({ onChange });
    document.querySelector('.fila-pacientes').appendChild(document.createElement('tr'));
    addDialog({ message: 'Aviso sintético', buttons: ['OK'] });
    await flush();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('abrir a posologia por cima da prescrição não emite evento', async () => {
    addScreenModal({ id: 'Consulta_Modal' });
    addScreenModal({ id: 'PrescricaoMedicamento_Modal' });
    const onChange = vi.fn();
    watcher = watchScreen({ onChange });
    addScreenModal({ id: 'PosologiaMedicamentoModal', title: 'Posologia' });
    await flush();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('percebe a mudança de título do questionário (bind do Knockout)', async () => {
    addScreenModal({ id: 'Consulta_Modal' });
    const quest = addScreenModal({ id: 'ModalQuestionario', title: '' });
    const onChange = vi.fn();
    watcher = watchScreen({ onChange });
    quest.querySelector('.title3').textContent = 'Atestado Médico';
    await flush();
    expect(onChange.mock.lastCall[0].current.id).toBe(SCREEN.ATESTADO);
  });

  it('subscribe recebe os eventos e unsubscribe para de receber', async () => {
    watcher = watchScreen();
    const listener = vi.fn();
    const unsubscribe = watcher.subscribe(listener);

    const consulta = addScreenModal({ id: 'Consulta_Modal' });
    await flush();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    consulta.remove();
    await flush();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('subscribe exige função', () => {
    watcher = watchScreen();
    expect(() => watcher.subscribe('x')).toThrow(TypeError);
  });

  it('erro de um ouvinte não impede os outros', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    watcher = watchScreen();
    const good = vi.fn();
    watcher.subscribe(() => { throw new Error('falhou'); });
    watcher.subscribe(good);
    addScreenModal({ id: 'Consulta_Modal' });
    await flush();
    expect(good).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[helper-sghx]'), expect.any(Error));
  });

  it('stop() para de observar', async () => {
    const onChange = vi.fn();
    watcher = watchScreen({ onChange });
    watcher.stop();
    addScreenModal({ id: 'Consulta_Modal' });
    await flush();
    expect(onChange).not.toHaveBeenCalled();
  });
});
