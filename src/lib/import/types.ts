export interface ParsedNote {
  front: string;
  back: string;
  extra: string;
  tags: string[];
}

export interface ParsedDeck {
  name: string;
  notes: ParsedNote[];
}

export interface ParseResult {
  source: "csv" | "apkg" | "json";
  decks: ParsedDeck[];
  warnings: string[];
}

export interface ImportSummary {
  deckId: number;
  deckName: string;
  created: number;
  duplicates: number;
  cardsCreated: number;
}
