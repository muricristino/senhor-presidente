import { spawn, spawnSync } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { BACKDROPS, CUSTOM_BACKDROP, CUT_ACTIONS, LIB_SPRITES, MAX_SPRITE, SCENE_ANIMS } from '../src/engine/catalog';

/*
 * Diretor de jogo via Claude CLI (`claude -p`), só no servidor de desenvolvimento.
 * POST /api/event     → próxima crise, escrita a partir do estado do país e do histórico
 * POST /api/cutscene  → roteiro da cinemática de uma opção (desenha sprites se precisar)
 * GET  /api/health    → se o CLI está disponível
 */

const MODEL = process.env.SP_MODEL ?? 'sonnet';
const TIMEOUT_MS = Number(process.env.SP_TIMEOUT_MS ?? 240_000);
const EFFORT = process.env.SP_EFFORT ?? 'low';

const num = { type: 'number' };
const str = { type: 'string' };
const effectsSchema = (axes: string[], factions: string[]) => ({
  type: 'object',
  properties: {
    axes: { type: 'object', properties: Object.fromEntries(axes.map((a) => [a, num])), additionalProperties: false },
    kpis: {
      type: 'object',
      properties: Object.fromEntries(['aprovacao', 'coalizao', 'selic', 'inflacao', 'desemprego', 'seguranca', 'educacao'].map((k) => [k, num])),
      additionalProperties: false,
    },
    factions: { type: 'object', properties: Object.fromEntries(factions.map((f) => [f, num])), additionalProperties: false },
  },
  required: ['axes', 'kpis', 'factions'],
});
const postSchema = {
  type: 'object',
  properties: { who: str, at: str, text: str, likes: num, tone: { enum: ['angry', 'happy', 'neutral', 'press', 'bot', 'faction'] } },
  required: ['who', 'at', 'text', 'likes', 'tone'],
};
const waveSchema = {
  type: 'object',
  properties: { trending: str, sentiment: num, posts: { type: 'array', items: postSchema } },
  required: ['trending', 'sentiment', 'posts'],
};

function eventSchema(axes: string[], factions: string[], ministers: string[]) {
  const option = {
    type: 'object',
    properties: {
      icon: { type: 'string', description: 'um emoji' },
      title: { type: 'string', description: 'ação curta, até 48 caracteres' },
      summary: str,
      effects: effectsSchema(axes, factions),
      scene: { type: 'object', properties: { anim: { enum: Object.keys(SCENE_ANIMS) } }, required: ['anim'] },
      cutscene_idea: { type: 'string', description: 'uma frase descrevendo a cena animada ideal para esta decisão' },
      headline: str,
      subhead: str,
      stf: {
        type: 'object',
        description: 'só se a decisão for inconstitucional',
        properties: { title: str, text: str, effects: effectsSchema(axes, factions) },
        required: ['title', 'text'],
      },
    },
    required: ['icon', 'title', 'summary', 'effects', 'scene', 'cutscene_idea', 'headline', 'subhead'],
  };
  return {
    type: 'object',
    properties: {
      kind: { enum: ['crise', 'oportunidade', 'marco', 'escandalo', 'conquista', 'catastrofe', 'internacional'] },
      kicker: str,
      title: str,
      callback: { type: 'string', description: 'uma frase que liga esta crise a uma decisão anterior do jogador' },
      dossier: { type: 'array', items: str, minItems: 2, maxItems: 2 },
      advisor: str,
      scene: { type: 'object', properties: { anim: { enum: Object.keys(SCENE_ANIMS) } }, required: ['anim'] },
      pressure: { type: 'object', properties: { seconds: num, label: str, unitMax: num, unit: str }, required: ['seconds', 'label', 'unitMax', 'unit'] },
      ministers: { type: 'object', properties: Object.fromEntries(ministers.map((m) => [m, str])), additionalProperties: false },
      social: waveSchema,
      options: { type: 'array', items: option, minItems: 4, maxItems: 4 },
      omission: option,
    },
    required: ['kind', 'kicker', 'title', 'callback', 'dossier', 'advisor', 'scene', 'pressure', 'ministers', 'social', 'options', 'omission'],
  };
}

const detail = {
  type: 'object',
  properties: { lesson: { type: 'object', properties: { title: str, text: str }, required: ['title', 'text'] }, social: waveSchema },
  required: ['lesson', 'social'],
};
const detailsSchema = {
  type: 'object',
  properties: { options: { type: 'array', items: detail, minItems: 4, maxItems: 4 }, omission: detail },
  required: ['options', 'omission'],
};

const dispatchesSchema = (axes: string[], factions: string[]) => ({
  type: 'object',
  properties: {
    dispatches: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      items: {
        type: 'object',
        properties: {
          icon: { type: 'string', description: 'um emoji' },
          from: str,
          title: str,
          text: str,
          options: {
            type: 'array',
            minItems: 2,
            maxItems: 3,
            items: {
              type: 'object',
              properties: { icon: str, label: str, stamp: str, effects: effectsSchema(axes, factions), reaction: str, post: postSchema, anim: { enum: Object.keys(SCENE_ANIMS) } },
              required: ['icon', 'label', 'stamp', 'effects', 'reaction', 'anim'],
            },
          },
        },
        required: ['icon', 'from', 'title', 'text', 'options'],
      },
    },
  },
  required: ['dispatches'],
});

const spriteSchema = {
  type: 'object',
  properties: { id: str, palette: { type: 'object', additionalProperties: str }, rows: { type: 'array', items: str } },
  required: ['id', 'palette', 'rows'],
};
const cutsceneSchema = {
  type: 'object',
  properties: {
    backdrop: { enum: [...Object.keys(BACKDROPS), 'custom'] },
    anim: { enum: Object.keys(SCENE_ANIMS) },
    customBackdrop: { type: 'object', properties: { palette: { type: 'object', additionalProperties: str }, rows: { type: 'array', items: str } }, required: ['palette', 'rows'] },
    sprites: { type: 'array', items: spriteSchema },
    actors: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: str, sprite: str, x: num, y: num, flip: { type: 'boolean' }, holding: str, layer: { enum: ['back', 'front'] }, hidden: { type: 'boolean' }, count: num, spacing: num },
        required: ['id', 'sprite', 'x', 'y'],
      },
    },
    timeline: {
      type: 'array',
      items: {
        type: 'object',
        properties: { t: num, do: { enum: Object.keys(CUT_ACTIONS) }, actor: str, x: num, y: num, dur: num, text: str, sprite: str },
        required: ['t', 'do'],
      },
    },
    caption: str,
  },
  required: ['backdrop', 'actors', 'timeline', 'caption'],
};

const list = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `- ${k}: ${v}`).join('\n');

const SOCIAL_RULE = `Redes: 3 posts curtos por onda, com humor brasileiro de internet. Personagens recorrentes: Tia Cleide (@tiacleide.zap), Pedro Memes (@pedrao.memes), Prof. Marina (@profmarina), Tio Nando (@tionando.patriota), Faria Lima Insider (@fl.insider), Economia Hoje (@economiahoje), Advogada Ju (@ju.constituicao). Pode criar outros.`;

const DETAILS_SYSTEM = `Você é roteirista de "Senhor Presidente", simulador político no Brasil real (instituições reais, pessoas fictícias).
Recebe uma crise já escrita com 4 opções e a omissão. Para cada uma, na mesma ordem, escreva:
- lesson: título e texto curto (até 480 caracteres) e educativo, explicando o conceito político por trás da escolha, o eixo ideológico envolvido e o custo. Cite artigos da Constituição ou fatos históricos só se tiver certeza.
- social: a reação das redes depois da decisão (trending, sentimento de -100 a 100, 3 posts).
${SOCIAL_RULE}
Português do Brasil, com acentos.`;

const EVENT_SYSTEM = `Você é o roteirista-chefe de "Senhor Presidente", um simulador político em pixel art ambientado no Brasil real (STF, Congresso, Constituição de 1988, bancadas temáticas, presidencialismo de coalizão).
Sua tarefa: escrever o PRÓXIMO GRANDE ACONTECIMENTO do mandato, em português do Brasil com acentuação correta.
Não é sempre crise. Varie o "kind": crise, oportunidade (descoberta de petróleo, Copa do Mundo no Brasil, investimento bilionário), marco (reforma histórica, eleições, cúpula internacional), escândalo (grampo vazado, ministro envolvido), conquista (acordo de paz, descoberta científica), catástrofe (enchente, pandemia), internacional (guerra, sanções, visita de chefe de Estado). Olhe o histórico e evite repetir o tipo recente. Até boas notícias precisam de decisões difíceis.

Regras de continuidade (as mais importantes):
- A crise precisa nascer do estado atual do país e das decisões anteriores do jogador. Escolha o fio mais forte: um indicador em nível crítico, uma bancada furiosa, uma liminar do STF, um eixo ideológico levado ao extremo, a consequência tardia de uma decisão.
- Se o jogador vem radicalizando (ex.: muito autocrático, militarista), a história deve escalar de verdade: autogolpe, suspensão de eleições, milícias, sanções internacionais, exércitos de robôs, o que for coerente. Não amacie.
- "callback" liga explicitamente esta crise a uma decisão passada.
- Não repita crises do histórico.

Regras de conteúdo:
- Instituições reais, pessoas fictícias. Nunca cite políticos, juízes ou partidos reais por nome.
- Equilíbrio: as 4 opções devem puxar para lados diferentes dos eixos; nenhuma é "a certa". Toda opção tem custo.
- Efeitos: eixos entre -30 e 30; aprovacao e coalizao entre -12 e 12; selic ±1.5; inflacao ±1.2; desemprego ±0.8; seguranca ±1; educacao ±0.6; bancadas ±25. Seja coerente com o conteúdo.
- "stf" só quando a opção for claramente inconstitucional (cláusulas pétreas, direitos fundamentais, separação de Poderes). Cite artigos da Constituição só se tiver certeza.
- O "omission" é o que acontece se o presidente não decidir a tempo: sem eixos, custo alto.
- ${SOCIAL_RULE}
- Seja conciso: título até 50 caracteres, dossiê com 2 frases curtas (até 150 caracteres cada), advisor até 160 caracteres, callback até 150, títulos das opções até 45, resumos até 140.
- pressure.unit deve ser um destes: h, d, min, %, sem.
- scene.anim: escolha a animação mais próxima da lista. cutscene_idea: descreva a cena ideal livremente, mesmo que exija desenhos novos.

Animações disponíveis:
${list(SCENE_ANIMS)}`;

const DISPATCH_SYSTEM = `Você escreve DESPACHOS para "Senhor Presidente", simulador político no Brasil real (instituições reais, pessoas fictícias).
Despachos são decisões rápidas do dia a dia do presidente, lidas e decididas em 15 segundos: sancionar ou vetar uma lei, nomear alguém, responder um repórter, reagir a um post viral, liberar emendas, aceitar um convite, atender um governador, posicionar o Itamaraty.
Regras:
- 2 ou 3 opções, rótulos curtíssimos (até 30 caracteres). Texto do despacho com até 180 caracteres.
- Efeitos pequenos: eixos até ±12, aprovacao/coalizao até ±6, selic ±0.5, inflacao ±0.4, desemprego ±0.3, seguranca ±0.4, educacao ±0.3, bancadas até ±15.
- "reaction" é uma micro-lição de 1-2 frases: consequência da escolha + o conceito político por trás (veto, federalismo, protecionismo, Efeito Streisand...).
- "stamp": carimbo em caixa alta (SANCIONADO, VETADO, NOMEADO, POSTADO, NEGADO...).
- "post" opcional: reação de um perfil das redes. ${SOCIAL_RULE}
- Varie os temas e conecte ao momento do país e às decisões recentes: consequências pequenas do que o jogador fez, pedidos de bancadas irritadas, oportunidades. Não repita o histórico.
- "anim": a animação da Janela do Planalto que combina.
Português do Brasil, com acentos.`;

const CUTSCENE_SYSTEM = `Você é o diretor de cena de "Senhor Presidente", um jogo em pixel art. Escreva o roteiro de uma cinemática curta (4 a 7 segundos) para a decisão descrita.
A tela tem 192x112 pixels. O y de um ator é a posição dos PÉS; pessoas têm 22px de altura, então o chão fica por volta de y=96..108. x é o centro do ator.

Primeiro use a biblioteca. Cenários:
${list(BACKDROPS)}

Sprites prontos:
${list(LIB_SPRITES)}

Ações da linha do tempo (t em segundos):
${list(CUT_ACTIONS)}

Quando a cena pedir algo que NÃO existe na biblioteca (ex.: robôs, um ditador num trono, uma nave, um dinossauro, um palácio em ruínas), DESENHE:
- sprites: grade de caracteres de até ${MAX_SPRITE}x${MAX_SPRITE}; cada caractere é uma chave da palette (cor hex #rrggbb); "." é transparente. Pessoas ~12x22, veículos ~28x12. Desenhe com contorno escuro e 3-5 cores; sombreie.
- customBackdrop (use backdrop "custom"): exatamente ${CUSTOM_BACKDROP.rows} linhas de ${CUSTOM_BACKDROP.cols} caracteres, cada célula vira ${CUSTOM_BACKDROP.cell}x${CUSTOM_BACKDROP.cell} pixels. Céu no topo, chão a partir da linha ~20.
Use count/spacing para multidões e exércitos. Use "say" com falas curtas e engraçadas. Faça a cena ter começo, clímax e fim.
Legenda (caption): uma frase de telejornal. Português do Brasil.`;

/** Extrai o primeiro objeto JSON de uma resposta (tolera cercas de markdown e texto em volta). */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('resposta sem JSON');
  const body = text.slice(start, end + 1);
  try {
    return JSON.parse(body);
  } catch {
    // Consertos comuns: vírgula sobrando antes de } ou ] e quebras de linha cruas dentro de strings.
    return JSON.parse(body.replace(/,\s*([}\]])/g, '$1').replace(/[\u0000-\u001f]+/g, ' '));
  }
}

/*
 * Pedimos JSON puro em vez de usar --json-schema: com a ferramenta de saída estruturada o modelo
 * gasta 3 turnos e repete o objeto, ~4x mais tokens. O schema vai no prompt e o sanitizador valida.
 */
/** Uma nova tentativa quando a resposta não vira JSON válido. */
async function runClaude(system: string, prompt: string, schema: object): Promise<unknown> {
  try {
    return await runClaudeOnce(system, prompt, schema);
  } catch (e) {
    if ((e as Error).message === 'timeout') throw e;
    console.warn('[claude] tentando de novo:', (e as Error).message.slice(0, 120));
    return runClaudeOnce(system, prompt, schema);
  }
}

function runClaudeOnce(system: string, prompt: string, schema: object): Promise<unknown> {
  const fullSystem = `${system}

FORMATO DA RESPOSTA: responda APENAS com um único objeto JSON válido, sem markdown e sem texto antes ou depois, seguindo este JSON Schema:
${JSON.stringify(schema)}`;
  return new Promise((resolve, reject) => {
    const args = [
      '-p', '--output-format', 'json', '--model', MODEL, '--effort', EFFORT, '--tools', '', '--strict-mcp-config',
      '--no-session-persistence', '--setting-sources', '', '--system-prompt', fullSystem,
    ];
    const child = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('timeout'));
    }, TIMEOUT_MS);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        const parsed = JSON.parse(out);
        if (parsed.is_error || typeof parsed.result !== 'string') return reject(new Error(parsed.result ?? `exit ${code}: ${err.slice(0, 300)}`));
        const u = parsed.usage ?? {};
        console.log(`[claude] ${MODEL}/${EFFORT}: ${u.output_tokens} tokens de saída, api ${(parsed.duration_api_ms / 1000).toFixed(1)}s, US$ ${parsed.total_cost_usd?.toFixed(3)}`);
        resolve(extractJson(parsed.result));
      } catch (e) {
        reject(new Error(`saída inválida (exit ${code}): ${(e as Error).message} ${err.slice(0, 200)}`));
      }
    });
    child.stdin.end(prompt);
  });
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function send(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

let available: boolean | null = null;
function claudeAvailable(): boolean {
  if (available === null) {
    const r = spawnSync('claude', ['--version'], { encoding: 'utf8' });
    available = r.status === 0 && process.env.SP_DISABLE_CLAUDE !== '1';
  }
  return available;
}

export function claudeDirector(): Plugin {
  return {
    name: 'senhor-presidente-claude-director',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        const started = Date.now();
        try {
          if (req.url === '/api/health') return send(res, 200, { claude: claudeAvailable(), model: MODEL });
          if (!claudeAvailable()) return send(res, 503, { error: 'claude indisponível' });
          const body = await readBody(req);
          if (req.url === '/api/event' && req.method === 'POST') {
            const { briefing, axes, factions, ministers } = body;
            const event = await runClaude(EVENT_SYSTEM, briefing, eventSchema(axes, factions, ministers));
            console.log(`[claude] evento gerado em ${((Date.now() - started) / 1000).toFixed(1)}s`);
            return send(res, 200, { event });
          }
          if (req.url === '/api/dispatches' && req.method === 'POST') {
            const out = await runClaude(DISPATCH_SYSTEM, body.briefing, dispatchesSchema(body.axes, body.factions));
            console.log(`[claude] despachos gerados em ${((Date.now() - started) / 1000).toFixed(1)}s`);
            return send(res, 200, out);
          }
          if (req.url === '/api/event-details' && req.method === 'POST') {
            const details = await runClaude(DETAILS_SYSTEM, body.briefing, detailsSchema);
            console.log(`[claude] detalhes gerados em ${((Date.now() - started) / 1000).toFixed(1)}s`);
            return send(res, 200, { details });
          }
          if (req.url === '/api/cutscene' && req.method === 'POST') {
            const cutscene = await runClaude(CUTSCENE_SYSTEM, body.briefing, cutsceneSchema);
            console.log(`[claude] cena gerada em ${((Date.now() - started) / 1000).toFixed(1)}s`);
            return send(res, 200, { cutscene });
          }
          return send(res, 404, { error: 'rota desconhecida' });
        } catch (e) {
          console.warn(`[claude] falhou em ${((Date.now() - started) / 1000).toFixed(1)}s:`, (e as Error).message);
          return send(res, 502, { error: (e as Error).message });
        }
      });
    },
  };
}
