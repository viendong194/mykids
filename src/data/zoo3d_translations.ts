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
