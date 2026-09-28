import { ageOf, dateLabel, monthName } from './calendar';
import { AXES } from './data';

/*
 * Acervo de despachos escritos pelo Claude com antecedência (tools/build-pool.mjs).
 * Só cobre a espera enquanto a leva personalizada não chega, e não repete entre partidas.
 */
const poolFiles = import.meta.glob<{ default: (Record<string, unknown> & { pool: 'inicio' | 'geral'; title: string })[] }>('../../data/pool/*.json', { eager: true });
const POOL = Object.values(poolFiles).flatMap((m) => m.default);
const SEEN_KEY = 'sp.seenPool.v1';

function seenPool(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function markSeen(title: string) {
  try {
    const seen = seenPool();
    seen.add(title);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    /* sem armazenamento: pode repetir, sem problema */
  }
}
import { KPIS, formatKpi } from './kpis';
import { dominantLeans, profileTitle } from './profile';
import { lastTerm, nextElectionMonth } from './politics';
import { CRISES, democracyIndex, democracyLabel, getRegime, INSTITUTIONS, institutionsOf, regimeOf, threats } from './regime';
import { mergeDetails, sanitizeBills, sanitizeCrisis, sanitizeCutscene, sanitizeDispatch, sanitizeEvent, sanitizeInterview } from './sanitize';
import type { BillProposal, Country, CrisisKind, RegimeId, Cutscene, Dispatch, EventOption, GameEvent, GameState, Interview } from './types';

export { monthName } from './calendar';
export type LabKindName = 'votacao' | 'debate' | 'telefonema' | 'reuniao' | 'coletiva' | 'ruptura' | 'conselho';

/** O regime em texto: regras, freios, ameaças e quem sustenta o governante. */
export function regimeBriefing(state: GameState, country: Country): string {
  const r = regimeOf(state);
  const inst = institutionsOf(state);
  const idx = democracyIndex(state);
  const since = (state.regimeHistory ?? []).slice(-1)[0];
  const t = threats(state);
  const threatText = (Object.entries(t) as [CrisisKind, number][]).map(([k, v]) => `${CRISES[k].name} ${v}/100`).join(', ');
  const pillar = r.pillar ? `Quem sustenta o governante: ${r.pillar.label} (${country.factions.find((f) => f.id === r.pillar!.faction)?.name}: ${Math.round(state.factions[r.pillar.faction] ?? 0)}).\n` : '';
  const special = (state.extraTerms ?? 0) > 0 ? `A reeleição foi estendida por PEC: ${2 + (state.extraTerms ?? 0)} mandatos seguidos permitidos.\n` : '';
  return `REGIME EM VIGOR: ${r.name} (${r.family}). O jogador governa como ${r.headTitle}${since ? ` desde ${dateLabel(state, since.month)}, por ${since.via}` : ''}.
${r.summary}
Congresso: ${r.congress === 'independente' ? 'independente, vota os projetos' : r.congress === 'carimbo' ? 'de fachada, só carimba' : 'fechado'}. Eleições para o cargo: ${r.elections}.
Instituições (independência de 0 a 100): ${INSTITUTIONS.map((i) => `${i.name} ${Math.round(inst[i.id])}`).join(', ')}. Índice de democracia: ${idx} (${democracyLabel(idx).label}).
Ameaças ao mandato (em 100 a crise explode): ${threatText || 'nenhuma'}.
${pillar}${special}${(state.regimeHistory ?? []).length ? `Trocas de regime: ${(state.regimeHistory ?? []).map((h) => `${dateLabel(state, h.month)} → ${h.regime} (${h.via})`).join('; ')}.\n` : ''}`;
}

const moodWord = (v: number) => (v >= 40 ? 'aliada fiel' : v >= 12 ? 'simpática' : v > -12 ? 'neutra' : v > -40 ? 'irritada' : 'em guerra com o governo');

/** Retrato do país em texto, para o Claude continuar a história. */
export function briefing(state: GameState, country: Country): string {
  const bio = country.bios.find((b) => b.id === state.player.bioId)?.name ?? '';
  const kpis = KPIS.map((k) => `- ${k.label}: ${formatKpi(k.id, state.kpis[k.id])} (início do mandato: ${formatKpi(k.id, country.kpis_iniciais[k.id])})`).join('\n');
  const axes = AXES.map((a) => {
    const v = state.axes[a.id];
    const side = v === 0 ? 'centro' : v < 0 ? a.poleA : a.poleB;
    return `- ${a.category}: ${v > 0 ? '+' : ''}${v} (${side})`;
  }).join('\n');
  const factions = country.factions.map((f) => `- ${f.name} (${f.influence}% dos votos): ${state.factions[f.id]} → ${moodWord(state.factions[f.id])}`).join('\n');
  const history = state.history.length
    ? state.history.slice(-25).map((h) => `- ${dateLabel(state, h.month)} · ${h.event}: o presidente escolheu "${h.choice}". Manchete: ${h.headline}${h.stf ? ` · STF reagiu: ${h.stf}` : ''}`).join('\n')
    : '- (nenhuma ainda)';
  const relations = (country.partners ?? [])
    .map((p) => `- ${p.name}: ${Math.round(state.relations?.[p.id] ?? 0)} → ${moodWord(state.relations?.[p.id] ?? 0)}`)
    .join('\n');
  const leans = dominantLeans(state.axes, 3).map((l) => `${l.pole} (${Math.abs(l.value)})`).join(', ') || 'nenhum';
  const nextElection = nextElectionMonth(state, country);
  const r = regimeOf(state);
  const calendar = nextElection
    ? `Faltam ${Math.max(0, nextElection - state.month)} meses para a eleição de ${dateLabel(state, nextElection)}, em que o ${r.headTitle.toLowerCase()} tenta continuar no cargo.`
    : r.elections === 'nenhuma'
      ? 'Não há eleição para o cargo: o governante fica enquanto sustentar o regime.'
      : lastTerm(state, country)
        ? 'É o último mandato permitido: não há mais reeleição. O presidente pensa no legado (ou em como ficar).'
        : 'Sem eleição marcada.';
  return `País: ${country.country_name}. Data: ${dateLabel(state, state.month)}${r.family === 'autocracia' ? '' : ` (${state.term}º mandato, mês ${state.month - (state.term - 1) * state.termMonths} de ${state.termMonths})`}.
${calendar}
${regimeBriefing(state, country)}
${r.headTitle}: ${state.player.name}, ${ageOf(state, state.month)} anos (origem: ${bio}). Perfil ideológico: ${profileTitle(state.axes)}. Polos mais fortes: ${leans}.
Relação com o STF: ${state.stf === 'LIMINAR' ? 'o STF já barrou o governo antes; clima tenso' : 'normal'}.

Indicadores:
${kpis}

Eixos ideológicos (-100 a +100):
${axes}

Bancadas no Congresso (-100 a +100):
${factions}

Relações internacionais (-100 a +100):
${relations}

${state.bill ? `Projeto do governo em tramitação: "${state.bill.title}" (${state.bill.instrument === 'mp' ? 'medida provisória, já valendo' : state.bill.instrument === 'pec' ? 'PEC' : 'projeto de lei'}), votação prevista para ${dateLabel(state, state.bill.voteMonth)}. ${state.bill.summary}\n` : ''}${(state.laws ?? []).length ? `Leis do governo em vigor: ${(state.laws ?? []).map((l) => l.title).join('; ')}.\n` : ''}
Decisões anteriores, da mais antiga à mais recente:
${history}

Escreva a próxima crise.`;
}

async function post<T>(url: string, body: unknown, timeoutMs: number): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let health: Promise<boolean> | null = null;
/**
 * O Claude responde? Só a resposta positiva fica guardada: uma falha (túnel oscilando, servidor
 * reiniciando) é conferida de novo em 10s, em vez de deixar a partida inteira sem Claude.
 */
export function claudeOnline(): Promise<boolean> {
  health ??= fetch('/api/health')
    .then((r) => (r.ok ? r.json() : { claude: false }))
    .then((j) => !!j.claude)
    .catch(() => false)
    .then((ok) => {
      if (!ok) setTimeout(() => (health = null), 10_000);
      return ok;
    });
  return health;
}

interface BigJob {
  /** Estado usado no briefing: serve para descartar o evento se o país mudou demais desde então. */
  basis: GameState;
  event: GameEvent | null;
  /** true quando o evento chegou (ou falhou) e as cenas tiveram tempo de ficar prontas. */
  settled: boolean;
}

/**
 * Orquestra o ritmo do mandato: um evento grande sendo escrito em segundo plano pelo Claude
 * enquanto despachos rápidos vão sendo decididos na mesa.
 */
export class Director {
  private cutscenes = new Map<string, Promise<Cutscene | null>>();
  private big: BigJob | null = null;
  private dispatchQueue: Dispatch[] = [];
  private dispatchPending = false;
  private dispatchFailedAt = 0;
  /** Tentativas seguidas de gerar o evento grande que falharam. */
  failures = 0;
  /** Avisado quando um evento grande fica pronto (para anunciar no feed). */
  onBigReady?: (event: GameEvent) => void;

  /** Todo conteúdo do mandato é escrito pelo Claude: não há banco fixo de eventos nem de despachos. */
  constructor(private country: Country) {}

  // ---------- evento grande ----------

  /** Encomenda o próximo evento grande com o histórico completo até aqui. */
  requestBig(state: GameState) {
    const job: BigJob = { basis: state, event: null, settled: false };
    this.big = job;
    void this.generate(state).then(async (event) => {
      if (this.big !== job) return;
      job.event = event;
      this.failures = event ? 0 : this.failures + 1;
      if (job.event) {
        this.prepareCutscenes(job.event, state);
        // Dá até 25s para as cenas ficarem prontas antes de lançar o evento.
        const cuts = [...job.event.options, job.event.omission].map((o) => this.cutsceneFor(job.event!, o, state));
        await Promise.race([Promise.allSettled(cuts), new Promise((r) => setTimeout(r, 25_000))]);
      }
      if (this.big !== job) return;
      job.settled = true;
      if (job.event) this.onBigReady?.(job.event);
    });
  }

  /** Entrega o evento grande se estiver pronto e ainda fizer sentido para o país de agora. */
  takeBig(state: GameState): GameEvent | null {
    const job = this.big;
    if (!job?.settled) return null;
    this.big = null;
    if (!job.event) return null;
    if (isStale(job.basis, state)) {
      this.requestBig(state);
      return null;
    }
    this.gotFresh();
    return job.event;
  }

  get bigInFlight(): boolean {
    return !!this.big && !this.big.settled;
  }

  private async generate(state: GameState): Promise<GameEvent | null> {
    if (!(await claudeOnline())) return null;
    const res = await post<{ event: Record<string, unknown> }>(
      '/api/event',
      {
        briefing: briefing(state, this.country).replace('Escreva a próxima crise.', 'Escreva o próximo grande acontecimento.'),
        axes: AXES.map((a) => a.id),
        factions: this.country.factions.map((f) => f.id),
        partners: (this.country.partners ?? []).map((p) => p.id),
        ministers: this.country.ministers.map((m) => m.id),
      },
      260_000,
    );
    if (!res?.event) return null;
    const event = sanitizeEvent(res.event, this.country, state.month + 1, monthName(state.month + 1));
    if (!event) return null;
    // Lições e redes só são usadas depois da assinatura: geram enquanto o jogador lê o dossiê.
    const opts = [...event.options, event.omission]
      .map((o, i) => `${i < event.options.length ? `Opção ${i + 1}` : 'Omissão'}: "${o.title}" — ${o.summary} Manchete: ${o.headline}. Efeitos: ${JSON.stringify(o.effects)}`)
      .join('\n');
    event.ready = post<{ details: unknown }>(
      '/api/event-details',
      { briefing: `Contexto do país:\n${briefing(state, this.country).replace('Escreva a próxima crise.', '')}\nAcontecimento: ${event.title}. ${event.dossier.join(' ')}\n${opts}` },
      200_000,
    ).then((r) => {
      if (r) mergeDetails(event, r.details);
    });
    return event;
  }

  /** Há um evento grande pronto para entrar. */
  get bigReady(): boolean {
    return !!this.big?.settled && !!this.big.event;
  }

  // ---------- momentos decisivos (crises terminais e campanha) ----------

  /** Pedidos que falharam há pouco: não repete antes de 90s (o servidor pode estar no limite por hora). */
  private failedAt = new Map<string, number>();
  private coolingDown(key: string): boolean {
    return Date.now() - (this.failedAt.get(key) ?? 0) < 90_000;
  }

  private crises = new Map<string, { promise: Promise<GameEvent | null>; ready: GameEvent | null }>();

  /**
   * Encomenda o momento decisivo assim que a ameaça fica séria, para ele estar pronto quando explodir.
   * `roles` são as saídas que o jogo sabe resolver; o Claude escreve cada uma no contexto do país.
   */
  prepareCrisis(key: string, state: GameState, situation: string, roles: { id: string; hint: string }[]) {
    if (this.crises.has(key) || this.coolingDown(key)) return;
    const entry = { promise: Promise.resolve<GameEvent | null>(null), ready: null as GameEvent | null };
    entry.promise = claudeOnline()
      .then((online) =>
        online
          ? post<{ event: unknown }>(
              '/api/crisis',
              {
                briefing: `${briefing(state, this.country).replace('Escreva a próxima crise.', '')}\nMOMENTO DECISIVO: ${situation}\nPapéis das 4 opções, nesta ordem:\n${roles.map((r) => `- ${r.id}: ${r.hint}`).join('\n')}`,
                axes: AXES.map((a) => a.id),
                factions: this.country.factions.map((f) => f.id),
                partners: (this.country.partners ?? []).map((p) => p.id),
                ministers: this.country.ministers.map((m) => m.id),
                roles: roles.map((r) => r.id),
              },
              260_000,
            )
          : null,
      )
      .then((r) => {
        const ev = r?.event ? sanitizeCrisis(r.event, this.country, state.month, monthName(state.month), roles.map((x) => x.id)) : null;
        if (ev) {
          const opts = [...ev.options, ev.omission].map((o, i) => `${i < ev.options.length ? `Opção ${i + 1}` : 'Omissão'}: "${o.title}" — ${o.summary}`).join('\n');
          ev.ready = post<{ details: unknown }>('/api/event-details', { briefing: `Contexto do país:\n${briefing(state, this.country).replace('Escreva a próxima crise.', '')}\nMomento decisivo: ${ev.title}. ${ev.dossier.join(' ')}\n${opts}` }, 200_000).then((d) => {
            if (d) mergeDetails(ev, d.details);
          });
          this.prepareCutscenes(ev, state);
        }
        entry.ready = ev;
        if (!ev) {
          this.crises.delete(key);
          this.failedAt.set(key, Date.now());
        }
        return ev;
      });
    this.crises.set(key, entry);
  }

  /** O momento decisivo, se pronto. Com `ms`, espera até esse tempo. */
  async takeCrisis(key: string, ms = 0): Promise<GameEvent | null> {
    const e = this.crises.get(key);
    if (!e) return null;
    if (!e.ready && ms) await Promise.race([e.promise, new Promise((r) => setTimeout(r, ms))]);
    if (!e.ready) return null;
    this.crises.delete(key);
    return e.ready;
  }

  hasCrisis(key: string): boolean {
    return this.crises.has(key);
  }

  // ---------- despachos ----------

  /** Mantém a fila de despachos gerados abastecida (lotes de 4). */
  refillDispatches(state: GameState) {
    if (this.dispatchPending || this.dispatchQueue.length >= 3 || Date.now() - this.dispatchFailedAt < 30_000) return;
    this.dispatchPending = true;
    void claudeOnline()
      .then((online) =>
        online
          ? post<{ dispatches: unknown[] }>(
              '/api/dispatches',
              {
                briefing: briefing(state, this.country).replace('Escreva a próxima crise.', 'Escreva 4 despachos para as próximas semanas.'),
                axes: AXES.map((a) => a.id),
                factions: this.country.factions.map((f) => f.id),
        partners: (this.country.partners ?? []).map((p) => p.id),
              },
              120_000,
            )
          : null,
      )
      .then((r) => {
        if (!r) this.dispatchFailedAt = Date.now();
        for (const raw of r?.dispatches ?? []) {
          const d = sanitizeDispatch(raw, this.country);
          if (d) this.dispatchQueue.push(d);
        }
      })
      .finally(() => (this.dispatchPending = false));
  }

  /**
   * Próximo despacho: o personalizado da fila; se ela estiver vazia (a leva ainda está sendo escrita),
   * um do acervo que o jogador ainda não viu: de início de mandato nos primeiros meses, geral depois.
   */
  nextDispatch(state: GameState): Dispatch | null {
    this.refillDispatches(state);
    const fresh = this.dispatchQueue.shift();
    if (fresh) {
      this.poolStreak = 0;
      return fresh;
    }
    // O acervo só cobre a espera: sem nada novo do Claude por vários despachos, a mesa espera por ele.
    if (this.poolStreak >= 4) return null;
    this.poolStreak++;
    return this.fromPool(state);
  }

  /** Despachos do acervo seguidos, sem nada escrito pelo Claude no meio. */
  private poolStreak = 0;
  /** Chegou algo novo do Claude (evento, cena, coletiva): o acervo pode voltar a cobrir esperas. */
  gotFresh() {
    this.poolStreak = 0;
  }

  private fromPool(state: GameState): Dispatch | null {
    const want = state.month <= 4 ? 'inicio' : 'geral';
    let seen = seenPool();
    let left = POOL.filter((d) => !seen.has(d.title) && !this.usedTitles.has(d.title));
    if (!left.length) {
      // viu o acervo inteiro: recomeça, mas nunca repete dentro da mesma partida
      try {
        localStorage.removeItem(SEEN_KEY);
      } catch {
        /* nada */
      }
      seen = new Set();
      left = POOL.filter((d) => !this.usedTitles.has(d.title));
    }
    const preferred = left.filter((d) => d.pool === want);
    const options = preferred.length ? preferred : left.filter((d) => d.pool === 'geral');
    const raw = options[Math.floor(Math.random() * options.length)];
    if (!raw) return null;
    this.usedTitles.add(raw.title);
    markSeen(raw.title);
    return sanitizeDispatch(raw, this.country);
  }

  private usedTitles = new Set<string>();

  get hasDispatch(): boolean {
    return this.dispatchQueue.length > 0;
  }

  // ---------- boletim ----------

  /** Editorial do momento e a fala de cada ministro, escritos pelo Claude. */
  bulletin(state: GameState): Promise<GameState['bulletin'] | null> {
    return claudeOnline().then((online) =>
      online
        ? post<{ editorial: string; ministers: Record<string, string> }>(
            '/api/bulletin',
            { briefing: briefing(state, this.country).replace('Escreva a próxima crise.', 'Escreva o boletim do Planalto.') },
            90_000,
          ).then((r) =>
            r?.editorial
              ? {
                  month: state.month,
                  editorial: String(r.editorial).slice(0, 320),
                  ministers: Object.fromEntries(Object.entries(r.ministers ?? {}).map(([k, v]) => [k, String(v).slice(0, 130)])),
                }
              : null,
          )
        : null,
    );
  }

  // ---------- legado ----------

  /** A manchete e o epitáfio do governo, escritos pelo Claude com o histórico completo. */
  legacy(state: GameState, ending: string): Promise<{ headline: string; epitaph: string } | null> {
    const how: Record<string, string> = {
      impeachment: 'Terminou afastado por impeachment.',
      derrota: 'Terminou derrotado nas urnas.',
      renuncia: 'Terminou renunciando.',
      fim: 'Completou todo o tempo que as regras permitiam.',
      pausa: 'O governo ainda está em curso.',
      desconfianca: 'Caiu numa moção de desconfiança do Parlamento.',
      queda: 'Caiu derrubado por uma revolta popular.',
      exilio: 'Fugiu do país e terminou no exílio.',
      deposto: 'Foi deposto por um golpe militar.',
      preso: 'Tentou um golpe, fracassou e foi preso.',
      cassado: 'Teve a chapa cassada pelo TSE por abuso de poder na campanha.',
      expurgo: 'Foi expurgado pelo próprio partido.',
      destituido: 'Foi destituído pelo conselho que sustentava o regime.',
      morte: 'Morreu no poder, de velhice, sem nunca ter largado o cargo.',
      abertura: 'Negociou a abertura e devolveu o país à democracia.',
    };
    return claudeOnline().then((online) =>
      online
        ? post<{ headline: string; epitaph: string }>(
            '/api/legacy',
            { briefing: `${briefing(state, this.country).replace('Escreva a próxima crise.', '')}\nDesfecho: ${how[ending] ?? ending}\nEscreva o legado.` },
            90_000,
          ).then((r) => (r?.headline ? { headline: String(r.headline).slice(0, 90), epitaph: String(r.epitaph ?? '').slice(0, 420) } : null))
        : null,
    );
  }

  // ---------- propostas de lei ----------

  private bills: Promise<BillProposal[]> | null = null;
  billsReady: BillProposal[] | null = null;

  /** Encomenda 4 propostas de lei para o momento do governo (abrem na hora quando o jogador pedir). */
  prepareBills(state: GameState) {
    if (this.bills || this.billsReady) return;
    this.bills = claudeOnline()
      .then((online) =>
        online
          ? post<{ proposals: unknown[] }>(
              '/api/bills',
              {
                briefing: briefing(state, this.country).replace('Escreva a próxima crise.', 'Proponha os projetos.'),
                axes: AXES.map((a) => a.id),
                factions: this.country.factions.map((f) => f.id),
                partners: (this.country.partners ?? []).map((p) => p.id),
              },
              120_000,
            )
          : null,
      )
      .then((r) => sanitizeBills(r, this.country));
    void this.bills.then((b) => {
      this.billsReady = b.length ? b : null;
      this.bills = null;
    });
  }

  /** Entrega as propostas prontas (ou espera as que estão sendo escritas) e encomenda as próximas depois. */
  async takeBills(): Promise<BillProposal[]> {
    if (!this.billsReady && this.bills) await this.bills;
    const b = this.billsReady ?? [];
    this.billsReady = null;
    return b;
  }

  // ---------- cenas interativas ----------

  private scenes = new Map<string, { promise: Promise<unknown>; ready: unknown | null; failed: boolean }>();

  /** Encomenda o roteiro de uma cena interativa ao Claude, com o mandato de agora (e instruções extras da cena). */
  prepareScene(kind: LabKindName, state: GameState, extra = '', key: string = kind) {
    if (this.scenes.has(key) || this.coolingDown(key)) return;
    const entry = { promise: Promise.resolve<unknown>(null), ready: null as unknown | null, failed: false };
    entry.promise = import('../lab/scripts')
      .then((m) => m.requestScript(kind, true, state, extra))
      .then((script) => (entry.ready = script))
      .catch(() => {
        entry.failed = true;
        this.scenes.delete(key);
        this.failedAt.set(key, Date.now());
      });
    this.scenes.set(key, entry);
  }

  /** O roteiro, se já estiver pronto. Nunca espera. */
  takeScene(key: string): unknown | null {
    const e = this.scenes.get(key);
    if (!e?.ready) return null;
    this.scenes.delete(key);
    this.gotFresh();
    return e.ready;
  }

  sceneReady(key: string): boolean {
    return !!this.scenes.get(key)?.ready;
  }

  /** Espera o roteiro por até `ms` (usado no debate da eleição, que não pode ser pulado à toa). */
  async awaitScene(key: string, ms: number): Promise<unknown | null> {
    const e = this.scenes.get(key);
    if (!e) return null;
    await Promise.race([e.promise, new Promise((r) => setTimeout(r, ms))]);
    return this.takeScene(key);
  }

  /** A cinemática da troca de regime (a posse da Junta, a coroação, o desfile da revolução), dirigida pelo Claude. */
  regimeCutscene(state: GameState, to: RegimeId, via: string): Promise<Cutscene | null> {
    const r = getRegime(to);
    const brief = `Mudança de regime no Brasil: o país deixa de ser ${regimeOf(state).name} e passa a ser ${r.name}, por ${via}.
Governante: ${state.player.name}, agora ${r.headTitle}. Perfil: ${profileTitle(state.axes)}. Aprovação: ${Math.round(state.kpis.aprovacao)}%.
Faça a cena do marco histórico: ${r.family === 'autocracia' ? 'a tomada do poder e a primeira aparição do novo regime (tanques, bandeiras, multidão, desfile, discurso na sacada)' : 'a posse do novo sistema (juramento, votação histórica, festa ou protesto)'}. Desenhe o que não existir na biblioteca (bandeiras novas, coroa, trono, robôs, templo...).
Legenda: a manchete histórica do dia.`;
    return claudeOnline().then((online) =>
      online ? post<{ cutscene: unknown }>('/api/cutscene', { briefing: brief }, 200_000).then((x) => (x ? sanitizeCutscene(x.cutscene, `O Brasil agora é: ${r.name}`) : null)) : null,
    );
  }

  // ---------- coletivas ----------

  private interview: Promise<Interview | null> | null = null;
  private readyInterview: Interview | null = null;

  /**
   * Encomenda a próxima coletiva. As perguntas são sempre escritas pelo Claude a partir do
   * que o presidente fez: não existe coletiva de reserva.
   */
  prepareInterview(state: GameState) {
    if (this.interview || this.readyInterview) return;
    const job = claudeOnline().then((online) =>
      online
        ? post<{ questions: unknown[] }>(
            '/api/interview',
            {
              briefing: briefing(state, this.country).replace('Escreva a próxima crise.', 'Escreva a próxima coletiva de imprensa.'),
              axes: AXES.map((a) => a.id),
              factions: this.country.factions.map((f) => f.id),
              partners: (this.country.partners ?? []).map((p) => p.id),
            },
            120_000,
          ).then((r) => (r ? sanitizeInterview(r, this.country) : null))
        : null,
    );
    this.interview = job;
    void job.then((iv) => {
      if (this.interview !== job) return;
      this.interview = null;
      this.readyInterview = iv;
    });
  }

  /** A coletiva, se o Claude já terminou de escrever. Nunca espera. */
  takeInterview(): Interview | null {
    const iv = this.readyInterview;
    this.readyInterview = null;
    if (iv) this.gotFresh();
    return iv;
  }

  // ---------- cinemáticas ----------

  /** Encomenda as cenas das opções em paralelo. */
  prepareCutscenes(event: GameEvent, state: GameState) {
    void claudeOnline().then((online) => {
      if (!online) return;
      for (const opt of [...event.options, event.omission]) this.cutsceneFor(event, opt, state);
    });
  }

  cutsceneFor(event: GameEvent, opt: EventOption, state: GameState): Promise<Cutscene | null> {
    const key = `${event.id}:${opt.id}`;
    let p = this.cutscenes.get(key);
    if (!p) {
      const brief = `Acontecimento: ${event.title}. ${event.dossier.join(' ')}
Decisão do presidente ${state.player.name}: "${opt.title}" — ${opt.summary}
Manchete: ${opt.headline}. ${opt.subhead}
${opt.cutscene_idea ? `Ideia de cena: ${opt.cutscene_idea}` : ''}
Perfil do presidente: ${profileTitle(state.axes)}. Aprovação: ${state.kpis.aprovacao}%.
Animação da Esplanada mais próxima: ${opt.scene.anim}.`;
      p = claudeOnline().then((online) =>
        online ? post<{ cutscene: unknown }>('/api/cutscene', { briefing: brief }, 200_000).then((r) => (r ? sanitizeCutscene(r.cutscene, opt.headline) : null)) : null,
      );
      this.cutscenes.set(key, p);
    }
    return p;
  }
}

/** O país mudou tanto desde o pedido que o texto do evento ficaria errado. */
function isStale(basis: GameState, now: GameState): boolean {
  return Math.abs(basis.kpis.aprovacao - now.kpis.aprovacao) > 15 || Math.abs(basis.kpis.coalizao - now.kpis.coalizao) > 15;
}

