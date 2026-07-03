export interface Zoo3DRoundEntry {
  speciesId: string;
  count: number;
}

export interface Zoo3DLevelData {
  id: string;
  targetSpeciesId: string;
  entries: Zoo3DRoundEntry[];
  choices: number[];
  voiceText: string;
}
