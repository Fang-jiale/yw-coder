import * as fs from 'fs/promises';
import * as path from 'path';
import { FileNode } from '../../shared/types';

export class FileService {
  async readFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      throw new Error(`Failed to read file: ${error}`);
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write file: ${error}`);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        await fs.rmdir(filePath, { recursive: true });
      } else {
        await fs.unlink(filePath);
      }
    } catch (error) {
      throw new Error(`Failed to delete file: ${error}`);
    }
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    try {
      await fs.rename(oldPath, newPath);
    } catch (error) {
      throw new Error(`Failed to rename file: ${error}`);
    }
  }

  async createFile(filePath: string, isDirectory: boolean): Promise<void> {
    try {
      if (isDirectory) {
        await fs.mkdir(filePath, { recursive: true });
      } else {
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, '', 'utf-8');
      }
    } catch (error) {
      throw new Error(`Failed to create file: ${error}`);
    }
  }

  async getFileTree(dirPath: string): Promise<FileNode[]> {
    const buildTree = async (currentPath: string): Promise<FileNode[]> => {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      const nodes: FileNode[] = [];

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        // Skip hidden files and node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }

        const node: FileNode = {
          name: entry.name,
          path: fullPath,
          type: entry.isDirectory() ? 'directory' : 'file',
        };

        if (entry.isDirectory()) {
          node.children = await buildTree(fullPath);
        }

        nodes.push(node);
      }

      // Sort: directories first, then files, both alphabetically
      return nodes.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name);
        }
        return a.type === 'directory' ? -1 : 1;
      });
    };

    return buildTree(dirPath);
  }

  getLanguageFromExtension(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'c',
      '.hpp': 'cpp',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.rb': 'ruby',
      '.php': 'php',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.r': 'r',
      '.m': 'objective-c',
      '.mm': 'objective-cpp',
      '.html': 'html',
      '.htm': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.toml': 'toml',
      '.ini': 'ini',
      '.md': 'markdown',
      '.sql': 'sql',
      '.sh': 'shell',
      '.bash': 'shell',
      '.zsh': 'shell',
      '.ps1': 'powershell',
      '.dockerfile': 'dockerfile',
      '.vue': 'vue',
      '.svelte': 'svelte',
      '.astro': 'astro',
    };
    return languageMap[ext] || 'plaintext';
  }

  async searchFiles(query: string, workspacePath: string): Promise<Array<{ path: string; matches: Array<{ line: number; content: string }> }>> {
    const results: Array<{ path: string; matches: Array<{ line: number; content: string }> }> = [];
    
    const searchInDirectory = async (dirPath: string) => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          
          // Skip hidden files, node_modules, and common binary directories
          if (entry.name.startsWith('.') || 
              entry.name === 'node_modules' || 
              entry.name === 'dist' || 
              entry.name === 'build' ||
              entry.name === '.git') {
            continue;
          }

          if (entry.isDirectory()) {
            await searchInDirectory(fullPath);
          } else {
            // Check if file is text-based (skip binary files)
            const ext = path.extname(entry.name).toLowerCase();
            const binaryExts = ['.exe', '.dll', '.so', '.dylib', '.bin', '.dat', '.db', '.jpg', '.jpeg', '.png', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot'];
            if (binaryExts.includes(ext)) {
              continue;
            }

            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              const lines = content.split('\n');
              const matches: Array<{ line: number; content: string }> = [];
              
              lines.forEach((line, index) => {
                if (line.toLowerCase().includes(query.toLowerCase())) {
                  matches.push({
                    line: index + 1,
                    content: line.trim()
                  });
                }
              });

              if (matches.length > 0) {
                results.push({
                  path: fullPath,
                  matches
                });
              }
            } catch (error) {
              // Skip files that can't be read as text
            }
          }
        }
      } catch (error) {
        console.error(`Error searching directory ${dirPath}:`, error);
      }
    };

    await searchInDirectory(workspacePath);
    return results;
  }
}
