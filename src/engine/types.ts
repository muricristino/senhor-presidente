export type AxisId =
  | 'governanca' | 'poder' | 'direitos' | 'sociedade' | 'defesa' | 'diplomacia'
  | 'propriedade' | 'economia' | 'comercio' | 'cultura' | 'valores' | 'tecnologia';

export type KpiId = 'aprovacao' | 'coalizao' | 'seguranca' | 'educacao' | 'desemprego' | 'selic' | 'inflacao';

export interface AxisDef {
  id: AxisId;
  category: string;
  poleA: string;
  poleB: string;
  titleA: string;
  titleB: string;
  explainA: string;
  explainB: string;
}

export interface Effects {
  axes?: Partial<Record<AxisId, number>>;
  kpis?: Partial<Record<KpiId, number>>;
  factions?: Record<string, number>;
  /** Relação com outros países (-100 a +100). */
  relations?: Record<string, number>;
}

export type RegionId = 'norte' | 'nordeste' | 'centro_oeste' | 'sudeste' | 'sul';
/** Onde um acontecimento se passa: uma região, o país todo ou o exterior. */
export type Place = RegionId | 'nacional' | 'exterior';

export interface Region {
  id: RegionId;
  name: string;
  /** % da população. */
  pop: number;
  /** Como eixos e bancadas mexem na aprovação desta região, além da nacional. */
  lean: { axes?: Partial<Record<AxisId, number>>; factions?: Record<string, number> };
}

export interface Partner {
  id: string;
  name: string;
  short: string;
  flag: string;
  /** Peso no comércio exterior brasileiro (a soma dá ~1). */
  trade: number;
  start: number;
  /** Como a posição do Brasil nos eixos agrada ou irrita este parceiro. */
  likes: Partial<Record<AxisId, number>>;
}

export interface Faction {
  id: string;
  name: string;
  short: string;
  influence: number;
  color: string;
  cares: string[];
}

export interface Minister {
  id: string;
  name: string;
  role: string;
  color: string;
  avatar: string;
}

export interface Bio {
  id: string;
  name: string;
  desc: string;
  bonus: string;
  effects: Effects;
}

export interface Country {
  country_id: string;
  country_name: string;
  flag: string;
  available: boolean;
  head_of_state_title: string;
  capital: string;
  palace: string;
  calendar: { start_year: number; term_months: number; max_terms: number; election_month: number; min_age: number };
  chamber: { seats: number; impeachment_votes: number };
  institutions: { supreme_court: string; legislative: string; constitution_year: number };
  factions: Faction[];
  kpis_iniciais: Record<KpiId, number>;
  advisor: { name: string; role: string; avatar: string };
  ministers: Minister[];
  bios: Bio[];
  partners: Partner[];
  regions: Region[];
}

/** Animações da Janela do Planalto. O gerador de eventos só pode escolher entre estas. */
export type SceneAnim =
  | 'calm' | 'protest' | 'celebrate' | 'military' | 'fire' | 'firefight'
  | 'trucks_block' | 'trucks_leave' | 'money_rain' | 'phones_live' | 'blackout' | 'gavel'
  | 'vote_yes' | 'vote_no' | 'market_crash' | 'market_boom' | 'prices_up' | 'prices_down' | 'speech';

export interface SceneState {
  anim: SceneAnim;
}

export type PostTone = 'angry' | 'happy' | 'neutral' | 'press' | 'bot' | 'faction';

export interface SocialPost {
  who: string;
  at: string;
  text: string;
  likes: number;
  tone: PostTone;
}

export interface SocialWave {
  trending: string;
  /** -100 (fúria) a +100 (euforia) */
  sentiment: number;
  posts: SocialPost[];
}

export interface EventOption {
  id: string;
  icon: string;
  title: string;
  summary: string;
  effects: Effects;
  scene: SceneState;
  headline: string;
  subhead: string;
  stf?: { title: string; text: string; effects?: Effects };
  lesson: { title: string; text: string };
  social: SocialWave;
  /** Roteiro da cinemática. Sem ele, a Esplanada toca `scene.anim`. */
  cutscene?: Cutscene;
  /** Ideia de cena que o gerador usa para escrever o roteiro depois. */
  cutscene_idea?: string;
}

export interface GameEvent {
  id: string;
  country: string;
  month: number;
  month_name: string;
  kicker: string;
  title: string;
  dossier: string[];
  /** Linhas extras que só aparecem se uma decisão anterior (`eventId:optionId`) foi tomada. */
  echoes?: { when: string; text: string }[];
  advisor: string;
  social: SocialWave;
  scene: SceneState;
  pressure: { seconds: number; label: string; unitMax: number; unit: string };
  ministers: Record<string, string>;
  options: EventOption[];
  omission: EventOption;
  /** Evento criado pelo Claude durante a partida. */
  generated?: boolean;
  /** crise, oportunidade, marco, escândalo, conquista, catástrofe... */
  kind?: string;
  region?: Place;
  /** Resolve quando lições e redes das opções chegaram (eventos gerados em duas etapas). */
  ready?: Promise<void>;
}

export interface Player {
  name: string;
  avatar: number;
  bioId: string;
}

export interface GameState {
  player: Player;
  countryId: string;
  /** Meses desde a posse: 1 = janeiro de `startYear`. */
  month: number;
  totalMonths: number;
  termMonths: number;
  startYear: number;
  startAge: number;
  /** 1º ou 2º mandato. */
  term: number;
  /** Mês até o qual um novo pedido de impeachment não é aceito (a Câmara acabou de arquivar um). */
  impeachmentShieldUntil: number;
  /** Mandatos cuja eleição já aconteceu. */
  electionsHeld: number[];
  /** Conquistas ganhas nesta partida (os troféus na mesa). */
  trophies?: string[];
  /** Indicadores mês a mês, para os gráficos da Home. */
  series?: { month: number; kpis: Record<KpiId, number> }[];
  /** Últimos posts que passaram pelo feed. */
  recentPosts?: SocialPost[];
  /** Boletim do Planalto escrito pelo Claude (editorial e fala de cada ministro), por mês. */
  bulletin?: { month: number; editorial: string; ministers: Record<string, string> };
  kpis: Record<KpiId, number>;
  axes: Record<AxisId, number>;
  factions: Record<string, number>;
  relations: Record<string, number>;
  stf: 'OK' | 'LIMINAR';
  decisions: string[];
  /** Resumo do que já aconteceu, usado pelo gerador para dar continuidade. */
  history: HistoryEntry[];
}

export interface HistoryEntry {
  month: number;
  event: string;
  choice: string;
  headline: string;
  icon: string;
  stf?: string;
}

export interface Deltas {
  kpis: Partial<Record<KpiId, number>>;
  axes: Partial<Record<AxisId, number>>;
  factions: Record<string, number>;
  relations: Record<string, number>;
}

// ---------- Cenas (roteiro que o Claude escreve e o jogo encena) ----------

export type BackdropId = 'esplanada' | 'stf' | 'camara' | 'gabinete' | 'tv' | 'rua' | 'floresta' | 'mercado' | 'bolsa' | 'quartel';

/** Sprite em pixel art: cada caractere de `rows` é uma chave de `palette`; '.' é transparente. */
export interface PixelSprite {
  id: string;
  palette: Record<string, string>;
  rows: string[];
}

export type CutAction =
  | 'enter_left' | 'enter_right' | 'move' | 'jump' | 'shake' | 'slam' | 'say'
  | 'exit' | 'hide' | 'show' | 'flash' | 'screenshake' | 'rain' | 'grow';

export interface CutActor {
  id: string;
  /** Id de um sprite da biblioteca ou de `sprites` do próprio roteiro. */
  sprite: string;
  x: number;
  y: number;
  flip?: boolean;
  /** Prop na mão (ex.: 'martelo'), usado pela ação 'slam'. */
  holding?: string;
  /** 'back' fica atrás do primeiro plano do cenário (ex.: atrás da bancada do STF). */
  layer?: 'back' | 'front';
  hidden?: boolean;
  /** Repete o ator em fila, para multidões e exércitos. */
  count?: number;
  spacing?: number;
}

export interface CutStep {
  t: number;
  do: CutAction;
  actor?: string;
  x?: number;
  y?: number;
  dur?: number;
  text?: string;
  sprite?: string;
}

export interface Cutscene {
  backdrop: BackdropId | 'custom';
  /** Animação da Esplanada quando `backdrop` é 'esplanada'. */
  anim?: SceneAnim;
  /** Cenário desenhado pelo Claude: 28 linhas de 48 caracteres, cada célula vira 4x4 pixels. */
  customBackdrop?: { palette: Record<string, string>; rows: string[] };
  sprites?: PixelSprite[];
  actors: CutActor[];
  timeline: CutStep[];
  caption: string;
}

// ---------- Despachos: decisões rápidas entre os eventos grandes ----------

export interface DispatchOption {
  id: string;
  icon: string;
  label: string;
  /** Carimbo que desce na mesa: SANCIONADO, VETADO, NOMEADO... */
  stamp: string;
  effects: Effects;
  /** Uma frase da conselheira explicando a consequência (micro-lição). */
  reaction: string;
  post?: SocialPost;
  anim?: SceneAnim;
}

export interface Dispatch {
  id: string;
  icon: string;
  /** Quem traz o despacho: "Casa Civil", "Imprensa", "Congresso"... */
  from: string;
  title: string;
  text: string;
  options: DispatchOption[];
  generated?: boolean;
  region?: Place;
}

// ---------- Coletiva de imprensa ----------

export interface InterviewAnswer {
  icon: string;
  label: string;
  effects: Effects;
  /** Manchete que sai se o presidente responder assim. */
  headline: string;
}

export interface InterviewQuestion {
  journalist: string;
  outlet: string;
  question: string;
  answers: InterviewAnswer[];
}

export interface Interview {
  id: string;
  questions: InterviewQuestion[];
  generated?: boolean;
}
