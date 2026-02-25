import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';

export interface StoredLink {
  linkId: string;
  worktreePath: string;
  branchName: string;
  baseBranch: string;
  devServerPort: number;
  proxyPort: number;
  status: 'ready' | 'stopped' | 'error';
  createdAt: string; // ISO date string
  description?: string;
  mergeStatus?: 'requested' | 'merged' | 'rejected';
}

export class ShareLinkStore {
  private filePath: string;

  constructor(projectRoot: string) {
    this.filePath = join(projectRoot, '.buildover', 'links.json');
  }

  async load(): Promise<StoredLink[]> {
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      return JSON.parse(raw) as StoredLink[];
    } catch {
      return [];
    }
  }

  async save(links: StoredLink[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(links, null, 2), 'utf-8');
  }

  async upsert(link: StoredLink): Promise<void> {
    const existing = await this.load();
    const idx = existing.findIndex(l => l.linkId === link.linkId);
    if (idx >= 0) {
      existing[idx] = link;
    } else {
      existing.unshift(link); // newest first
    }
    await this.save(existing);
  }

  async updateStatus(linkId: string, status: StoredLink['status']): Promise<void> {
    const existing = await this.load();
    const entry = existing.find(l => l.linkId === linkId);
    if (entry) {
      entry.status = status;
      await this.save(existing);
    }
  }
}
