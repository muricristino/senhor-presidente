/**
 * Velocidade global das animações e acontecimentos. 1 = original; 0,7 = 30% mais lento.
 * Não afeta os cronômetros das decisões, que são tempo de jogo.
 */
export const SPEED = 0.7;

/** Converte uma duração pensada na velocidade original para a velocidade atual. */
export const slow = (ms: number) => ms / SPEED;
