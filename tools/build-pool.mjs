// Gera o acervo de despachos (escritos pelo Claude) que cobre a espera enquanto a primeira leva
// personalizada ainda está sendo escrita. Uso: node tools/build-pool.mjs (com `npm run dev` rodando).
import { writeFileSync } from 'node:fs';

const BASE = process.env.SP_URL ?? 'http://localhost:5199';
const axes = ['governanca', 'poder', 'direitos', 'sociedade', 'defesa', 'diplomacia', 'propriedade', 'economia', 'comercio', 'cultura', 'valores', 'tecnologia'];
const factions = ['centrao', 'ruralistas', 'religiosos', 'seguranca', 'tecnologica'];
const partners = ['eua', 'china', 'ue', 'mercosul', 'russia'];

const THEMES = [
  'economia e contas públicas', 'segurança pública', 'saúde e SUS', 'educação e universidades', 'meio ambiente e clima',
  'cultura e esporte', 'tecnologia e inteligência artificial', 'diplomacia e comércio exterior', 'infraestrutura e obras',
  'redes sociais e imprensa', 'Congresso e partidos', 'estados e prefeituras', 'costumes e religião', 'Forças Armadas e fronteiras',
  'agronegócio e reforma agrária', 'ciência e espaço', 'transporte e mobilidade', 'direitos humanos e minorias',
];

function briefing(kind, themes) {
  const when =
    kind === 'inicio'
      ? 'É janeiro de 2026, a primeira semana do mandato: governo recém-empossado, sem histórico de decisões. Os despachos são sobre começar a governar: montar equipe, primeiros decretos, transição, promessas de campanha, primeiros encontros.'
      : 'É um momento qualquer do mandato. Os despachos NÃO podem depender de decisões anteriores do jogador nem citar números específicos do país: são situações que podem acontecer em qualquer governo.';
  return `País: Brasil. ${when}
Presidente eleito em 2025, 35 anos. Indicadores medianos, coalizão ainda estável.
Temas desta leva (um despacho para cada): ${themes.join('; ')}.
Seja criativo e específico; evite clichês e repetir situações comuns. Escreva 4 despachos.`;
}

async function batch(kind, i) {
  const themes = [0, 1, 2, 3].map((k) => THEMES[(i * 4 + k + (kind === 'inicio' ? 0 : 7)) % THEMES.length]);
  const res = await fetch(`${BASE}/api/dispatches`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ briefing: briefing(kind, themes), axes, factions, partners }),
  });
  if (!res.ok) throw new Error(`${kind} ${i}: ${res.status}`);
  const { dispatches } = await res.json();
  console.log(`${kind} ${i}: ${dispatches.length} despachos (${themes.join(', ')})`);
  return dispatches.map((d) => ({ ...d, pool: kind }));
}

const jobs = [...Array.from({ length: 5 }, (_, i) => ['inicio', i]), ...Array.from({ length: 6 }, (_, i) => ['geral', i])];
const results = await Promise.allSettled(jobs.map(([k, i]) => batch(k, i)));
const pool = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : (console.warn(r.reason.message), [])));
writeFileSync('data/pool/BR_dispatches.json', JSON.stringify(pool, null, 2));
console.log(`acervo: ${pool.length} despachos (${pool.filter((d) => d.pool === 'inicio').length} de início)`);
