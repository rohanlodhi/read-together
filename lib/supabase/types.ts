// Hand-written shapes for now; replace with `supabase gen types typescript` once
// the project is connected.

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          emoji: string;
          accent: AccentColor;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          emoji?: string;
          accent?: AccentColor;
          avatar_url?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      books: {
        Row: {
          id: string;
          title: string;
          author: string | null;
          cover_url: string | null;
          pdf_path: string;
          total_pages: number | null;
          uploaded_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          author?: string | null;
          cover_url?: string | null;
          pdf_path: string;
          total_pages?: number | null;
          uploaded_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["books"]["Insert"]>;
        Relationships: [];
      };
      reading_progress: {
        Row: {
          user_id: string;
          book_id: string;
          page: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          book_id: string;
          page: number;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["reading_progress"]["Insert"]
        >;
        Relationships: [];
      };
      bookmarks: {
        Row: {
          id: string;
          user_id: string;
          book_id: string;
          page: number;
          label: string | null;
          color: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          book_id: string;
          page: number;
          label?: string | null;
          color?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["bookmarks"]["Insert"]>;
        Relationships: [];
      };
      annotations: {
        Row: {
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
        Insert: {
          id?: string;
          user_id: string;
          book_id: string;
          page: number;
          kind: "highlight" | "note";
          rects: Rect[];
          selected_text?: string | null;
          note_content?: string | null;
          color?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["annotations"]["Insert"]>;
        Relationships: [];
      };
      reactions: {
        Row: {
          id: string;
          user_id: string;
          book_id: string;
          page: number;
          emoji: string;
          x: number;
          y: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          book_id: string;
          page: number;
          emoji: string;
          x: number;
          y: number;
        };
        Update: Partial<Database["public"]["Tables"]["reactions"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

export type Rect = { x: number; y: number; w: number; h: number };
export type AccentColor = "peach" | "lavender" | "sage" | "rose" | "sun";
