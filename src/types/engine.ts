export interface GameEngine {
  initialize(): void;
  preload(): void;
  create(): void;
  update(): void;
  loadLevel(levelData: any): void;
  checkAnswer(answer: any): void;
  reset(): void;
  destroy(): void;
  resize(width: number, height: number): void;
}

export interface BaseLevelData {
  id: string;
  type: string;
  voiceText: string;
  rewardSticker?: string;
}

export interface IllustrationItem {
  type: 'images' | 'text';
  asset?: string;
  count?: number;
  value?: string;
}

export interface TapLevelData extends BaseLevelData {
  type: 'tap';
  correct: string;
  options: string[];
  illustration?: {
    items: IllustrationItem[];
  };
}

export interface DragItem {
  id: string;
  asset: string;
  targetId: string;
  scale?: number;
}

export interface DragTarget {
  id: string;
  asset: string;
  name: string;
  scale?: number;
}

export interface DragLevelData extends BaseLevelData {
  type: 'drag';
  items: DragItem[];
  targets: DragTarget[];
}

export interface MatchItem {
  type: 'color' | 'asset';
  id: string;
  value: string; // Hex code (e.g. "#FF0000") or asset cache key
}

export interface MatchLevelData extends BaseLevelData {
  type: 'match';
  mode: 'select' | 'drag' | 'category' | 'pair' | 'shadow';
  target: MatchItem;
  choices: MatchItem[];
}

export interface CountObject {
  type: string;
  id: string;
  asset: string;
}

export interface CountLevelData extends BaseLevelData {
  type: 'count';
  mode: 'count_objects' | 'count_drag' | 'compare_quantity' | 'missing_number' | 'build_quantity' | 'order_numbers';
  object: CountObject;
  count: number;
  choices: number[];
}

export type LevelData = TapLevelData | DragLevelData | MatchLevelData | CountLevelData;
