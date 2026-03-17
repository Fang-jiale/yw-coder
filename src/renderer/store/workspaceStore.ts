import { create } from 'zustand';
import { FileNode, OpenFile } from '@shared/types';

interface WorkspaceState {
  workspacePath: string | null;
  fileTree: FileNode[];
  openFiles: OpenFile[];
  activeFilePath: string | null;
  expandedFolders: Set<string>;
  
  // Actions
  loadWorkspace: (path: string) => Promise<void>;
  refreshFileTree: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  closeFile: (path: string) => void;
  setActiveFile: (path: string) => void;
  reorderFiles: (fromIndex: number, toIndex: number) => void;
  updateFileContent: (path: string, content: string) => void;
  saveFile: (path: string) => Promise<void>;
  toggleFolder: (path: string) => void;
  createFile: (path: string, isDirectory: boolean) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  renameFile: (oldPath: string, newPath: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspacePath: null,
  fileTree: [],
  openFiles: [],
  activeFilePath: null,
  expandedFolders: new Set(),

  loadWorkspace: async (path: string) => {
    set({ workspacePath: path });
    await get().refreshFileTree();
  },

  refreshFileTree: async () => {
    const { workspacePath } = get();
    if (!workspacePath) return;

    try {
      const tree = await window.electronAPI?.file?.getTree(workspacePath);
      if (tree) {
        set({ fileTree: tree });
      }
    } catch (error) {
      console.error('Failed to load file tree:', error);
    }
  },

  openFile: async (path: string, initialContent?: string) => {
    const { openFiles } = get();
    
    // Check if file is already open
    const existingFile = openFiles.find(f => f.path === path);
    if (existingFile) {
      set({ activeFilePath: path });
      return;
    }

    try {
      // Try to read file, if it doesn't exist, use initialContent or empty string
      let content = initialContent || '';
      try {
        const fileContent = await window.electronAPI?.file?.read(path);
        if (fileContent !== undefined) {
          content = fileContent;
        }
      } catch (readError) {
        // File doesn't exist, will create it with initialContent or empty content
        console.log('File does not exist, creating new file:', path);
      }
      
      const name = path.split('/').pop() || path.split('\\').pop() || '';
      const ext = name.split('.').pop() || '';
      
      const languageMap: Record<string, string> = {
        'js': 'javascript',
        'jsx': 'javascript',
        'ts': 'typescript',
        'tsx': 'typescript',
        'py': 'python',
        'java': 'java',
        'html': 'html',
        'css': 'css',
        'json': 'json',
        'md': 'markdown',
      };

      const newFile: OpenFile = {
        path,
        name,
        content: content,
        isModified: !!initialContent,
        language: languageMap[ext] || 'plaintext',
      };

      set({
        openFiles: [...openFiles, newFile],
        activeFilePath: path,
      });
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  },

  closeFile: (path: string) => {
    const { openFiles, activeFilePath } = get();
    const newOpenFiles = openFiles.filter(f => f.path !== path);
    
    let newActivePath = activeFilePath;
    if (activeFilePath === path) {
      newActivePath = newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1].path : null;
    }

    set({
      openFiles: newOpenFiles,
      activeFilePath: newActivePath,
    });
  },

  setActiveFile: (path: string) => {
    set({ activeFilePath: path });
  },

  reorderFiles: (fromIndex: number, toIndex: number) => {
    const { openFiles } = get();
    if (fromIndex < 0 || fromIndex >= openFiles.length || toIndex < 0 || toIndex >= openFiles.length) {
      return;
    }
    
    const newFiles = [...openFiles];
    const [removed] = newFiles.splice(fromIndex, 1);
    newFiles.splice(toIndex, 0, removed);
    
    set({ openFiles: newFiles });
  },

  updateFileContent: (path: string, content: string) => {
    const { openFiles } = get();
    const newOpenFiles = openFiles.map(f => {
      if (f.path === path) {
        return { ...f, content, isModified: f.content !== content };
      }
      return f;
    });
    set({ openFiles: newOpenFiles });
  },

  saveFile: async (path: string) => {
    const { openFiles } = get();
    const file = openFiles.find(f => f.path === path);
    if (!file) return;

    try {
      await window.electronAPI?.file?.write(path, file.content);
      
      const newOpenFiles = openFiles.map(f => {
        if (f.path === path) {
          return { ...f, isModified: false };
        }
        return f;
      });
      set({ openFiles: newOpenFiles });
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  },

  toggleFolder: (path: string) => {
    const { expandedFolders } = get();
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    set({ expandedFolders: newExpanded });
  },

  createFile: async (filePath: string, isDirectory: boolean) => {
    try {
      await window.electronAPI?.file?.create(filePath, isDirectory);
      await get().refreshFileTree();
    } catch (error) {
      console.error('Failed to create file:', error);
    }
  },

  deleteFile: async (filePath: string) => {
    try {
      await window.electronAPI?.file?.delete(filePath);
      
      // Close file if it's open
      const { openFiles } = get();
      if (openFiles.some(f => f.path === filePath)) {
        get().closeFile(filePath);
      }
      
      await get().refreshFileTree();
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  },

  renameFile: async (oldPath: string, newPath: string) => {
    try {
      await window.electronAPI?.file?.rename(oldPath, newPath);
      
      // Update open file path if renamed file is open
      const { openFiles, activeFilePath } = get();
      const newOpenFiles = openFiles.map(f => {
        if (f.path === oldPath) {
          return { ...f, path: newPath, name: newPath.split('/').pop() || newPath.split('\\').pop() || '' };
        }
        return f;
      });
      
      set({
        openFiles: newOpenFiles,
        activeFilePath: activeFilePath === oldPath ? newPath : activeFilePath,
      });
      
      await get().refreshFileTree();
    } catch (error) {
      console.error('Failed to rename file:', error);
    }
  },
}));
