import { ageOf, electionMonth, yearOf } from './calendar';
import type { Country, Cutscene, GameEvent, GameState } from './types';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Ruído determinístico por presidente e mês: a mesma partida dá sempre o mesmo resultado. */
function noise(state: GameState, salt: number, amplitude: number): number {
  let h = salt * 2654435761;
  for (const ch of state.player.name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h = Math.imul(h ^ state.month, 2246822519) >>> 0;
  return ((h % 1000) / 1000 - 0.5) * 2 * amplitude;
}

// ---------- eleição ----------

export function electionDue(state: GameState, country: Country): boolean {
  if (state.term >= country.calendar.max_terms || state.electionsHeld.includes(state.term)) return false;
  return state.month >= electionMonth(state, state.term, country.calendar.election_month);
}

/** Nota da economia de 0 a 100: emprego e preços pesam no voto. */
export function economyScore(state: GameState): number {
  return clamp(50 + (8 - state.kpis.desemprego) * 6 + (4.5 - state.kpis.inflacao) * 6, 0, 100);
}

export interface ElectionResult {
  firstRound: number;
  runoff: number | null;
  won: boolean;
}

export function electionResult(state: GameState): ElectionResult {
  const base = 0.6 * state.kpis.aprovacao + 0.25 * economyScore(state) + 0.15 * state.kpis.coalizao;
  const firstRound = Math.round(clamp(base - 5 + noise(state, 1, 3), 3, 80) * 10) / 10;
  if (firstRound >= 50) return { firstRound, runoff: null, won: true };
  if (firstRound < 25) return { firstRound, runoff: null, won: false };
  const runoff = Math.round(clamp(50 + (base - 47) * 1.3 + noise(state, 2, 3), 20, 80) * 10) / 10;
  return { firstRound, runoff, won: runoff >= 50 };
}

export function campaignEvent(state: GameState): GameEvent {
  const year = yearOf(state, state.month);
  const post = (who: string, at: string, text: string, likes: number, tone: 'angry' | 'happy' | 'neutral' | 'press') => ({ who, at, text, likes, tone });
  return {
    id: `ELEICAO_${year}`,
    country: state.countryId,
    month: state.month,
    month_name: 'Outubro',
    kind: 'marco',
    kicker: `ELEIÇÕES ${year} · RETA FINAL`,
    title: 'A campanha pela reeleição',
    dossier: [
      `Faltam três semanas para o primeiro turno. As pesquisas mostram você com ${Math.round(state.kpis.aprovacao)}% de aprovação.`,
      'O marqueteiro quer uma estratégia hoje. Cada caminho fala com um eleitor diferente.',
    ],
    echoes: [],
    advisor: 'Presidente, a Constituição permite uma única reeleição seguida. Se perder, volta para casa. Se ganhar, são mais quatro anos, e depois não tem mais.',
    scene: { anim: 'speech' },
    pressure: { seconds: 60, label: 'DIAS ATÉ O PRIMEIRO TURNO', unitMax: 21, unit: 'd' },
    ministers: {
      casacivil: 'Os prefeitos aliados valem mais que qualquer propaganda. Mas eles cobram obras antes da eleição.',
      fazenda: 'Qualquer bondade agora vira inflação no ano que vem. O mercado vai ler cada anúncio.',
      comunicacao: 'Debate na TV é arriscado. Vídeo curto nas redes é garantido. O senhor escolhe o risco.',
      justica: 'Cuidado: usar a máquina pública na campanha é crime eleitoral. O TSE está de olho.',
    },
    social: {
      trending: `#Eleicoes${year}`,
      sentiment: 0,
      posts: [
        post('Economia Hoje', 'economiahoje', `Pesquisa: presidente aparece com ${Math.round(state.kpis.aprovacao)}% de aprovação a três semanas do 1º turno.`, 6000, 'press'),
        post('Tia Cleide', 'tiacleide.zap', 'Já sei em quem vou votar. Não vou falar. Mas já sei. 🤫', 30000, 'neutral'),
        post('Pedro Memes', 'pedrao.memes', 'horário eleitoral começou e minha avó já decorou o jingle de todos os candidatos', 90000, 'happy'),
      ],
    },
    options: [
      {
        id: 'obras',
        icon: '🏗️',
        title: 'Inaugurar obras pelo país inteiro',
        summary: 'Maratona de inaugurações com prefeitos aliados. Vitrine forte, gasto alto.',
        effects: { axes: { governanca: 5 }, kpis: { aprovacao: 5, inflacao: 0.3, coalizao: 3 }, factions: { centrao: 10 } },
        scene: { anim: 'celebrate' },
        headline: 'Presidente inaugura 40 obras em 20 dias',
        subhead: 'Oposição acusa uso da máquina; TSE analisa denúncias.',
        lesson: { title: 'A máquina pública na eleição', text: 'Quem está no cargo tem vantagem: obras, agenda e visibilidade. Por isso a lei eleitoral proíbe inaugurações com candidatos nos 3 meses antes da votação e limita gastos com publicidade. A reeleição, permitida desde 1997 (EC 16), criou esse dilema: o presidente governa e faz campanha ao mesmo tempo.' },
        social: { trending: '#Inauguracao', sentiment: 10, posts: [post('Tia Cleide', 'tiacleide.zap', 'Asfaltaram minha rua! Depois de 20 anos! 🙌', 40000, 'happy'), post('Advogada Ju', 'ju.constituicao', 'Inauguração com candidato em período eleitoral é conduta vedada. Só lembrando.', 12000, 'press')] },
      },
      {
        id: 'debate',
        icon: '🎤',
        title: 'Ir a todos os debates na TV',
        summary: 'Encarar a oposição ao vivo. Pode virar o jogo, ou virar meme.',
        effects: { axes: { poder: -5 }, kpis: { aprovacao: state.kpis.aprovacao >= 45 ? 4 : 6 }, factions: { tecnologica: 4 } },
        scene: { anim: 'speech' },
        headline: 'Presidente domina debate e sobe nas pesquisas',
        subhead: 'Oponentes criticam números, mas a performance agrada eleitores indecisos.',
        lesson: { title: 'Debate é prestação de contas', text: 'Debater com adversários é um ritual democrático: o governante se submete ao contraditório em público. Candidatos com folga costumam fugir dos debates; quem precisa virar votos, vai. Você preferiu o risco da exposição.' },
        social: { trending: '#Debate', sentiment: 20, posts: [post('Pedro Memes', 'pedrao.memes', 'o presidente no debate: 🔥🔥 o adversário: 🧍', 150000, 'happy'), post('Economia Hoje', 'economiahoje', 'Checagem: 3 dos 10 números citados no debate estavam errados.', 7000, 'press')] },
      },
      {
        id: 'bondades',
        icon: '🎁',
        title: 'Aumentar benefícios sociais agora',
        summary: 'Reajuste de benefícios às vésperas da eleição. Popular, caro e polêmico.',
        effects: { axes: { economia: -8 }, kpis: { aprovacao: 7, inflacao: 0.6, selic: 0.5 }, factions: { centrao: 5, tecnologica: -3 } },
        scene: { anim: 'money_rain' },
        headline: 'Governo turbina benefícios a um mês da eleição',
        subhead: 'Economistas falam em “eleitoreiro”; beneficiários comemoram.',
        lesson: { title: 'O ciclo político-econômico', text: 'Governos tendem a gastar mais perto das eleições e cortar depois. Economistas chamam isso de ciclo político-econômico. O eleitor sente o alívio agora; a conta, em inflação e juros, chega depois da posse.' },
        social: { trending: '#Eleitoreiro', sentiment: 5, posts: [post('Tia Cleide', 'tiacleide.zap', 'Caiu o aumento! Esse presidente olha pelo povo 🙏', 70000, 'happy'), post('Faria Lima Insider', 'fl.insider', 'Bondade de véspera, ressaca garantida em janeiro.', 9000, 'angry')] },
      },
      {
        id: 'ataque',
        icon: '🗡️',
        title: 'Campanha de ataque ao adversário',
        summary: 'Dossiês, vídeos duros e muito conteúdo nas redes contra o oponente.',
        effects: { axes: { poder: 6, direitos: -4 }, kpis: { aprovacao: 2, coalizao: -3 }, factions: { seguranca: 5, tecnologica: -8 } },
        scene: { anim: 'phones_live' },
        headline: 'Guerra de dossiês domina reta final da campanha',
        subhead: 'TSE manda remover vídeos dos dois lados. Eleitores reclamam do nível.',
        lesson: { title: 'Campanha negativa funciona?', text: 'Pesquisas mostram que ataques mobilizam a própria base e desanimam o eleitor do adversário, mas também aumentam a rejeição de quem ataca. No Brasil, o TSE pode mandar remover propaganda com fatos sabidamente falsos.' },
        social: { trending: '#BaixoNivel', sentiment: -30, posts: [post('Tio Nando', 'tionando.patriota', 'Tem que mostrar quem é o outro mesmo! 🔥', 40000, 'happy'), post('Prof. Marina', 'profmarina', 'Nenhuma proposta, só ódio. Que campanha triste.', 30000, 'angry')] },
      },
    ],
    omission: {
      id: 'omissao',
      icon: '⌛',
      title: 'Campanha sem estratégia',
      summary: 'O tempo acabou sem decisão.',
      effects: { kpis: { aprovacao: -3 } },
      scene: { anim: 'calm' },
      headline: 'Campanha do presidente parece sem rumo',
      subhead: 'Aliados reclamam de falta de comando na reta final.',
      lesson: { title: 'Campanha também é governo', text: 'Uma campanha sem direção passa a imagem de um governo sem direção.' },
      social: { trending: '#CadeACampanha', sentiment: -30, posts: [post('Pedro Memes', 'pedrao.memes', 'campanha do presidente tá mais parada que fila do INSS', 60000, 'angry')] },
    },
  };
}

export function electionCutscene(state: GameState, r: ElectionResult): Cutscene {
  const final = r.runoff ?? r.firstRound;
  const steps: Cutscene['timeline'] = [
    { t: 0.3, do: 'enter_left', actor: 'reporter', dur: 0.8 },
    { t: 1.1, do: 'say', actor: 'reporter', text: `1º turno: ${r.firstRound.toFixed(1).replace('.', ',')}%`, dur: 1.6 },
  ];
  if (r.runoff !== null) steps.push({ t: 2.8, do: 'say', actor: 'reporter', text: `2º turno: ${r.runoff.toFixed(1).replace('.', ',')}%`, dur: 1.6 });
  const end = r.runoff !== null ? 4.6 : 3;
  steps.push(
    { t: end, do: 'enter_right', actor: 'presidente', dur: 0.8 },
    { t: end + 0.9, do: r.won ? 'jump' : 'shake', actor: 'presidente', dur: 0.8 },
    { t: end + 1, do: 'say', actor: 'presidente', text: r.won ? 'MAIS QUATRO ANOS!' : 'O povo decidiu...', dur: 2 },
  );
  if (r.won) steps.push({ t: end + 1, do: 'rain', sprite: 'confete', dur: 3 }, { t: end + 1.2, do: 'flash' });
  return {
    backdrop: 'tv',
    actors: [
      { id: 'reporter', sprite: 'jornalista', x: 60, y: 100, hidden: true },
      { id: 'presidente', sprite: 'presidente', x: 132, y: 100, hidden: true, flip: true },
    ],
    timeline: steps,
    caption: r.won
      ? `TSE: ${state.player.name} é reeleito com ${final.toFixed(1).replace('.', ',')}% dos votos válidos`
      : `TSE: ${state.player.name} é derrotado com ${final.toFixed(1).replace('.', ',')}% dos votos válidos`,
  };
}

// ---------- impeachment ----------

export function impeachmentDue(state: GameState): boolean {
  return state.month >= state.impeachmentShieldUntil && state.kpis.aprovacao <= 28 && state.kpis.coalizao <= 35;
}

export interface ImpeachmentVote {
  yes: number;
  no: number;
  needed: number;
  passed: boolean;
}

/** Votos pelo afastamento na Câmara: a coalizão pesa mais que a rua. */
export function impeachmentVote(state: GameState, country: Country): ImpeachmentVote {
  const { seats, impeachment_votes: needed } = country.chamber;
  const support = 0.65 * state.kpis.coalizao + 0.35 * state.kpis.aprovacao;
  const yes = Math.round(clamp(seats * clamp(1.05 - support / 55, 0.05, 0.97) + noise(state, 3, 15), 0, seats - 5));
  const no = seats - yes - Math.round(clamp(8 + noise(state, 4, 6), 2, 20));
  return { yes, no, needed, passed: yes >= needed };
}

export function impeachmentEvent(state: GameState): GameEvent {
  const post = (who: string, at: string, text: string, likes: number, tone: 'angry' | 'happy' | 'neutral' | 'press') => ({ who, at, text, likes, tone });
  return {
    id: `IMPEACHMENT_${state.month}`,
    country: state.countryId,
    month: state.month,
    month_name: '',
    kind: 'crise',
    kicker: 'CRISE TERMINAL · CÂMARA DOS DEPUTADOS',
    title: 'Pedido de impeachment aceito',
    dossier: [
      `Com ${Math.round(state.kpis.aprovacao)}% de aprovação e a base desfeita, o presidente da Câmara aceitou um pedido de impeachment por crime de responsabilidade.`,
      'A votação no plenário é em poucos dias. São necessários 342 dos 513 deputados para o processo seguir ao Senado, que decide o afastamento.',
    ],
    echoes: [],
    advisor: 'Presidente, isso é político, não só jurídico. Quem decide são os votos, e a hora de buscá-los é agora.',
    scene: { anim: 'protest' },
    pressure: { seconds: 55, label: 'DIAS ATÉ A VOTAÇÃO NO PLENÁRIO', unitMax: 10, unit: 'd' },
    ministers: {
      casacivil: 'O Centrão vende caro, mas vende. Cargos e emendas agora podem salvar o mandato.',
      justica: 'O rito é o da Lei 1.079/1950 e dos artigos 85 e 86 da Constituição. A Câmara autoriza, o Senado julga.',
      comunicacao: 'Uma fala em rede nacional pode reverter o humor da rua, se o senhor tiver algo a dizer.',
      defesa: 'As Forças Armadas vão respeitar a Constituição, presidente. Não conte com a gente para outra coisa.',
    },
    social: {
      trending: '#Impeachment',
      sentiment: -60,
      posts: [
        post('Economia Hoje', 'economiahoje', 'Presidente da Câmara aceita pedido de impeachment. Votação deve ocorrer em 10 dias.', 20000, 'press'),
        post('Tio Nando', 'tionando.patriota', 'É GOLPE!!! O povo votou!!!', 50000, 'angry'),
        post('Advogada Ju', 'ju.constituicao', 'Impeachment não é golpe: está na Constituição. Mas precisa de crime de responsabilidade.', 30000, 'press'),
      ],
    },
    options: [
      {
        id: 'centrao',
        icon: '💼',
        title: 'Entregar ministérios ao Centrão',
        summary: 'Cargos, emendas e ministérios em troca de votos contra o impeachment.',
        effects: { axes: { governanca: -5 }, kpis: { coalizao: 12, aprovacao: -3 }, factions: { centrao: 25 } },
        scene: { anim: 'money_rain' },
        headline: 'Governo loteia ministérios na véspera da votação',
        subhead: 'Centrão promete votos; oposição fala em “balcão de negócios”.',
        lesson: { title: 'O preço da sobrevivência', text: 'No presidencialismo de coalizão, quem perde a base perde o mandato. Os impeachments de 1992 e 2016 mostraram que a votação é, antes de tudo, política: conta quantos votos o governo consegue segurar, e o Centrão costuma ser o fiel da balança.' },
        social: { trending: '#Balcao', sentiment: -40, posts: [post('Prof. Marina', 'profmarina', 'Compraram o mandato. Simples assim.', 40000, 'angry')] },
      },
      {
        id: 'tv',
        icon: '📺',
        title: 'Pronunciamento em rede nacional',
        summary: 'Falar direto com o povo, admitir erros e pedir uma segunda chance.',
        effects: { axes: { poder: -5 }, kpis: { aprovacao: 7 }, factions: { tecnologica: 4 } },
        scene: { anim: 'speech' },
        headline: 'Em rede nacional, presidente admite erros e pede chance',
        subhead: 'Panelaço em algumas capitais; aplausos em outras.',
        lesson: { title: 'Opinião pública e impeachment', text: 'Deputados votam olhando para as ruas e para a própria reeleição. Reverter a opinião pública muda o cálculo de muitos, mas raramente em poucos dias.' },
        social: { trending: '#Pronunciamento', sentiment: -10, posts: [post('Tia Cleide', 'tiacleide.zap', 'Achei sincero. Todo mundo erra.', 20000, 'happy')] },
      },
      {
        id: 'ruas',
        icon: '📣',
        title: 'Convocar apoiadores para as ruas',
        summary: 'Atos em todo o país para pressionar os deputados.',
        effects: { axes: { poder: 12 }, kpis: { aprovacao: 4, coalizao: -5 }, factions: { seguranca: 8, centrao: -8 } },
        scene: { anim: 'protest' },
        headline: 'Atos a favor e contra o presidente dividem o país',
        subhead: 'Deputados relatam pressão e ameaças nas redes.',
        lesson: { title: 'A rua contra o plenário', text: 'Mobilizar a base mostra força, mas pode irritar os deputados que você precisa convencer. Emparedar o Congresso costuma unir o Congresso contra você.' },
        social: { trending: '#FicaPresidente', sentiment: -20, posts: [post('Tio Nando', 'tionando.patriota', 'TODO MUNDO NA RUA DOMINGO!!! 🇧🇷', 90000, 'happy')] },
      },
      {
        id: 'renunciar',
        icon: '🚪',
        title: 'Renunciar antes da votação',
        summary: 'Sair antes de ser tirado. O vice assume e você preserva os direitos políticos.',
        effects: {},
        scene: { anim: 'calm' },
        headline: 'Presidente renuncia antes da votação do impeachment',
        subhead: 'Vice assume o Planalto. Mercado sobe.',
        lesson: { title: 'A renúncia como saída', text: 'Renunciar evita a condenação e a perda de direitos políticos por 8 anos, que é a pena do impeachment. Em 1992, Collor renunciou horas antes do julgamento no Senado, mas o processo seguiu mesmo assim.' },
        social: { trending: '#Renuncia', sentiment: 0, posts: [post('Economia Hoje', 'economiahoje', 'Presidente renuncia; vice toma posse ainda hoje.', 40000, 'press')] },
      },
    ],
    omission: {
      id: 'omissao',
      icon: '⌛',
      title: 'O presidente esperou',
      summary: 'Sem reação.',
      effects: { kpis: { coalizao: -4 } },
      scene: { anim: 'vote_yes' },
      headline: 'Sem reação do Planalto, base debanda',
      subhead: 'Deputados indecisos passam para o lado do impeachment.',
      lesson: { title: 'Silêncio é voto contra', text: 'Num processo de impeachment, a omissão do governo é lida como fraqueza, e deputados indecisos correm para o lado vencedor.' },
      social: { trending: '#Impeachment', sentiment: -70, posts: [] },
    },
  };
}

export function impeachmentCutscene(v: ImpeachmentVote): Cutscene {
  return {
    backdrop: 'camara',
    actors: [
      { id: 'sim', sprite: 'deputado', x: 14, y: 106, count: 5, spacing: 16 },
      { id: 'nao', sprite: 'deputada', x: 114, y: 106, count: 5, spacing: 16 },
      { id: 'mesa', sprite: 'deputado', x: 96, y: 92, holding: 'martelo' },
    ],
    timeline: [
      { t: 0.4, do: 'jump', actor: 'sim' },
      { t: 0.5, do: 'say', actor: 'sim', text: 'SIM!', dur: 1 },
      { t: 1.2, do: 'jump', actor: 'nao' },
      { t: 1.3, do: 'say', actor: 'nao', text: 'NÃO!', dur: 1 },
      { t: 2.2, do: 'say', actor: 'mesa', text: `SIM ${v.yes} × NÃO ${v.no}`, dur: 2.2 },
      { t: 4, do: 'slam', actor: 'mesa' },
      { t: 4.2, do: v.passed ? 'jump' : 'shake', actor: 'sim', dur: 1 },
      { t: 4.2, do: v.passed ? 'shake' : 'jump', actor: 'nao', dur: 1 },
      { t: 4.4, do: 'say', actor: 'mesa', text: v.passed ? 'AUTORIZADO!' : 'ARQUIVADO!', dur: 2 },
    ],
    caption: v.passed
      ? `Câmara autoriza o impeachment: ${v.yes} votos (eram necessários ${v.needed}). O Senado afasta o presidente.`
      : `Impeachment barrado: ${v.yes} votos a favor, faltaram ${v.needed - v.yes}. O presidente sobrevive.`,
  };
}

export function presidentAge(state: GameState): number {
  return ageOf(state, state.month);
}
