import { BACKDROPS, CUSTOM_BACKDROP, CUT_ACTIONS, LIB_SPRITES, MAX_SPRITE, SCENE_ANIMS } from './catalog';
import { AXES } from './data';
import type {
  AxisId, BillProposal, BillSpecial, InstitutionId, Country, CutAction, Dispatch, DispatchOption, Interview, InterviewQuestion, Place, CutActor, CutStep, Cutscene, Effects, EventOption, GameEvent, KpiId, PixelSprite, PostTone, SceneAnim, SocialPost, SocialWave,
} from './types';

/* Tudo que o Claude gera passa por aqui: valores limitados, ids conferidos, textos cortados. */

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number, fallback = ''): string => (typeof v === 'string' ? v.trim().slice(0, max) : fallback);
const num = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Maior variação aceita por decisão em cada indicador. */
export const KPI_LIMITS: Record<KpiId, number> = {
  aprovacao: 12, coalizao: 12, selic: 1.5, inflacao: 1.2, desemprego: 0.8, seguranca: 1, educacao: 0.6,
};
const AXIS_LIMIT = 30;
const INSTITUTION_LIMIT = 15;
const FACTION_LIMIT = 25;

const PLACES: Place[] = ['norte', 'nordeste', 'centro_oeste', 'sudeste', 'sul', 'nacional', 'exterior'];
const place = (v: unknown): Place | undefined => (PLACES.includes(v as Place) ? (v as Place) : undefined);

export function sanitizeEffects(raw: unknown, country: Country): Effects {
  const out: Effects = { axes: {}, kpis: {}, factions: {}, relations: {} };
  if (!isObj(raw)) return out;
  const axes = isObj(raw.axes) ? raw.axes : {};
  for (const a of AXES) {
    const v = num(axes[a.id], -AXIS_LIMIT, AXIS_LIMIT, 0);
    if (v) out.axes![a.id as AxisId] = Math.round(v);
  }
  const kpis = isObj(raw.kpis) ? raw.kpis : {};
  for (const [id, lim] of Object.entries(KPI_LIMITS) as [KpiId, number][]) {
    const v = num(kpis[id], -lim, lim, 0);
    if (v) out.kpis![id] = Math.round(v * 100) / 100;
  }
  const factions = isObj(raw.factions) ? raw.factions : {};
  for (const f of country.factions) {
    const v = num(factions[f.id], -FACTION_LIMIT, FACTION_LIMIT, 0);
    if (v) out.factions![f.id] = Math.round(v);
  }
  const relations = isObj(raw.relations) ? raw.relations : {};
  for (const p of country.partners ?? []) {
    const v = num(relations[p.id], -FACTION_LIMIT, FACTION_LIMIT, 0);
    if (v) out.relations![p.id] = Math.round(v);
  }
  const inst = isObj(raw.institutions) ? raw.institutions : {};
  for (const id of ['stf', 'congresso', 'imprensa', 'eleicoes'] as InstitutionId[]) {
    const v = num(inst[id], -INSTITUTION_LIMIT, INSTITUTION_LIMIT, 0);
    if (v) (out.institutions ??= {})[id] = Math.round(v);
  }
  return out;
}

function sanitizePalette(raw: unknown): Record<string, string> | null {
  if (!isObj(raw)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.length === 1 && k !== '.' && k !== ' ' && typeof v === 'string' && HEX.test(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

function sanitizeSprite(raw: unknown): PixelSprite | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id, 24);
  const palette = sanitizePalette(raw.palette);
  const rows = arr(raw.rows).filter((r): r is string => typeof r === 'string').slice(0, MAX_SPRITE).map((r) => r.slice(0, MAX_SPRITE));
  if (!/^[a-z0-9_]+$/.test(id) || !palette || rows.length === 0) return null;
  return { id, palette, rows };
}

const TONES: PostTone[] = ['angry', 'happy', 'neutral', 'press', 'bot', 'faction'];

/** Perfis recorrentes: se o gerador mandar só o @, recuperamos o nome. */
const KNOWN_HANDLES: Record<string, string> = {
  'tiacleide.zap': 'Tia Cleide', 'pedrao.memes': 'Pedro Memes', profmarina: 'Prof. Marina', 'tionando.patriota': 'Tio Nando',
  'fl.insider': 'Faria Lima Insider', economiahoje: 'Economia Hoje', 'ju.constituicao': 'Advogada Ju',
};

function sanitizePost(raw: unknown): SocialPost | null {
  if (!isObj(raw)) return null;
  const text = str(raw.text, 180);
  let who = str(raw.who, 30);
  if (who.startsWith('@')) {
    const handle = who.slice(1);
    if (!raw.at) raw.at = handle;
    who = KNOWN_HANDLES[handle] ?? handle;
  }
  if (!text || !who) return null;
  return {
    who,
    at: str(raw.at, 24, who.toLowerCase().replace(/[^a-z0-9.]/g, '')).replace(/^@/, ''),
    text,
    likes: Math.round(num(raw.likes, 0, 5_000_000, 1000)),
    tone: TONES.includes(raw.tone as PostTone) ? (raw.tone as PostTone) : 'neutral',
  };
}

function sanitizeWave(raw: unknown): SocialWave {
  const r = isObj(raw) ? raw : {};
  const trending = str(r.trending, 32, '#Brasil');
  return {
    trending: trending.startsWith('#') ? trending : `#${trending}`,
    sentiment: Math.round(num(r.sentiment, -100, 100, 0)),
    posts: arr(r.posts).map(sanitizePost).filter((p): p is SocialPost => !!p).slice(0, 5),
  };
}

const anim = (v: unknown, fallback: SceneAnim): SceneAnim => (typeof v === 'string' && v in SCENE_ANIMS ? (v as SceneAnim) : fallback);

export function sanitizeCutscene(raw: unknown, fallbackCaption = ''): Cutscene | null {
  if (!isObj(raw)) return null;
  const sprites = arr(raw.sprites).map(sanitizeSprite).filter((s): s is PixelSprite => !!s).slice(0, 6);
  const known = new Set([...Object.keys(LIB_SPRITES), ...sprites.map((s) => s.id)]);

  let backdrop = typeof raw.backdrop === 'string' && (raw.backdrop in BACKDROPS || raw.backdrop === 'custom') ? (raw.backdrop as Cutscene['backdrop']) : 'esplanada';
  let customBackdrop: Cutscene['customBackdrop'];
  if (backdrop === 'custom') {
    const cb = isObj(raw.customBackdrop) ? raw.customBackdrop : {};
    const palette = sanitizePalette(cb.palette);
    const rows = arr(cb.rows).filter((r): r is string => typeof r === 'string');
    if (palette && rows.length >= CUSTOM_BACKDROP.rows / 2) {
      customBackdrop = {
        palette,
        rows: Array.from({ length: CUSTOM_BACKDROP.rows }, (_, i) => (rows[i] ?? rows[rows.length - 1]).padEnd(CUSTOM_BACKDROP.cols, '.').slice(0, CUSTOM_BACKDROP.cols)),
      };
    } else {
      backdrop = 'esplanada';
    }
  }

  const actors: CutActor[] = arr(raw.actors)
    .filter(isObj)
    .map((a) => ({
      id: str(a.id, 24),
      sprite: str(a.sprite, 24),
      x: num(a.x, -40, 232, 96),
      y: num(a.y, 0, 130, 100),
      flip: a.flip === true,
      holding: typeof a.holding === 'string' && known.has(a.holding) ? a.holding : undefined,
      layer: a.layer === 'back' ? ('back' as const) : ('front' as const),
      hidden: a.hidden === true,
      count: Math.round(num(a.count, 1, 24, 1)),
      spacing: num(a.spacing, 4, 40, 14),
    }))
    .filter((a) => a.id && known.has(a.sprite))
    .slice(0, 16);
  const ids = new Set(actors.map((a) => a.id));

  const timeline: CutStep[] = arr(raw.timeline)
    .filter(isObj)
    .map((s) => ({
      t: num(s.t, 0, 8, 0),
      do: s.do as CutAction,
      actor: typeof s.actor === 'string' ? s.actor : undefined,
      x: typeof s.x === 'number' ? num(s.x, -40, 232, 96) : undefined,
      y: typeof s.y === 'number' ? num(s.y, 0, 130, 100) : undefined,
      dur: typeof s.dur === 'number' ? num(s.dur, 0.1, 4, 1) : undefined,
      text: typeof s.text === 'string' ? s.text.slice(0, 60) : undefined,
      sprite: typeof s.sprite === 'string' && known.has(s.sprite) ? s.sprite : undefined,
    }))
    .filter((s) => s.do in CUT_ACTIONS && (!s.actor || ids.has(s.actor)))
    .slice(0, 40);

  return {
    backdrop,
    anim: raw.anim !== undefined ? anim(raw.anim, 'calm') : undefined,
    customBackdrop,
    sprites,
    actors,
    timeline,
    caption: str(raw.caption, 140, fallbackCaption),
  };
}

function sanitizeOption(raw: unknown, country: Country, id: string): EventOption | null {
  if (!isObj(raw)) return null;
  const title = str(raw.title, 70);
  const headline = str(raw.headline, 90);
  const lesson = isObj(raw.lesson) ? raw.lesson : {};
  if (!title || !headline) return null;
  const scene = isObj(raw.scene) ? raw.scene : {};
  const stfRaw = isObj(raw.stf) ? raw.stf : null;
  return {
    id,
    icon: str(raw.icon, 4, '📜') || '📜',
    title,
    summary: str(raw.summary, 200),
    effects: sanitizeEffects(raw.effects, country),
    scene: { anim: anim(scene.anim, 'calm') },
    headline,
    subhead: str(raw.subhead, 200),
    stf: stfRaw && str(stfRaw.text, 10)
      ? { title: str(stfRaw.title, 40, 'LIMINAR DO STF'), text: str(stfRaw.text, 600), effects: sanitizeEffects(stfRaw.effects, country) }
      : undefined,
    lesson: { title: str(lesson.title, 80, 'O peso da caneta'), text: str(lesson.text, 800) },
    social: sanitizeWave(raw.social),
    cutscene_idea: str(raw.cutscene_idea, 300) || undefined,
    role: str(raw.role, 20) || undefined,
  };
}

/**
 * Momento decisivo: cada papel pedido precisa aparecer uma vez (é ele que decide a mecânica).
 * Opções com papel repetido ou desconhecido são descartadas; se faltar papel, o evento não serve.
 */
export function sanitizeCrisis(raw: unknown, country: Country, month: number, monthName: string, roles: string[]): GameEvent | null {
  const event = sanitizeEvent(raw, country, month, monthName);
  if (!event || !isObj(raw)) return null;
  const all = arr(raw.options).map((o, i) => sanitizeOption(o, country, `op${i + 1}`)).filter((o): o is EventOption => !!o);
  const byRole = roles.map((r) => all.find((o) => o.role === r));
  if (byRole.some((o) => !o)) return null;
  event.options = byRole.map((o, i) => ({ ...o!, id: roles[i] }));
  return event;
}

/** Junta lições e reações das redes (geradas depois) às opções de um evento. */
export function mergeDetails(event: GameEvent, raw: unknown) {
  if (!isObj(raw)) return;
  const apply = (opt: EventOption, d: unknown) => {
    if (!isObj(d)) return;
    const lesson = isObj(d.lesson) ? d.lesson : {};
    if (str(lesson.text, 10)) opt.lesson = { title: str(lesson.title, 80, 'O peso da caneta'), text: str(lesson.text, 800) };
    const wave = sanitizeWave(d.social);
    if (wave.posts.length) opt.social = wave;
  };
  arr(raw.options).forEach((d, i) => event.options[i] && apply(event.options[i], d));
  apply(event.omission, raw.omission);
}

/** Converte a saída do gerador num evento jogável, ou null se estiver incompleta. */
export function sanitizeEvent(raw: unknown, country: Country, month: number, monthName: string): GameEvent | null {
  if (!isObj(raw)) return null;
  const options = arr(raw.options).map((o, i) => sanitizeOption(o, country, `op${i + 1}`)).filter((o): o is EventOption => !!o);
  const omission = sanitizeOption(raw.omission, country, 'omissao');
  const title = str(raw.title, 60);
  if (options.length < 3 || !omission || !title) return null;
  omission.icon = '⌛';
  const pressure = isObj(raw.pressure) ? raw.pressure : {};
  const ministersRaw = isObj(raw.ministers) ? raw.ministers : {};
  const ministers: Record<string, string> = {};
  for (const m of country.ministers) {
    const t = str(ministersRaw[m.id], 320);
    if (t) ministers[m.id] = t;
  }
  const scene = isObj(raw.scene) ? raw.scene : {};
  return {
    id: `GEN_${month}_${Math.random().toString(36).slice(2, 7)}`,
    country: country.country_id,
    month,
    month_name: monthName,
    kicker: str(raw.kicker, 40, 'NOVA CRISE').toUpperCase(),
    title,
    dossier: arr(raw.dossier).map((d) => str(d, 260)).filter(Boolean).slice(0, 2),
    echoes: str(raw.callback, 240) ? [{ when: '*', text: str(raw.callback, 240) }] : [],
    advisor: str(raw.advisor, 260, 'Presidente, precisamos decidir.'),
    social: sanitizeWave(raw.social),
    scene: { anim: anim(scene.anim, 'protest') },
    pressure: {
      seconds: Math.round(num(pressure.seconds, 40, 75, 60)),
      label: str(pressure.label, 40, 'TEMPO ATÉ A CRISE ESTOURAR').toUpperCase(),
      ...(['h', 'd', 'min', '%', 'k', 'sem'].includes(str(pressure.unit, 4))
        ? { unitMax: Math.round(num(pressure.unitMax, 1, 999, 72)), unit: str(pressure.unit, 4) }
        : { unitMax: 100, unit: '%' }),
    },
    ministers,
    options: options.slice(0, 4),
    omission,
    generated: true,
    kind: str(raw.kind, 20) || undefined,
    region: place(raw.region),
  };
}

/** Despacho gerado: 2 ou 3 opções com efeitos pequenos (metade dos limites de um evento grande). */
export function sanitizeDispatch(raw: unknown, country: Country): Dispatch | null {
  if (!isObj(raw)) return null;
  const title = str(raw.title, 60);
  const options = arr(raw.options)
    .filter(isObj)
    .map((o, i): DispatchOption | null => {
      const label = str(o.label, 40);
      const reaction = str(o.reaction, 240);
      if (!label || !reaction) return null;
      const effects = sanitizeEffects(o.effects, country);
      for (const k of Object.keys(effects.kpis ?? {}) as KpiId[]) effects.kpis![k] = Math.max(-KPI_LIMITS[k] / 2, Math.min(KPI_LIMITS[k] / 2, effects.kpis![k]!));
      for (const k of Object.keys(effects.axes ?? {}) as AxisId[]) effects.axes![k] = Math.max(-15, Math.min(15, effects.axes![k]!));
      for (const k of Object.keys(effects.factions ?? {})) effects.factions![k] = Math.max(-15, Math.min(15, effects.factions![k]));
      for (const k of Object.keys(effects.relations ?? {})) effects.relations![k] = Math.max(-15, Math.min(15, effects.relations![k]));
      return {
        id: `o${i + 1}`,
        icon: str(o.icon, 4, '✅') || '✅',
        label,
        stamp: str(o.stamp, 14, 'DESPACHADO').toUpperCase(),
        effects,
        reaction,
        post: sanitizePost(o.post) ?? undefined,
        anim: o.anim !== undefined ? anim(o.anim, 'calm') : undefined,
      };
    })
    .filter((o): o is DispatchOption => !!o)
    .slice(0, 3);
  if (!title || options.length < 2) return null;
  return {
    id: `GEND_${Math.random().toString(36).slice(2, 8)}`,
    icon: str(raw.icon, 4, '📨') || '📨',
    from: str(raw.from, 30, 'Casa Civil'),
    title,
    text: str(raw.text, 240),
    options,
    generated: true,
    region: place(raw.region),
  };
}

/** Coletiva gerada: 3 perguntas com 2 ou 3 respostas curtas e efeitos pequenos. */
export function sanitizeInterview(raw: unknown, country: Country): Interview | null {
  if (!isObj(raw)) return null;
  const questions = arr(raw.questions)
    .filter(isObj)
    .map((q): InterviewQuestion | null => {
      const answers = arr(q.answers)
        .filter(isObj)
        .map((a) => {
          const effects = sanitizeEffects(a.effects, country);
          for (const k of Object.keys(effects.kpis ?? {}) as KpiId[]) effects.kpis![k] = Math.max(-KPI_LIMITS[k] / 3, Math.min(KPI_LIMITS[k] / 3, effects.kpis![k]!));
          for (const k of Object.keys(effects.axes ?? {}) as AxisId[]) effects.axes![k] = Math.max(-8, Math.min(8, effects.axes![k]!));
          for (const k of Object.keys(effects.factions ?? {})) effects.factions![k] = Math.max(-10, Math.min(10, effects.factions![k]));
          for (const k of Object.keys(effects.relations ?? {})) effects.relations![k] = Math.max(-10, Math.min(10, effects.relations![k]));
          return { icon: str(a.icon, 4, '💬') || '💬', label: str(a.label, 50), effects, headline: str(a.headline, 110) };
        })
        .filter((a) => a.label && a.headline)
        .slice(0, 3);
      const question = str(q.question, 200);
      if (!question || answers.length < 2) return null;
      return { journalist: str(q.journalist, 30, 'Repórter'), outlet: str(q.outlet, 30, 'Imprensa'), question, answers };
    })
    .filter((q): q is InterviewQuestion => !!q)
    .slice(0, 3);
  return questions.length >= 2 ? { id: `GENI_${Math.random().toString(36).slice(2, 8)}`, questions, generated: true } : null;
}

const SPECIALS: BillSpecial[] = ['reeleicao', 'stf', 'imprensa', 'eleicoes', 'fortalecer'];

/** Propostas de lei: efeitos no dia da aprovação e efeito mensal pequeno, com teto. */
export function sanitizeBills(raw: unknown, country: Country): BillProposal[] {
  if (!isObj(raw)) return [];
  const monthlyCap: Partial<Record<KpiId, number>> = { aprovacao: 0.5, inflacao: 0.08, desemprego: 0.08, seguranca: 0.05, educacao: 0.05, selic: 0.05 };
  return arr(raw.proposals)
    .filter(isObj)
    .map((p, i): BillProposal | null => {
      const title = str(p.title, 60);
      if (!title) return null;
      const effects = sanitizeEffects(p.effects, country);
      for (const k of Object.keys(effects.kpis ?? {}) as KpiId[]) effects.kpis![k] = Math.max(-8, Math.min(8, effects.kpis![k]!));
      const m = isObj(p.monthly) ? p.monthly : {};
      const monthly = Object.fromEntries(
        (Object.entries(monthlyCap) as [KpiId, number][]).map(([k, cap]) => [k, num(m[k], -cap, cap, 0)]).filter(([, v]) => v),
      ) as Partial<Record<KpiId, number>>;
      return {
        id: `BILL_${Date.now().toString(36)}_${i}`,
        icon: str(p.icon, 4, '📜') || '📜',
        title,
        summary: str(p.summary, 200),
        area: str(p.area, 20),
        needsPec: p.needsPec === true || ['reeleicao', 'stf', 'eleicoes'].includes(String(p.special)),
        effects,
        monthly,
        months: Math.round(num(p.months, 6, 24, 12)),
        lesson: str(p.lesson, 240),
        special: SPECIALS.includes(p.special as BillSpecial) ? (p.special as BillSpecial) : undefined,
      };
    })
    .filter((b): b is BillProposal => !!b)
    .slice(0, 4);
}
