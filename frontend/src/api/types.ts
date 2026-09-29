export interface Me {
  id: number;
  username: string;
  grade: string;
  points: number;
  streak: number;
  is_admin: boolean;
  stage: number;
  stage_title: string;
  next_stage_at: number;
  daily_earned: number;
  daily_cap: number;
  goal: number;
  learned_today: number;
}

export interface Word {
  id: number;
  text: string;
  phonetic: string;
  pos: string;
  meaning: string;
  example: string;
  example_cn: string;
  tip: string;
}

export interface StudyItem {
  user_word_id: number | null;
  word: Word;
  is_new: boolean;
}

export interface Task {
  key: string;
  name: string;
  pts: number;
  goal: number;
  now: number;
  done: boolean;
}

export interface TodayResp {
  items: StudyItem[];
  tasks: Task[];
  stats: {
    learned_today: number;
    goal: number;
    streak: number;
    remaining: number;
    reviews_due: number;
    new_count: number;
  };
}

export interface Book {
  id: number;
  name: string;
  subtitle: string;
  stage: string;
  word_count: number;
  using: boolean;
  progress: number;
}

export interface UserActionResp {
  correct?: boolean;
  correct_answer?: string;
  ok?: boolean;
  due_at?: string;
  interval_days?: number;
  points_added: number;
  task_awarded?: boolean;
  total_points: number;
  user: Me;
}

export interface LedgerRow {
  delta: number;
  reason: string;
  created_at: string;
}

export interface ListenItem {
  word_id: number;
  text: string;
  options: string[];
  correct_index: number;
}
export interface SpellItem {
  word_id: number;
  meaning: string;
  phonetic: string;
  length: number;
}
export interface ScrambleItem {
  word_id: number;
  sentence: string;
  sentence_cn: string;
  chips: string[];
}
export interface SpeakItem {
  word_id: number;
  sentence: string;
  sentence_cn: string;
}
export interface ImportResp {
  added: number;
  skipped: number;
  total: number;
  rows: { word: string; phonetic: string; meaning: string; status: string }[];
}

export interface UnitInfo {
  id: number;
  name: string;
  word_count: number;
}

export interface AdminBook {
  id: number;
  name: string;
  subtitle: string;
  stage: string;
  word_count: number;
  units: UnitInfo[];
}

export interface UnitWord {
  id: number;
  text: string;
  phonetic: string;
  pos: string;
  meaning: string;
  example: string;
  example_cn: string;
  tip: string;
}

export interface ImportTarget {
  unitId: number;
  bookName: string;
  unitName: string;
}
