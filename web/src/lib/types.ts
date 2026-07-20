export type CandidateStatus = "queued" | "processing" | "completed" | "failed";

export type CategoryScore = {
  score: number;
  max: number;
  evidence: string;
};

export type Evaluation = {
  scores: {
    open_source: CategoryScore;
    self_projects: CategoryScore;
    production: CategoryScore;
    technical_skills: CategoryScore;
    parse_quality: CategoryScore;
  };
  bonus_points: { total: number; breakdown: string };
  deductions: { total: number; reasons: string };
  key_strengths: string[];
  areas_for_improvement: string[];
};

export type ParseDiagnostics = {
  text_extraction_ok: boolean;
  text_length: number;
  sections_attempted: string[];
  sections_succeeded: string[];
  sections_failed: string[];
  schema_errors: string[];
  issues: string[];
  suggestions: string[];
};

export type CandidateSummary = {
  id: string;
  filename: string;
  status: CandidateStatus;
  name: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  overall_score: number | null;
  max_score: number | null;
  key_strengths: string[] | null;
  areas_for_improvement: string[] | null;
};

export type CandidateDetail = CandidateSummary & {
  evaluation: Evaluation | null;
  resume: Record<string, unknown> | null;
  github: Record<string, unknown> | null;
  parse_diagnostics: ParseDiagnostics | null;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatScope = "candidate" | "global";
