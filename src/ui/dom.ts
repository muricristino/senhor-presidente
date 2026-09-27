import { slow } from '../speed';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', html = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html) node.innerHTML = html;
  return node;
}

export function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Pausa de animação: já considera a velocidade global. */
export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, slow(ms)));

/** Escreve o texto letra a letra. Clicar no elemento completa na hora. */
export function typewriter(target: HTMLElement, text: string, speed = 18, onChar?: () => void): Promise<void> {
  return new Promise((resolve) => {
    let i = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(timer);
      target.textContent = text;
      target.removeEventListener('click', finish);
      resolve();
    };
    const timer = setInterval(() => {
      i++;
      target.textContent = text.slice(0, i);
      if (i % 2 === 0) onChar?.();
      if (i >= text.length) finish();
    }, slow(speed));
    target.addEventListener('click', finish);
  });
}

/** Anima um número de `from` até `to`. */
export function countTo(duration: number, from: number, to: number, render: (v: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / slow(duration));
      const eased = 1 - (1 - t) ** 3;
      render(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

export function shake(node: HTMLElement) {
  node.classList.remove('shake');
  void node.offsetWidth;
  node.classList.add('shake');
}
