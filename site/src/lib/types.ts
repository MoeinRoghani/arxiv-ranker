export interface Paper {
  arXiv_ID: string;
  Title: string;
  Authors: string;
  Score: number;
  Tier: string;
  Factors: string[];
  Venue: string;
  Categories: string[];
  Citation_Count: number;
  Influential_Citations: number;
  Max_Author_hIndex: number;
  New?: boolean;
}

export interface PaperSummary {
  arXiv_ID: string;
  summary: string;
  generated_at: string;
  feedback?: string;
}

export interface RunEntry {
  id: string;
  categories: string[];
  year_month: string;
  paper_count: number;
  landmarks: number;
  important: number;
  last_updated: string;
}
