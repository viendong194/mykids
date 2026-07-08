export type Zoo3DFoodGroup = 'herbivore' | 'carnivore';

export interface Zoo3DFoodInfo {
  id: string;
  assetPath: string; // public/ path to the 2D SVG icon, plain <img>-able
  group: Zoo3DFoodGroup;
  name: Record<'vi' | 'en' | 'zh' | 'ja', string>;
}

export const ZOO3D_FOODS: Zoo3DFoodInfo[] = [
  {
    id: 'carrot',
    assetPath: 'assets/vegetables/carrot/asset.svg',
    group: 'herbivore',
    name: { vi: 'cà rốt', en: 'carrot', zh: '胡萝卜', ja: 'にんじん' },
  },
  {
    id: 'leafy-green',
    assetPath: 'assets/vegetables/leafy-green/asset.svg',
    group: 'herbivore',
    name: { vi: 'rau xanh', en: 'leafy greens', zh: '青菜', ja: 'あおい やさい' },
  },
  {
    id: 'red-apple',
    assetPath: 'assets/fruits/red-apple/asset.svg',
    group: 'herbivore',
    name: { vi: 'táo', en: 'apple', zh: '苹果', ja: 'りんご' },
  },
  {
    id: 'cut-of-meat',
    assetPath: 'assets/foods/cut-of-meat/asset.svg',
    group: 'carnivore',
    name: { vi: 'thịt', en: 'meat', zh: '肉', ja: 'にく' },
  },
  {
    id: 'meat-on-bone',
    assetPath: 'assets/foods/meat-on-bone/asset.svg',
    group: 'carnivore',
    name: { vi: 'xương thịt', en: 'meat on a bone', zh: '带骨肉', ja: 'ほねつきにく' },
  },
];

// Which food group each of the 12 zoo species eats (fun/simple, not strict biology).
const SPECIES_FOOD_GROUP: Record<string, Zoo3DFoodGroup> = {
  cow: 'herbivore',
  bull: 'herbivore',
  horse: 'herbivore',
  white_horse: 'herbivore',
  donkey: 'herbivore',
  alpaca: 'herbivore',
  deer: 'herbivore',
  stag: 'herbivore',
  wolf: 'carnivore',
  fox: 'carnivore',
  husky: 'carnivore',
  shiba_inu: 'carnivore',
};

export function getFoodGroupForSpecies(speciesId: string): Zoo3DFoodGroup {
  return SPECIES_FOOD_GROUP[speciesId] ?? 'herbivore';
}

export function getFoodsForGroup(group: Zoo3DFoodGroup): Zoo3DFoodInfo[] {
  return ZOO3D_FOODS.filter((f) => f.group === group);
}

export function getOtherGroupFoods(group: Zoo3DFoodGroup): Zoo3DFoodInfo[] {
  return ZOO3D_FOODS.filter((f) => f.group !== group);
}
