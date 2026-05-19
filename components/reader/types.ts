export type Rect = { x: number; y: number; w: number; h: number };

export type AnnotationRow = {
  id: string;
  user_id: string;
  book_id: string;
  page: number;
  kind: "highlight" | "note";
  rects: Rect[];
  selected_text: string | null;
  note_content: string | null;
  color: string | null;
  created_at: string;
};

export type ReactionRow = {
  id: string;
  user_id: string;
  book_id: string;
  page: number;
  emoji: string;
  x: number;
  y: number;
  created_at: string;
};
