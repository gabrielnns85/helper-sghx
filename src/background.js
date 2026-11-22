// Service worker: dono da sessão do atendimento (chrome.storage.session). Ver docs/storage.md.
import { installSessionService } from './core/storage/session-service.js';

installSessionService(chrome);
