export interface Zoo3DSpeciesInfo {
  id: string;
  file: string; // filename (no extension) under /assets/3d/animals/
  targetHeight: number; // normalized world-unit height used to scale the model
  name: Record<'vi' | 'en' | 'zh' | 'ja', string>;
}

export const ZOO3D_SPECIES: Zoo3DSpeciesInfo[] = [
  { id: 'cow', file: 'cow', targetHeight: 1.1, name: { vi: 'bò', en: 'cow', zh: '奶牛', ja: 'うし' } },
  { id: 'bull', file: 'bull', targetHeight: 1.15, name: { vi: 'bò tót', en: 'bull', zh: '公牛', ja: 'おうし' } },
  { id: 'horse', file: 'horse', targetHeight: 1.2, name: { vi: 'ngựa', en: 'horse', zh: '马', ja: 'うま' } },
  { id: 'white_horse', file: 'white-horse', targetHeight: 1.2, name: { vi: 'ngựa trắng', en: 'white horse', zh: '白马', ja: 'しろいうま' } },
  { id: 'donkey', file: 'donkey', targetHeight: 1.0, name: { vi: 'lừa', en: 'donkey', zh: '驴', ja: 'ロバ' } },
  { id: 'alpaca', file: 'alpaca', targetHeight: 0.95, name: { vi: 'lạc đà không bướu', en: 'alpaca', zh: '羊驼', ja: 'アルパカ' } },
  { id: 'wolf', file: 'wolf', targetHeight: 0.6, name: { vi: 'sói', en: 'wolf', zh: '狼', ja: 'おおかみ' } },
  { id: 'fox', file: 'fox', targetHeight: 0.5, name: { vi: 'cáo', en: 'fox', zh: '狐狸', ja: 'きつね' } },
  { id: 'deer', file: 'deer', targetHeight: 1.0, name: { vi: 'hươu', en: 'deer', zh: '鹿', ja: 'しか' } },
  { id: 'stag', file: 'stag', targetHeight: 1.1, name: { vi: 'nai sừng', en: 'stag', zh: '雄鹿', ja: 'おじか' } },
  { id: 'husky', file: 'husky', targetHeight: 0.55, name: { vi: 'chó husky', en: 'husky', zh: '哈士奇', ja: 'ハスキー' } },
  { id: 'shiba_inu', file: 'shiba-inu', targetHeight: 0.5, name: { vi: 'chó shiba', en: 'shiba inu', zh: '柴犬', ja: 'しばいぬ' } },
];

export function getZoo3DSpecies(id: string): Zoo3DSpeciesInfo {
  const found = ZOO3D_SPECIES.find(s => s.id === id);
  if (!found) throw new Error(`Unknown zoo3d species: ${id}`);
  return found;
}

const COUNT_QUESTION_TEMPLATES: Record<'vi' | 'en' | 'zh' | 'ja', (name: string) => string> = {
  vi: (name) => `Bé hãy đếm xem có bao nhiêu con ${name} nhé`,
  en: (name) => `Can you count how many ${name}s are there?`,
  zh: (name) => `请数一数有几只${name}`,
  ja: (name) => `${name}は なんびき いるかな？`,
};

export function buildZoo3DVoiceText(lang: 'vi' | 'en' | 'zh' | 'ja', speciesId: string): string {
  const species = getZoo3DSpecies(speciesId);
  const template = COUNT_QUESTION_TEMPLATES[lang] || COUNT_QUESTION_TEMPLATES.en;
  return template(species.name[lang] || species.name.en);
}

const HIDE_SEEK_QUESTION_TEMPLATES: Record<'vi' | 'en' | 'zh' | 'ja', (name: string) => string> = {
  vi: (name) => `Con ${name} đang trốn ở đâu nhỉ? Bé hãy tìm ra nhé`,
  en: (name) => `Where is the ${name} hiding? Find it!`,
  zh: (name) => `${name}藏在哪里呢？快找找看`,
  ja: (name) => `${name}は どこに かくれてるかな？`,
};

export function buildHideSeekVoiceText(lang: 'vi' | 'en' | 'zh' | 'ja', speciesId: string): string {
  const species = getZoo3DSpecies(speciesId);
  const template = HIDE_SEEK_QUESTION_TEMPLATES[lang] || HIDE_SEEK_QUESTION_TEMPLATES.en;
  return template(species.name[lang] || species.name.en);
}

const FEED_QUESTION_TEMPLATES: Record<'vi' | 'en' | 'zh' | 'ja', (name: string) => string> = {
  vi: (name) => `Bạn ${name} đang đói bụng, bé hãy chọn món ăn phù hợp nhé`,
  en: (name) => `The ${name} is hungry — pick the right food for it`,
  zh: (name) => `${name}肚子饿了，请选择合适的食物吧`,
  ja: (name) => `${name}は おなかが すいてるよ。あう たべものを えらんでね`,
};

export function buildFeedVoiceText(lang: 'vi' | 'en' | 'zh' | 'ja', speciesId: string): string {
  const species = getZoo3DSpecies(speciesId);
  const template = FEED_QUESTION_TEMPLATES[lang] || FEED_QUESTION_TEMPLATES.en;
  return template(species.name[lang] || species.name.en);
}

const HERD_QUESTION_TEMPLATES: Record<'vi' | 'en' | 'zh' | 'ja', (name: string) => string> = {
  vi: (name) => `Bé hãy lùa các bạn ${name} về chuồng nhé`,
  en: (name) => `Help herd the ${name}s back into the pen`,
  zh: (name) => `请把${name}都赶回围栏里吧`,
  ja: (name) => `${name}を おりに つれていってね`,
};

export function buildHerdVoiceText(lang: 'vi' | 'en' | 'zh' | 'ja', speciesId: string): string {
  const species = getZoo3DSpecies(speciesId);
  const template = HERD_QUESTION_TEMPLATES[lang] || HERD_QUESTION_TEMPLATES.en;
  return template(species.name[lang] || species.name.en);
}

const DAY_NIGHT_TEMPLATES: Record<'vi' | 'en' | 'zh' | 'ja', { findAwake: string; findAsleep: string }> = {
  vi: {
    findAwake: 'Đêm rồi, ai vẫn còn thức vậy nhỉ? Bé hãy tìm ra và ru bạn ấy ngủ nào',
    findAsleep: 'Buổi sáng rồi, ai vẫn còn ngủ vậy nhỉ? Bé hãy đánh thức bạn ấy dậy nhé',
  },
  en: {
    findAwake: "It's night — who is still awake? Find them and help them sleep",
    findAsleep: "It's morning — who is still asleep? Wake them up",
  },
  zh: {
    findAwake: '现在是晚上了，谁还醒着呢？快找出来哄它睡觉吧',
    findAsleep: '现在是早上了，谁还在睡觉呢？快叫醒它吧',
  },
  ja: {
    findAwake: 'よるだよ。まだ おきてるのは だれかな？みつけて ねかせてあげよう',
    findAsleep: 'あさだよ。まだ ねているのは だれかな？おこしてあげよう',
  },
};

export function buildDayNightVoiceText(lang: 'vi' | 'en' | 'zh' | 'ja', mode: 'findAwake' | 'findAsleep'): string {
  const template = DAY_NIGHT_TEMPLATES[lang] || DAY_NIGHT_TEMPLATES.en;
  return template[mode];
}
