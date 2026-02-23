import simpleGit, { SimpleGit } from 'simple-git';
import { GitBranch, GitDiff, MergeStrategy, MergeResult, CommitEntry } from './types.js';

export class GitManager {
  private git: SimpleGit;

  constructor(projectRoot: string) {
    this.git = simpleGit(projectRoot);
  }

  async createBranch(sessionId: string, description: string): Promise<string> {
    const sanitizedDesc = description
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 50);
    const branchName = `buildover/${sessionId}/${sanitizedDesc}`;

    await this.git.checkoutLocalBranch(branchName);
    return branchName;
  }

  async autoCommit(message: string): Promise<string | null> {
    const status = await this.git.status();
    if (status.files.length === 0) return null;
    await this.git.add('.');
    const result = await this.git.commit(message);
    return result.commit || null;
  }

  async getCommitHistory(limit = 20): Promise<CommitEntry[]> {
    try {
      const log = await this.git.log({ maxCount: limit });
      return log.all.map(entry => ({
        hash: entry.hash,
        shortHash: entry.hash.substring(0, 7),
        message: entry.message,
        date: entry.date,
      }));
    } catch {
      return [];
    }
  }

  async getDiff(branchName?: string): Promise<GitDiff> {
    const base = branchName || 'HEAD';
    const diffSummary = await this.git.diffSummary([base]);

    return {
      files: diffSummary.files.map(f => ({
        path: f.file,
        insertions: 'insertions' in f ? f.insertions : 0,
        deletions: 'deletions' in f ? f.deletions : 0,
        changes: 'changes' in f ? f.changes : 0,
      })),
      summary: {
        insertions: diffSummary.insertions,
        deletions: diffSummary.deletions,
        filesChanged: diffSummary.files.length,
      },
    };
  }

  async merge(branchName: string, strategy: MergeStrategy): Promise<MergeResult> {
    try {
      switch (strategy) {
        case 'merge':
          await this.git.merge([branchName]);
          break;
        case 'squash':
          await this.git.merge([branchName, '--squash']);
          await this.git.commit(`Merge branch '${branchName}' (squashed)`);
          break;
        case 'rebase':
          await this.git.rebase([branchName]);
          break;
      }
      return { success: true, message: `Successfully merged ${branchName}` };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        conflicts: error.git?.conflicts || [],
      };
    }
  }

  async discard(branchName: string): Promise<void> {
    const currentBranch = await this.git.revparse(['--abbrev-ref', 'HEAD']);

    if (currentBranch === branchName) {
      await this.git.checkout('main');
    }

    await this.git.deleteLocalBranch(branchName, true);
  }

  async restore(hash: string): Promise<void> {
    await this.git.checkout([hash, '--', '.']);
  }

  async getCurrentBranch(): Promise<string> {
    const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
    return branch;
  }

  async listBranches(): Promise<GitBranch[]> {
    const branchSummary = await this.git.branch();
    return Object.entries(branchSummary.branches).map(([name, info]) => ({
      name,
      current: info.current,
      commit: info.commit,
    }));
  }
}
