// Camada de armazenamento (#6). Ver docs/storage.md.
// Content scripts: createSessionClient, createSettings, bindSessionToScreen (só SGHx).
// Service worker: installSessionService.
export { createSessionClient } from './session-client.js';
export { bindSessionToScreen } from './session-lifecycle.js';
export { createSettings } from './settings.js';
export { DEFAULT_SETTINGS } from './defaults.js';
export { installSessionService } from './session-service.js';
