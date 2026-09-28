import { AXES, getCountry } from '../engine/data';
import { sanitizeInterview } from '../engine/sanitize';
import { briefing, claudeOnline } from '../engine/director';
import { advanceMonth, applyEffects, createState } from '../engine/rules';
import { loadGame } from '../engine/save';
import type { GameState } from '../engine/types';

/* Roteiros das cenas do laboratório: pedidos ao Claude e validados aqui antes de encenar. */

export type Kpis = Partial<Record<'aprovacao' | 'coalizao' | 'inflacao' | 'desemprego', number>>;

export interface VoteScript {
  bill: { title: string; description: string; needed: number };
  capital: number;
  groups: { name: string; faction?: string; seats: number; stance: 'a_favor' | 'indeciso' | 'contra'; leader: string; demand: string; offers: { label: string; cost: number; swing: number; effects: Kpis; reaction: string }[] }[];
}

export interface DebateScript {
  opponent: { name: string; style: string };
  moderator: string;
  rounds: { topic: string; attack: string; options: { label: string; style: string; reply: string; audience: Record<'progressistas' | 'indecisos' | 'conservadores', number>; factcheck: { verdict: 'verdadeiro' | 'exagerado' | 'falso'; note: string } }[] }[];
  closing: string;
}

export interface CallScript {
  partner: 'eua' | 'china' | 'ue' | 'mercosul' | 'russia';
  leader: { name: string; title: string };
  context: string;
  theirAsk: string;
  ourAsk: string;
  rounds: { line: string; options: { label: string; relation: number; effects: Kpis; points: number; reaction: string }[] }[];
}

export interface MeetingScript {
  agenda: string;
  clash: { a: string; aWants: string; b: string; bWants: string };
  rounds: { speaker: string; line: string; interrupt?: { speaker: string; line: string }; options: { label: string; loyalty: Record<string, number>; effects: Kpis; reaction: string }[] }[];
  resignation: Record<string, string>;
}

export type LabKind = 'votacao' | 'debate' | 'telefonema' | 'reuniao' | 'coletiva';

const clamp = (v: unknown, min: number, max: number, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
const kpis = (e: unknown): Kpis => {
  const o = (e ?? {}) as Record<string, unknown>;
  return {
    aprovacao: clamp(o.aprovacao, -8, 8),
    coalizao: clamp(o.coalizao, -8, 8),
    inflacao: clamp(o.inflacao, -0.8, 0.8),
    desemprego: clamp(o.desemprego, -0.5, 0.5),
  };
};
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Valida o roteiro; lança erro se faltar o essencial (a cena mostra a falha em vez de inventar texto). */
export function sanitize(kind: LabKind, raw: any): unknown {
  switch (kind) {
    case 'coletiva':
      return raw;
    case 'votacao': {
      const groups = (raw.groups ?? []).slice(0, 6).map((g: any) => ({
        name: s(g.name, 30),
        faction: ['centrao', 'ruralistas', 'religiosos', 'seguranca', 'tecnologica'].includes(g.faction) ? g.faction : undefined,
        seats: Math.round(clamp(g.seats, 5, 200, 60)),
        stance: ['a_favor', 'indeciso', 'contra'].includes(g.stance) ? g.stance : 'indeciso',
        leader: s(g.leader, 30),
        demand: s(g.demand, 140),
        offers: (g.offers ?? []).slice(0, 3).map((o: any) => ({ label: s(o.label, 50), cost: Math.round(clamp(o.cost, 1, 5, 2)), swing: clamp(o.swing, 0, 1, 0.5), effects: kpis(o.effects), reaction: s(o.reaction, 140) })),
      }));
      if (groups.length < 4) throw new Error('roteiro de votação incompleto');
      // A Câmara tem 513 cadeiras: redistribui proporcionalmente se o roteiro errar a soma.
      const sum = groups.reduce((n: number, g: { seats: number }) => n + g.seats, 0);
      let left = 513;
      groups.forEach((g: { seats: number }, i: number) => {
        g.seats = i === groups.length - 1 ? left : Math.round((g.seats / sum) * 513);
        left -= g.seats;
      });
      return { bill: { title: s(raw.bill?.title, 70), description: s(raw.bill?.description, 200), needed: raw.bill?.needed >= 300 ? 308 : 257 }, capital: Math.round(clamp(raw.capital, 6, 14, 10)), groups } satisfies VoteScript;
    }
    case 'debate': {
      const rounds = (raw.rounds ?? []).slice(0, 3).map((r: any) => ({
        topic: s(r.topic, 40),
        attack: s(r.attack, 200),
        options: (r.options ?? []).slice(0, 3).map((o: any) => ({
          label: s(o.label, 50),
          style: s(o.style, 20),
          reply: s(o.reply, 200),
          audience: { progressistas: clamp(o.audience?.progressistas, -10, 10), indecisos: clamp(o.audience?.indecisos, -10, 10), conservadores: clamp(o.audience?.conservadores, -10, 10) },
          factcheck: { verdict: ['verdadeiro', 'exagerado', 'falso'].includes(o.factcheck?.verdict) ? o.factcheck.verdict : 'exagerado', note: s(o.factcheck?.note, 160) },
        })),
      }));
      if (rounds.length < 2) throw new Error('roteiro de debate incompleto');
      return { opponent: { name: s(raw.opponent?.name, 30), style: s(raw.opponent?.style, 60) }, moderator: s(raw.moderator, 30), rounds, closing: s(raw.closing, 200) } satisfies DebateScript;
    }
    case 'telefonema': {
      const rounds = (raw.rounds ?? []).slice(0, 3).map((r: any) => ({
        line: s(r.line, 200),
        options: (r.options ?? []).slice(0, 3).map((o: any) => ({ label: s(o.label, 50), relation: clamp(o.relation, -20, 20), effects: kpis(o.effects), points: Math.round(clamp(o.points, 0, 3)), reaction: s(o.reaction, 160) })),
      }));
      if (rounds.length < 2) throw new Error('roteiro de telefonema incompleto');
      const partner = ['eua', 'china', 'ue', 'mercosul', 'russia'].includes(raw.partner) ? raw.partner : 'eua';
      return { partner, leader: { name: s(raw.leader?.name, 30), title: s(raw.leader?.title, 40) }, context: s(raw.context, 200), theirAsk: s(raw.theirAsk, 140), ourAsk: s(raw.ourAsk, 140), rounds } satisfies CallScript;
    }
    case 'reuniao': {
      const rounds = (raw.rounds ?? []).slice(0, 3).map((r: any) => ({
        speaker: s(r.speaker, 20),
        line: s(r.line, 200),
        interrupt: r.interrupt?.line ? { speaker: s(r.interrupt.speaker, 20), line: s(r.interrupt.line, 160) } : undefined,
        options: (r.options ?? []).slice(0, 3).map((o: any) => ({
          label: s(o.label, 50),
          loyalty: Object.fromEntries(Object.entries(o.loyalty ?? {}).map(([k, v]) => [k, clamp(v, -30, 30)])),
          effects: kpis(o.effects),
          reaction: s(o.reaction, 160),
        })),
      }));
      if (rounds.length < 2) throw new Error('roteiro de reunião incompleto');
      return { agenda: s(raw.agenda, 140), clash: { a: s(raw.clash?.a, 20), aWants: s(raw.clash?.aWants, 140), b: s(raw.clash?.b, 20), bWants: s(raw.clash?.bWants, 140) }, rounds, resignation: Object.fromEntries(Object.entries(raw.resignation ?? {}).map(([k, v]) => [k, s(v, 160)])) } satisfies MeetingScript;
    }
  }
}

/** O mandato usado pelas cenas: o salvo, se existir; senão um governo de exemplo com histórico. */
export function labState(): GameState {
  const save = loadGame();
  if (save) return save.state;
  const br = getCountry('BR');
  let st = createState(br, { name: 'Presidente Exemplo', avatar: 0, bioId: 'politico' });
  for (let i = 0; i < 14; i++) st = advanceMonth(st, br);
  st = applyEffects(st, { axes: { poder: 25, direitos: -20, economia: -10 }, kpis: { inflacao: 1.6, aprovacao: -8, coalizao: -12 }, factions: { centrao: -15, tecnologica: -25, seguranca: 20 }, relations: { eua: -20, china: 15 } }, br).state;
  st.history = [
    { month: 2, event: 'Greve dos Caminhoneiros', choice: 'Decretar GLO e proibir as manifestações', headline: 'Exército nas estradas', icon: '🪖', stf: 'LIMINAR DO STF' },
    { month: 6, event: 'O Deepfake do Presidente', choice: 'Suspender a rede social por decreto', headline: 'Presidente tira rede do ar', icon: '⛔', stf: 'LIMINAR DO STF' },
    { month: 10, event: 'Taxa do aço', choice: 'Retaliar os EUA com tarifa', headline: 'Brasil retalia Washington', icon: '⚔️' },
    { month: 13, event: 'Arroz a R$ 40', choice: 'Tabelar o preço da cesta básica', headline: 'Preço tabelado, prateleiras vazias', icon: '🏷️' },
  ];
  return st;
}

const cache = new Map<LabKind, Promise<unknown>>();

/** Pede ao Claude o roteiro da cena (uma vez por tipo, ou de novo com `fresh`). No jogo, passa o mandato real. */
export function requestScript(kind: LabKind, fresh = false, state?: GameState): Promise<unknown> {
  if (!fresh && !state && cache.has(kind)) return cache.get(kind)!;
  const st = state ?? labState();
  const job = claudeOnline().then(async (online) => {
    if (!online) throw new Error('O Claude não está disponível neste servidor.');
    const country = getCountry('BR');
    if (kind === 'coletiva') {
      // A coletiva usa o mesmo gerador do jogo.
      const r = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          briefing: briefing(st, country).replace('Escreva a próxima crise.', 'Escreva a próxima coletiva de imprensa.'),
          axes: AXES.map((a) => a.id),
          factions: country.factions.map((f) => f.id),
          partners: country.partners.map((p) => p.id),
        }),
      });
      if (!r.ok) throw new Error(`geração falhou (${r.status})`);
      const iv = sanitizeInterview(await r.json(), country);
      if (!iv) throw new Error('coletiva incompleta');
      return iv;
    }
    const res = await fetch('/api/lab', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, briefing: briefing(st, getCountry('BR')).replace('Escreva a próxima crise.', 'Escreva a cena.') }),
    });
    if (!res.ok) throw new Error(`geração falhou (${res.status})`);
    return sanitize(kind, await res.json());
  });
  if (!state) {
    cache.set(kind, job);
    job.catch(() => cache.delete(kind));
  }
  return job;
}
