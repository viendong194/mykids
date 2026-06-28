// SVG assets cho giao diện (UI) — inline Base64 để không phụ thuộc server
// Animal SVGs được phục vụ từ /public/assets/animals/ (OpenMoji)



const FLAG_VI_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <circle cx="50" cy="50" r="48" fill="#DA251D" stroke="#FFFFFF" stroke-width="3" />
  <!-- Ngôi sao vàng -->
  <polygon points="50,22 58,40 78,40 62,52 68,70 50,59 32,70 38,52 22,40 42,40" fill="#FFFF00" />
</svg>
`;

const FLAG_EN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <clipPath id="circleClip">
    <circle cx="50" cy="50" r="48" />
  </clipPath>
  <g clip-path="url(#circleClip)">
    <!-- Nền xanh lục hải quân Anh -->
    <rect width="100" height="100" fill="#012169" />
    <!-- Chéo trắng -->
    <line x1="0" y1="0" x2="100" y2="100" stroke="#FFFFFF" stroke-width="12" />
    <line x1="100" y1="0" x2="0" y2="100" stroke="#FFFFFF" stroke-width="12" />
    <!-- Chéo đỏ -->
    <line x1="0" y1="0" x2="100" y2="100" stroke="#C8102E" stroke-width="6" />
    <line x1="100" y1="0" x2="0" y2="100" stroke="#C8102E" stroke-width="6" />
    <!-- Thập tự trắng -->
    <rect x="40" y="0" width="20" height="100" fill="#FFFFFF" />
    <rect x="0" y="40" width="100" height="20" fill="#FFFFFF" />
    <!-- Thập tự đỏ -->
    <rect x="44" y="0" width="12" height="100" fill="#C8102E" />
    <rect x="0" y="44" width="100" height="12" fill="#C8102E" />
  </g>
  <circle cx="50" cy="50" r="48" fill="none" stroke="#FFFFFF" stroke-width="3" />
</svg>
`;

const STAR_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <!-- Ngôi sao vàng bóng bẩy -->
  <polygon points="50,5 64,36 98,36 70,57 81,91 50,70 19,91 30,57 2,36 36,36" fill="#FFD700" stroke="#FF8C00" stroke-width="3" stroke-linejoin="round" />
  <!-- Phản quang -->
  <polygon points="50,15 60,38 85,38 63,53 50,45" fill="#FFE082" opacity="0.7" />
</svg>
`;

const SOUND_ON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <circle cx="50" cy="50" r="48" fill="#4CAF50" stroke="#FFFFFF" stroke-width="3" />
  <!-- Biểu tượng loa -->
  <path d="M 28,40 L 40,40 L 56,25 L 56,75 L 40,60 L 28,60 Z" fill="#FFFFFF" />
  <!-- Sóng âm -->
  <path d="M 66,35 Q 73,50 66,65" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" />
  <path d="M 74,25 Q 86,50 74,75" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" />
</svg>
`;

const SOUND_OFF_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <circle cx="50" cy="50" r="48" fill="#E53935" stroke="#FFFFFF" stroke-width="3" />
  <!-- Biểu tượng loa -->
  <path d="M 28,40 L 40,40 L 56,25 L 56,75 L 40,60 L 28,60 Z" fill="#FFFFFF" opacity="0.6" />
  <!-- Dấu gạch chéo -->
  <line x1="25" y1="25" x2="75" y2="75" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" />
</svg>
`;

const FLAG_ZH_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <circle cx="50" cy="50" r="48" fill="#DE2910" stroke="#FFFFFF" stroke-width="3" />
  <polygon points="40,25 45,37 57,37 47,45 51,57 40,49 29,57 33,45 23,37 35,37" fill="#FFDE00" />
</svg>
`;

const FLAG_JA_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <circle cx="50" cy="50" r="48" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="2" />
  <circle cx="50" cy="50" r="20" fill="#BC002D" />
</svg>
`;

// Từ điển SVG chứa toàn bộ asset game
// UI assets (flag, star, sound) dùng Base64 inline để không phụ thuộc server
// Animal assets trỏ đến file SVG thực trong public/assets/animals/
export const SVG_ASSETS: Record<string, string> = {
  // ── UI Assets (Base64 inline) ──────────────────────────────────────
  flag_vi: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(FLAG_VI_SVG)))}`,
  flag_en: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(FLAG_EN_SVG)))}`,
  flag_zh: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(FLAG_ZH_SVG)))}`,
  flag_ja: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(FLAG_JA_SVG)))}`,
  star: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(STAR_SVG)))}`,
  sound_on: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(SOUND_ON_SVG)))}`,
  sound_off: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(SOUND_OFF_SVG)))}`,

  // ── Animal Assets (OpenMoji SVG — đường dẫn thực) ──────────────────
  'ant':            '/assets/animals/ant/asset.svg',
  'baby-chick':     '/assets/animals/baby-chick/asset.svg',
  'badger':         '/assets/animals/badger/asset.svg',
  'bat':            '/assets/animals/bat/asset.svg',
  'bear':           '/assets/animals/bear/asset.svg',
  'beaver':         '/assets/animals/beaver/asset.svg',
  'beetle':         '/assets/animals/beetle/asset.svg',
  'bird':           '/assets/animals/bird/asset.svg',
  'bison':          '/assets/animals/bison/asset.svg',
  'black-bird':     '/assets/animals/black-bird/asset.svg',
  'black-cat':      '/assets/animals/black-cat/asset.svg',
  'blowfish':       '/assets/animals/blowfish/asset.svg',
  'boar':           '/assets/animals/boar/asset.svg',
  'bug':            '/assets/animals/bug/asset.svg',
  'butterfly':      '/assets/animals/butterfly/asset.svg',
  'camel':          '/assets/animals/camel/asset.svg',
  'cat':            '/assets/animals/cat/asset.svg',
  'cat-face':       '/assets/animals/cat-face/asset.svg',
  'chicken':        '/assets/animals/chicken/asset.svg',
  'chipmunk':       '/assets/animals/chipmunk/asset.svg',
  'cockroach':      '/assets/animals/cockroach/asset.svg',
  'coral':          '/assets/animals/coral/asset.svg',
  'cow':            '/assets/animals/cow/asset.svg',
  'cow-face':       '/assets/animals/cow-face/asset.svg',
  'crab':           '/assets/animals/crab/asset.svg',
  'cricket':        '/assets/animals/cricket/asset.svg',
  'crocodile':      '/assets/animals/crocodile/asset.svg',
  'deer':           '/assets/animals/deer/asset.svg',
  'dodo':           '/assets/animals/dodo/asset.svg',
  'dog':            '/assets/animals/dog/asset.svg',
  'dog-face':       '/assets/animals/dog-face/asset.svg',
  'dolphin':        '/assets/animals/dolphin/asset.svg',
  'donkey':         '/assets/animals/donkey/asset.svg',
  'dove':           '/assets/animals/dove/asset.svg',
  'dragon':         '/assets/animals/dragon/asset.svg',
  'dragon-face':    '/assets/animals/dragon-face/asset.svg',
  'duck':           '/assets/animals/duck/asset.svg',
  'eagle':          '/assets/animals/eagle/asset.svg',
  'elephant':       '/assets/animals/elephant/asset.svg',
  'feather':        '/assets/animals/feather/asset.svg',
  'fish':           '/assets/animals/fish/asset.svg',
  'flamingo':       '/assets/animals/flamingo/asset.svg',
  'fly':            '/assets/animals/fly/asset.svg',
  'fox':            '/assets/animals/fox/asset.svg',
  'frog':           '/assets/animals/frog/asset.svg',
  'giraffe':        '/assets/animals/giraffe/asset.svg',
  'goat':           '/assets/animals/goat/asset.svg',
  'goose':          '/assets/animals/goose/asset.svg',
  'gorilla':        '/assets/animals/gorilla/asset.svg',
  'guide-dog':      '/assets/animals/guide-dog/asset.svg',
  'hamster':        '/assets/animals/hamster/asset.svg',
  'hatching-chick': '/assets/animals/hatching-chick/asset.svg',
  'hedgehog':       '/assets/animals/hedgehog/asset.svg',
  'hippopotamus':   '/assets/animals/hippopotamus/asset.svg',
  'horse':          '/assets/animals/horse/asset.svg',
  'horse-face':     '/assets/animals/horse-face/asset.svg',
  'jellyfish':      '/assets/animals/jellyfish/asset.svg',
  'kangaroo':       '/assets/animals/kangaroo/asset.svg',
  'koala':          '/assets/animals/koala/asset.svg',
  'leopard':        '/assets/animals/leopard/asset.svg',
  'lion':           '/assets/animals/lion/asset.svg',
  'lizard':         '/assets/animals/lizard/asset.svg',
  'llama':          '/assets/animals/llama/asset.svg',
  'lobster':        '/assets/animals/lobster/asset.svg',
  'mammoth':        '/assets/animals/mammoth/asset.svg',
  'microbe':        '/assets/animals/microbe/asset.svg',
  'monkey':         '/assets/animals/monkey/asset.svg',
  'monkey-face':    '/assets/animals/monkey-face/asset.svg',
  'mosquito':       '/assets/animals/mosquito/asset.svg',
  'mouse':          '/assets/animals/mouse/asset.svg',
  'mouse-face':     '/assets/animals/mouse-face/asset.svg',
  'octopus':        '/assets/animals/octopus/asset.svg',
  'otter':          '/assets/animals/otter/asset.svg',
  'owl':            '/assets/animals/owl/asset.svg',
  'ox':             '/assets/animals/ox/asset.svg',
  'oyster':         '/assets/animals/oyster/asset.svg',
  'panda':          '/assets/animals/panda/asset.svg',
  'parrot':         '/assets/animals/parrot/asset.svg',
  'peacock':        '/assets/animals/peacock/asset.svg',
  'penguin':        '/assets/animals/penguin/asset.svg',
  'pig':            '/assets/animals/pig/asset.svg',
  'pig-face':       '/assets/animals/pig-face/asset.svg',
  'pig-nose':       '/assets/animals/pig-nose/asset.svg',
  'polar-bear':     '/assets/animals/polar-bear/asset.svg',
  'rabbit':         '/assets/animals/rabbit/asset.svg',
  'rabbit-face':    '/assets/animals/rabbit-face/asset.svg',
  'raccoon':        '/assets/animals/raccoon/asset.svg',
  'ram':            '/assets/animals/ram/asset.svg',
  'rat':            '/assets/animals/rat/asset.svg',
  'rhinoceros':     '/assets/animals/rhinoceros/asset.svg',
  'rooster':        '/assets/animals/rooster/asset.svg',
  'scorpion':       '/assets/animals/scorpion/asset.svg',
  'seal':           '/assets/animals/seal/asset.svg',
  'shark':          '/assets/animals/shark/asset.svg',
  'shrimp':         '/assets/animals/shrimp/asset.svg',
  'skunk':          '/assets/animals/skunk/asset.svg',
  'sloth':          '/assets/animals/sloth/asset.svg',
  'snail':          '/assets/animals/snail/asset.svg',
  'snake':          '/assets/animals/snake/asset.svg',
  'spider':         '/assets/animals/spider/asset.svg',
  'squid':          '/assets/animals/squid/asset.svg',
  'swan':           '/assets/animals/swan/asset.svg',
  'tiger':          '/assets/animals/tiger/asset.svg',
  'tiger-face':     '/assets/animals/tiger-face/asset.svg',
  'tropical-fish':  '/assets/animals/tropical-fish/asset.svg',
  'turkey':         '/assets/animals/turkey/asset.svg',
  'turtle':         '/assets/animals/turtle/asset.svg',
  'unicorn':        '/assets/animals/unicorn/asset.svg',
  'water-buffalo':  '/assets/animals/water-buffalo/asset.svg',
  'whale':          '/assets/animals/whale/asset.svg',
  'wolf':           '/assets/animals/wolf/asset.svg',
  'worm':           '/assets/animals/worm/asset.svg',
  'zebra':          '/assets/animals/zebra/asset.svg',
};

