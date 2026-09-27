import type { BackdropId, CutAction, SceneAnim } from './types';

/**
 * Tudo o que o diretor de cena (Claude) pode usar sem desenhar nada.
 * Sem dependência de DOM: é importado também pelo servidor que gera os eventos.
 */

export const SCENE_ANIMS: Record<SceneAnim, string> = {
  calm: 'Esplanada tranquila, pessoas andando',
  protest: 'multidão protestando com cartazes, cresce com o tempo',
  celebrate: 'festa com bandeiras e fogos',
  military: 'caminhões do Exército chegam e soldados marcham',
  fire: 'céu de fumaça e chamas no horizonte',
  firefight: 'helicópteros jogam água e o fogo diminui',
  trucks_block: 'caminhões parados bloqueando a pista',
  trucks_leave: 'caminhões buzinando e indo embora, confete',
  money_rain: 'avião soltando dinheiro do céu',
  phones_live: 'noite, multidão com celulares, selo LIVE e corações',
  blackout: 'ícone de wi-fi cortado, “SEM REDE”',
  gavel: 'prédio do STF e um martelo gigante batendo',
  vote_yes: 'painel de votação: aprovado',
  vote_no: 'painel de votação: rejeitado',
  market_crash: 'telão da bolsa despencando, papéis voando',
  market_boom: 'telão da bolsa subindo, confete',
  prices_up: 'etiqueta de preço subindo, carrinhos',
  prices_down: 'etiqueta de preço caindo, carrinhos cheios',
  speech: 'presidente num púlpito com flashes da imprensa',
};

export const BACKDROPS: Record<BackdropId, string> = {
  esplanada: 'vista do Congresso Nacional e da Esplanada (use `anim` para escolher o clima)',
  stf: 'plenário do STF: parede de madeira, brasão, bancada curva em primeiro plano (atores com layer "back" e y≈84 aparecem sentados atrás dela)',
  camara: 'plenário da Câmara: fileiras de cadeiras verdes e o painel de votação',
  gabinete: 'gabinete presidencial: janela para Brasília, bandeira, mesa em primeiro plano',
  tv: 'estúdio de telejornal com telão e letreiro de plantão',
  rua: 'rua de cidade grande com prédios e calçada',
  floresta: 'floresta amazônica com rio',
  mercado: 'corredor de supermercado com prateleiras',
  bolsa: 'sala da bolsa de valores com telas de gráficos',
  quartel: 'pátio de quartel com prédio militar e mastro',
};

/** Sprites prontos. Pessoas têm ~22px de altura; y do ator é a posição dos pés. */
export const LIB_SPRITES: Record<string, string> = {
  presidente: 'o jogador, de terno e faixa presidencial (usa a aparência escolhida)',
  ministro_careca: 'ministro do STF careca, de toga preta, cara de bravo',
  ministro: 'ministro do STF de toga preta',
  ministra: 'ministra do STF de toga preta, cabelo comprido',
  deputado: 'deputado de terno',
  deputada: 'deputada de terninho',
  assessor: 'assessor de terno cinza com prancheta',
  general: 'general de farda verde com boina',
  soldado: 'soldado de farda e capacete',
  policial: 'policial militar de farda azul e quepe',
  manifestante: 'manifestante de camiseta vermelha',
  manifestante2: 'manifestante de camiseta verde-amarela',
  cidadao: 'cidadão comum',
  cidada: 'cidadã comum',
  jornalista: 'repórter com crachá',
  empresario: 'empresário de terno azul-marinho',
  pastor: 'pastor de terno com bíblia',
  caminhoneiro: 'caminhoneiro de boné e colete',
  agricultor: 'agricultor de chapéu de palha',
  cientista: 'cientista de jaleco branco',
  martelo: 'martelo de juiz (prop para `holding`)',
  microfone: 'microfone num pedestal',
  cartaz: 'cartaz de protesto num pau',
  dinheiro: 'cédula verde (boa para `rain`)',
  papel: 'folha de papel (boa para `rain`)',
  confete: 'confete colorido (bom para `rain`)',
  voto: 'cédula de voto',
  urna: 'urna eletrônica',
  camera: 'câmera de TV',
  tanque: 'tanque de guerra',
  caminhao: 'caminhão',
  helicoptero: 'helicóptero',
  bandeira: 'bandeira do Brasil num mastro',
};

export const CUT_ACTIONS: Record<CutAction, string> = {
  enter_left: 'ator entra pela esquerda e anda até o seu x (dur)',
  enter_right: 'ator entra pela direita e anda até o seu x (dur)',
  move: 'ator anda até (x, y) em dur segundos',
  jump: 'ator dá um pulo',
  shake: 'ator treme (dur)',
  slam: 'ator bate o prop `holding` na mesa: tela treme, flash e barulho de martelo',
  say: 'balão de fala do ator com `text` (curto, até 40 caracteres) por dur segundos',
  exit: 'ator sai andando pela direita',
  hide: 'ator some',
  show: 'ator aparece',
  flash: 'clarão branco na tela',
  screenshake: 'tela inteira treme (dur)',
  rain: 'chuva do sprite `sprite` por dur segundos',
  grow: 'ator dobra de tamanho',
};

export const SCENE_W = 192;
export const SCENE_H = 112;
export const CUSTOM_BACKDROP = { cols: 48, rows: 28, cell: 4 };
export const MAX_SPRITE = 32;
