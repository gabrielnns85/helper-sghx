/**
 * Erros dos helpers de DOM. As mensagens são em português porque chegam ao
 * médico no painel ("Mensagem clara em caso de falha em qualquer etapa").
 */
export class DomHelperError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

export class TimeoutError extends DomHelperError {
  constructor(description, timeout, lastError) {
    const extra = lastError ? ` (último erro: ${lastError.message ?? lastError})` : '';
    super(`Tempo esgotado (${timeout} ms) aguardando: ${description}${extra}`);
    this.description = description;
    this.timeout = timeout;
    this.lastError = lastError;
  }
}

export class ElementNotFoundError extends DomHelperError {
  constructor(label) {
    super(`Elemento não encontrado: "${label}"`);
    this.label = label;
  }
}

export class OptionNotFoundError extends DomHelperError {
  constructor(value, label, options) {
    super(`Opção "${value}" não existe em "${label}". Opções: ${options.join('; ')}`);
    this.value = value;
    this.options = options;
  }
}

export class ValueNotAppliedError extends DomHelperError {
  constructor(label, expected, actual) {
    super(`Valor não aplicado em "${label}": esperado "${expected}", ficou "${actual}"`);
    this.expected = expected;
    this.actual = actual;
  }
}
