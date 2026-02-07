export interface GitBranch {
  name: string;
  current: boolean;
  commit: string;
}

export interface GitDiff {
  files: {
    path: string;
    insertions: number;
    deletions: number;
    changes: number;
  }[];
  summary: {
    insertions: number;
    deletions: number;
    filesChanged: number;
  };
}

export type MergeStrategy = 'merge' | 'squash' | 'rebase';

export interface MergeResult {
  success: boolean;
  message: string;
  conflicts?: string[];
}
