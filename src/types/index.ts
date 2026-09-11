export type Song = {
  id: string;
  title: string;
  artist: string | null;
  audioUrl: string;
  duration: number | null;
  addedAt: string;
};

export type ScoreEntry = {
  id: string;
  name: string;
  score: number;
  roundsPlayed: number;
  createdAt: string;
};

export type RoundResult = {
  song: Song;
  correct: boolean;
  gaveUp: boolean;
  stageIndex: number; // stage the guess landed on (or last stage reached if given up)
  points: number;
};

export type AnalyzeResult = {
  stagingId: string;
  fileName: string;
  title: string;
  artist: string | null;
  titleSource: "tag" | "filename";
  suggestedStart: number;
  duration: number;
  warning?: string;
};

export type ImportRowInput = {
  stagingId: string;
  title: string;
  artist: string | null;
  startTime: number;
};

export type ImportRowResult =
  | { status: "imported"; song: Song }
  | { status: "skipped"; reason: "duplicate" }
  | { status: "error"; reason: string };

export type LaneState =
  | { status: "idle" }
  | { status: "working"; fileName: string; stage: string }
  | { status: "done"; fileName: string }
  | { status: "error"; fileName: string; message: string };

export type ReviewRowStatus = "pending" | "analyzing" | "ready" | "error" | "importing" | "imported" | "skipped";

export type ReviewRow = {
  clientId: string;
  fileName: string;
  fileSize: number;
  status: ReviewRowStatus;
  stagingId?: string;
  title: string;
  artist: string;
  titleSource?: "tag" | "filename";
  duration?: number;
  suggestedStart?: number;
  startOverride?: number;
  errorMessage?: string;
};
