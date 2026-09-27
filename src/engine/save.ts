import type { GameState } from './types';

const KEY = 'sp.save.v1';

export interface SaveGame {
  countryId: string;
  state: GameState;
  savedAt: number;
}

/** Salvamento automático entre uma decisão e outra. Falhar aqui nunca pode travar o jogo. */
export function saveGame(countryId: string, state: GameState) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ countryId, state, savedAt: Date.now() } satisfies SaveGame));
  } catch {
    /* armazenamento indisponível: segue sem salvar */
  }
}

export function loadGame(): SaveGame | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const save = JSON.parse(raw) as SaveGame;
    return save?.state?.player && typeof save.state.month === 'number' && Array.isArray(save.state.electionsHeld) ? save : null;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nada a fazer */
  }
}
