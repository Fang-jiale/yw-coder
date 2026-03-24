/**
 * 检查点管理器
 * 管理 Agent 任务的检查点和版本
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface Checkpoint {
  id: string;
  taskId: string;
  data: any;
  timestamp: number;
  version: number;
  metadata?: {
    description?: string;
    size?: number;
    tags?: string[];
  };
}

export interface CheckpointVersion {
  version: number;
  checkpointId: string;
  timestamp: number;
  description?: string;
}

export interface CheckpointStats {
  totalCheckpoints: number;
  totalVersions: number;
  latestCheckpoint?: Checkpoint;
  totalSize: number;
}

export class CheckpointManager {
  private checkpointDir: string;
  private maxCheckpoints: number;
  private maxVersionsPerCheckpoint: number;
  private compressionEnabled: boolean;

  constructor(
    workspacePath: string,
    options?: {
      maxCheckpoints?: number;
      maxVersionsPerCheckpoint?: number;
      compressionEnabled?: boolean;
    }
  ) {
    this.checkpointDir = path.join(workspacePath, '.aicoder', 'checkpoints');
    this.maxCheckpoints = options?.maxCheckpoints || 10;
    this.maxVersionsPerCheckpoint = options?.maxVersionsPerCheckpoint || 5;
    this.compressionEnabled = options?.compressionEnabled || false;
  }

  async saveCheckpoint(taskId: string, data: any, description?: string): Promise<Checkpoint> {
    await fs.mkdir(this.checkpointDir, { recursive: true });

    const existingCheckpoints = await this.listCheckpoints(taskId);
    const latestVersion = existingCheckpoints.length > 0
      ? Math.max(...existingCheckpoints.map((c) => c.version))
      : 0;

    const checkpoint: Checkpoint = {
      id: `checkpoint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      taskId,
      data,
      timestamp: Date.now(),
      version: latestVersion + 1,
      metadata: {
        description,
        size: JSON.stringify(data).length,
      },
    };

    const checkpointPath = this.getCheckpointPath(taskId, checkpoint.version);
    await fs.writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf-8');

    await this.cleanupOldCheckpoints(taskId);

    await this.saveVersionHistory(taskId, checkpoint);

    return checkpoint;
  }

  async loadCheckpoint(taskId: string, version?: number): Promise<Checkpoint | null> {
    try {
      if (version !== undefined) {
        const checkpointPath = this.getCheckpointPath(taskId, version);
        const data = await fs.readFile(checkpointPath, 'utf-8');
        return JSON.parse(data) as Checkpoint;
      }

      const checkpoints = await this.listCheckpoints(taskId);
      if (checkpoints.length === 0) {
        return null;
      }

      const latestCheckpoint = checkpoints.reduce((latest, current) =>
        current.timestamp > latest.timestamp ? current : latest
      );

      return latestCheckpoint;
    } catch (error) {
      console.error(`Failed to load checkpoint for task ${taskId}:`, error);
      return null;
    }
  }

  async deleteCheckpoint(taskId: string, version?: number): Promise<boolean> {
    try {
      if (version !== undefined) {
        const checkpointPath = this.getCheckpointPath(taskId, version);
        await fs.unlink(checkpointPath);
        return true;
      }

      const checkpoints = await this.listCheckpoints(taskId);
      for (const checkpoint of checkpoints) {
        const checkpointPath = this.getCheckpointPath(taskId, checkpoint.version);
        await fs.unlink(checkpointPath);
      }

      const historyPath = this.getVersionHistoryPath(taskId);
      try {
        await fs.unlink(historyPath);
      } catch (error) {
        // Ignore if history file doesn't exist
      }

      return true;
    } catch (error) {
      console.error(`Failed to delete checkpoint for task ${taskId}:`, error);
      return false;
    }
  }

  async listCheckpoints(taskId: string): Promise<Checkpoint[]> {
    try {
      await fs.mkdir(this.checkpointDir, { recursive: true });

      const taskDir = path.join(this.checkpointDir, taskId);
      await fs.mkdir(taskDir, { recursive: true });

      const files = await fs.readdir(taskDir);
      const checkpoints: Checkpoint[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(taskDir, file);
          const data = await fs.readFile(filePath, 'utf-8');
          const checkpoint = JSON.parse(data) as Checkpoint;
          checkpoints.push(checkpoint);
        }
      }

      return checkpoints.sort((a, b) => a.version - b.version);
    } catch (error) {
      console.error(`Failed to list checkpoints for task ${taskId}:`, error);
      return [];
    }
  }

  async getCheckpointVersions(taskId: string): Promise<CheckpointVersion[]> {
    const checkpoints = await this.listCheckpoints(taskId);

    return checkpoints.map((checkpoint) => ({
      version: checkpoint.version,
      checkpointId: checkpoint.id,
      timestamp: checkpoint.timestamp,
      description: checkpoint.metadata?.description,
    }));
  }

  async getLatestCheckpoint(taskId: string): Promise<Checkpoint | null> {
    return this.loadCheckpoint(taskId);
  }

  async getStats(taskId: string): Promise<CheckpointStats> {
    const checkpoints = await this.listCheckpoints(taskId);
    const versions = await this.getCheckpointVersions(taskId);

    let totalSize = 0;
    for (const checkpoint of checkpoints) {
      totalSize += checkpoint.metadata?.size || 0;
    }

    const latestCheckpoint = checkpoints.length > 0
      ? checkpoints.reduce((latest, current) =>
          current.timestamp > latest.timestamp ? current : latest
        )
      : undefined;

    return {
      totalCheckpoints: checkpoints.length,
      totalVersions: versions.length,
      latestCheckpoint,
      totalSize,
    };
  }

  async exportCheckpoint(taskId: string, version: number, exportPath: string): Promise<boolean> {
    try {
      const checkpoint = await this.loadCheckpoint(taskId, version);
      if (!checkpoint) {
        return false;
      }

      await fs.writeFile(exportPath, JSON.stringify(checkpoint, null, 2), 'utf-8');
      return true;
    } catch (error) {
      console.error(`Failed to export checkpoint:`, error);
      return false;
    }
  }

  async importCheckpoint(importPath: string): Promise<Checkpoint | null> {
    try {
      const data = await fs.readFile(importPath, 'utf-8');
      const checkpoint = JSON.parse(data) as Checkpoint;

      await this.saveCheckpoint(checkpoint.taskId, checkpoint.data, checkpoint.metadata?.description);

      return checkpoint;
    } catch (error) {
      console.error(`Failed to import checkpoint:`, error);
      return null;
    }
  }

  async cleanupOldCheckpoints(taskId: string): Promise<void> {
    const checkpoints = await this.listCheckpoints(taskId);

    if (checkpoints.length > this.maxCheckpoints) {
      const toDelete = checkpoints
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, checkpoints.length - this.maxCheckpoints);

      for (const checkpoint of toDelete) {
        const checkpointPath = this.getCheckpointPath(taskId, checkpoint.version);
        try {
          await fs.unlink(checkpointPath);
        } catch (error) {
          console.error(`Failed to delete old checkpoint:`, error);
        }
      }
    }
  }

  async autoCleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    try {
      const now = Date.now();
      const allTasks = await fs.readdir(this.checkpointDir);
      let deletedCount = 0;

      for (const taskId of allTasks) {
        const taskDir = path.join(this.checkpointDir, taskId);
        const stat = await fs.stat(taskDir);

        if (stat.isDirectory()) {
          const checkpoints = await this.listCheckpoints(taskId);

          for (const checkpoint of checkpoints) {
            if (now - checkpoint.timestamp > maxAge) {
              await this.deleteCheckpoint(taskId, checkpoint.version);
              deletedCount++;
            }
          }
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Failed to auto cleanup checkpoints:', error);
      return 0;
    }
  }

  private getCheckpointPath(taskId: string, version: number): string {
    return path.join(this.checkpointDir, taskId, `v${version}.json`);
  }

  private getVersionHistoryPath(taskId: string): string {
    return path.join(this.checkpointDir, taskId, 'versions.json');
  }

  private async saveVersionHistory(taskId: string, checkpoint: Checkpoint): Promise<void> {
    const historyPath = this.getVersionHistoryPath(taskId);
    let history: CheckpointVersion[] = [];

    try {
      const existingData = await fs.readFile(historyPath, 'utf-8');
      history = JSON.parse(existingData);
    } catch (error) {
      history = [];
    }

    history.push({
      version: checkpoint.version,
      checkpointId: checkpoint.id,
      timestamp: checkpoint.timestamp,
      description: checkpoint.metadata?.description,
    });

    if (history.length > this.maxVersionsPerCheckpoint) {
      history = history.slice(-this.maxVersionsPerCheckpoint);
    }

    await fs.writeFile(historyPath, JSON.stringify(history, null, 2), 'utf-8');
  }
}
