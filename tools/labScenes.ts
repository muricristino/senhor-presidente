/*
 * Roteiros das cenas interativas do laboratório, escritos pelo Claude a partir do mandato.
 * Cada tipo tem um prompt e um JSON Schema; o cliente valida antes de encenar.
 */

const str = { type: 'string' };
const num = { type: 'number' };
const KPIS = ['aprovacao', 'coalizao', 'inflacao', 'desemprego'];
const kpiEffects = { type: 'object', properties: Object.fromEntries(KPIS.map((k) => [k, num])), additionalProperties: false };

const COMMON = `Você escreve cenas interativas de "Senhor Presidente", simulador político no Brasil real (instituições reais, pessoas fictícias; nunca cite políticos, juízes ou partidos reais).
A cena é jogada dentro de uma animação: falas curtas (até 110 caracteres), escolhas curtas (até 45 caracteres), tom de Brasília com humor e tensão.
Conecte a cena ao estado do país e às decisões anteriores do jogador descritas no briefing. Toda escolha tem custo; nenhuma é "a certa".
Cada escolha deve ensinar algo real sobre política (presidencialismo de coalizão, federalismo, diplomacia, Constituição, como regimes nascem e caem).
O briefing diz o regime em vigor: escreva na lógica dele (numa ditadura não há imprensa livre nem oposição legal; num parlamentarismo o chefe de governo é o primeiro-ministro).
Português do Brasil, com acentos.`;
const RUPTURE_ACTORS = ['generais', 'congresso', 'stf', 'governadores', 'exterior', 'rua', 'clero', 'mercado', 'movimentos'];

export const LAB_KINDS: Record<string, { system: string; schema: object }> = {
  votacao: {
    system: `${COMMON}
Cena: ARTICULAÇÃO DA VOTAÇÃO. O governo precisa aprovar um projeto na Câmara. O presidente tem um estoque de capital político e vai de grupo em grupo no plenário negociando votos.
- bill: título e descrição do projeto. Se o briefing traz um projeto do governo em tramitação, a votação é sobre ELE (mesmo título; needed = 308 se for PEC, senão 257). Senão, crie um coerente com o momento.
- capital: entre 8 e 12 pontos.
- groups: 6 grupos (bancadas temáticas, Centrão, oposição, independentes...), somando cerca de 513 deputados. stance inicial realista para o projeto. Cada grupo tem um líder fictício, que é deputado ou deputada federal (nunca senador), a exigência dele numa frase, e 2 ou 3 ofertas possíveis com custo (1 a 5 pontos), fração de votos que vira a favor (0 a 1), efeito colateral nos indicadores e a reação do líder.
- Pelo menos um grupo deve ser caro e um deve exigir algo polêmico (cargo, emenda, pauta de costumes).`,
    schema: {
      type: 'object',
      properties: {
        bill: { type: 'object', properties: { title: str, description: str, needed: num }, required: ['title', 'description', 'needed'] },
        capital: num,
        groups: {
          type: 'array',
          minItems: 6,
          maxItems: 6,
          items: {
            type: 'object',
            properties: {
              name: str,
              faction: { enum: ['centrao', 'ruralistas', 'religiosos', 'seguranca', 'tecnologica', 'oposicao'], description: 'bancada do jogo a que o grupo corresponde' },
              seats: num,
              stance: { enum: ['a_favor', 'indeciso', 'contra'] },
              leader: str,
              demand: str,
              offers: {
                type: 'array',
                minItems: 2,
                maxItems: 3,
                items: { type: 'object', properties: { label: str, cost: num, swing: num, effects: kpiEffects, reaction: str }, required: ['label', 'cost', 'swing', 'effects', 'reaction'] },
              },
            },
            required: ['name', 'faction', 'seats', 'stance', 'leader', 'demand', 'offers'],
          },
        },
      },
      required: ['bill', 'capital', 'groups'],
    },
  },
  debate: {
    system: `${COMMON}
Cena: DEBATE NA TV contra o principal candidato de oposição (fictício), às vésperas da eleição. No parlamentarismo ou na monarquia, é o debate entre o primeiro-ministro e o líder da oposição antes da eleição do Parlamento.
- opponent: nome e estilo. moderator: nome.
- rounds: 3 rodadas. Em cada uma, um tema e o ATAQUE do adversário, que usa decisões reais do histórico do jogador. O jogador escolhe entre 3 réplicas de estilos diferentes (dados, emoção, contra-ataque, evasiva).
- Cada réplica tem o efeito na plateia por segmento (progressistas, indecisos, conservadores, de -10 a +10) e uma checagem de fatos: veredito (verdadeiro, exagerado, falso) e uma nota curta explicando.
- closing: a frase final do adversário.`,
    schema: {
      type: 'object',
      properties: {
        opponent: { type: 'object', properties: { name: str, style: str }, required: ['name', 'style'] },
        moderator: str,
        rounds: {
          type: 'array',
          minItems: 3,
          maxItems: 3,
          items: {
            type: 'object',
            properties: {
              topic: str,
              attack: str,
              options: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: {
                  type: 'object',
                  properties: {
                    label: str,
                    style: str,
                    reply: str,
                    audience: { type: 'object', properties: { progressistas: num, indecisos: num, conservadores: num }, required: ['progressistas', 'indecisos', 'conservadores'] },
                    factcheck: { type: 'object', properties: { verdict: { enum: ['verdadeiro', 'exagerado', 'falso'] }, note: str }, required: ['verdict', 'note'] },
                  },
                  required: ['label', 'style', 'reply', 'audience', 'factcheck'],
                },
              },
            },
            required: ['topic', 'attack', 'options'],
          },
        },
        closing: str,
      },
      required: ['opponent', 'moderator', 'rounds', 'closing'],
    },
  },
  telefonema: {
    system: `${COMMON}
Cena: TELEFONEMA COM UM CHEFE DE ESTADO. Escolha o parceiro cuja relação com o Brasil está mais tensa ou mais estratégica agora (eua, china, ue, mercosul, russia).
- partner: id do parceiro; leader: nome e cargo fictícios; context: por que ligaram.
- theirAsk: o que o outro lado quer; ourAsk: o que o Brasil quer.
- rounds: 3 rodadas; em cada uma o líder fala e o presidente escolhe entre 3 respostas (ceder, trocar, endurecer...). Cada resposta: mudança na relação (-20 a +20), efeitos nos indicadores, pontos de acordo ganhos (0 a 3) e a reação do líder.
- Acordo sai se somar 5 pontos ou mais.`,
    schema: {
      type: 'object',
      properties: {
        partner: { enum: ['eua', 'china', 'ue', 'mercosul', 'russia'] },
        leader: { type: 'object', properties: { name: str, title: str }, required: ['name', 'title'] },
        context: str,
        theirAsk: str,
        ourAsk: str,
        rounds: {
          type: 'array',
          minItems: 3,
          maxItems: 3,
          items: {
            type: 'object',
            properties: {
              line: str,
              options: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: { type: 'object', properties: { label: str, relation: num, effects: kpiEffects, points: num, reaction: str }, required: ['label', 'relation', 'effects', 'points', 'reaction'] },
              },
            },
            required: ['line', 'options'],
          },
        },
      },
      required: ['partner', 'leader', 'context', 'theirAsk', 'ourAsk', 'rounds'],
    },
  },
  reuniao: {
    system: `${COMMON}
Cena: REUNIÃO MINISTERIAL. Uma pauta coerente com o momento do governo coloca dois ministros em choque na frente do presidente.
Ministros: fazenda (Helena Queiroz), justica (Otávio Brandão), casacivil (Rui Paranhos), defesa (Gen. Augusto Vilela), agricultura (Tereza Lins), comunicacao (Caio Nunes).
- agenda: a pauta. clash: os dois ministros em conflito e o que cada um defende.
- rounds: 3 rodadas. Em cada uma, um ministro fala (pode interromper outro) e o presidente escolhe entre 3 respostas. Cada resposta: variação de lealdade de cada ministro afetado (-30 a +30), efeitos nos indicadores e a reação de quem falou.
- Se a lealdade de um ministro cair muito, ele pede demissão em cena: escreva "resignation" com a frase de saída de cada ministro do conflito.`,
    schema: {
      type: 'object',
      properties: {
        agenda: str,
        clash: { type: 'object', properties: { a: str, aWants: str, b: str, bWants: str }, required: ['a', 'aWants', 'b', 'bWants'] },
        rounds: {
          type: 'array',
          minItems: 3,
          maxItems: 3,
          items: {
            type: 'object',
            properties: {
              speaker: str,
              line: str,
              interrupt: { type: 'object', properties: { speaker: str, line: str }, required: ['speaker', 'line'] },
              options: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: {
                  type: 'object',
                  properties: {
                    label: str,
                    loyalty: { type: 'object', additionalProperties: num },
                    effects: kpiEffects,
                    reaction: str,
                  },
                  required: ['label', 'loyalty', 'effects', 'reaction'],
                },
              },
            },
            required: ['speaker', 'line', 'options'],
          },
        },
        resignation: { type: 'object', additionalProperties: str },
      },
      required: ['agenda', 'clash', 'rounds', 'resignation'],
    },
  },
  ruptura: {
    system: `${COMMON}
Cena: A NOITE DA RUPTURA. O governante tenta mudar o regime numa única noite, por golpe ou revolução (o briefing diz qual, o regime de destino e quem são os atores, com a posição inicial de cada um de -100 a +100).
Isto é um simulador educativo: mostre o que acontece de verdade numa noite dessas (telefonemas, tanques, notas oficiais, juízes, embaixadas, multidões), sem glamourizar. Todo apoio tem preço.
- codename: nome da operação. conspirator: quem trouxe o plano (nome e cargo fictícios). intro: a fala dele abrindo a noite (até 110 caracteres).
- actors: exatamente os atores listados no briefing, na mesma ordem. Para cada um: name e title fictícios, opening (o que ele diz ao atender, coerente com a posição inicial) e 3 offers: label (o que o governante oferece, ameaça ou promete), hours (1 a 3, quanto da noite consome), swing (-40 a +40, quanto muda a posição do ator), effects nos indicadores (aprovacao, coalizao, inflacao, desemprego) e reaction.
- Pelo menos uma oferta por ator é arriscada (swing pode ser negativo: ameaçar um juiz pode endurecê-lo).
- dawn_success: manchete do amanhecer se der certo. dawn_fail: manchete se fracassar. retreat: o pronunciamento de recuo, se o governante desistir no meio da noite.`,
    schema: {
      type: 'object',
      properties: {
        codename: str,
        conspirator: { type: 'object', properties: { name: str, title: str }, required: ['name', 'title'] },
        intro: str,
        actors: {
          type: 'array',
          minItems: 4,
          maxItems: 6,
          items: {
            type: 'object',
            properties: {
              id: { enum: RUPTURE_ACTORS },
              name: str,
              title: str,
              opening: str,
              offers: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: { type: 'object', properties: { label: str, hours: num, swing: num, effects: kpiEffects, reaction: str }, required: ['label', 'hours', 'swing', 'effects', 'reaction'] },
              },
            },
            required: ['id', 'name', 'title', 'opening', 'offers'],
          },
        },
        dawn_success: str,
        dawn_fail: str,
        retreat: str,
      },
      required: ['codename', 'conspirator', 'intro', 'actors', 'dawn_success', 'dawn_fail', 'retreat'],
    },
  },
  conselho: {
    system: `${COMMON}
Cena: O CONSELHO DO REGIME. Numa autocracia (ou na audiência com o monarca), o governante enfrenta o círculo que o sustenta: a Junta, o Politburo, o Conselho de Líderes Religiosos, o Conselho Técnico... O briefing traz o nome do conselho e os papéis dos membros.
- agenda: a pauta, nascida do momento do país. members: um por papel do briefing, na mesma ordem, com name fictício e stance (o que ele defende hoje).
- rounds: 3 rodadas. Em cada uma, um membro (speaker = o papel) fala, e o governante escolhe entre 3 respostas. Cada resposta: variação de lealdade de cada membro afetado (loyalty, chave = papel, -30 a +30), efeitos nos indicadores e a reação de quem falou.
- Nas autocracias, quem perde a lealdade não pede demissão: CONSPIRA. Escreva "conspiracy": para cada papel, a frase que ele diz aos cochichos quando decide conspirar.`,
    schema: {
      type: 'object',
      properties: {
        agenda: str,
        members: { type: 'array', minItems: 3, maxItems: 5, items: { type: 'object', properties: { role: str, name: str, stance: str }, required: ['role', 'name', 'stance'] } },
        rounds: {
          type: 'array',
          minItems: 3,
          maxItems: 3,
          items: {
            type: 'object',
            properties: {
              speaker: str,
              line: str,
              options: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: { type: 'object', properties: { label: str, loyalty: { type: 'object', additionalProperties: num }, effects: kpiEffects, reaction: str }, required: ['label', 'loyalty', 'effects', 'reaction'] },
              },
            },
            required: ['speaker', 'line', 'options'],
          },
        },
        conspiracy: { type: 'object', additionalProperties: str },
      },
      required: ['agenda', 'members', 'rounds', 'conspiracy'],
    },
  },
};
