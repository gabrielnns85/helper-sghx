// Helpers de DOM do SGHx (mundo isolado). Ver docs/dom-helpers.md.
// O lado MAIN (DevExtreme/observables) fica em ./page-fields.js e é usado pela ponte.
export { waitFor, waitForElement, waitForGone, DEFAULT_TIMEOUT } from './wait.js';
export { setFieldValue } from './fields.js';
export { getOpenDialogs, waitForDialog, confirmDialog } from './dialogs.js';
export { clickAndWait } from './actions.js';
export {
  DomHelperError,
  TimeoutError,
  ElementNotFoundError,
  OptionNotFoundError,
  ValueNotAppliedError,
} from './errors.js';
