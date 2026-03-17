import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore } from './workspaceStore';

describe('workspaceStore', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      workspacePath: null,
      fileTree: [],
      openFiles: [],
      activeFilePath: null,
      expandedFolders: new Set(),
    });
  });

  it('should have initial state', () => {
    const state = useWorkspaceStore.getState();
    expect(state.workspacePath).toBeNull();
    expect(state.fileTree).toEqual([]);
    expect(state.openFiles).toEqual([]);
    expect(state.activeFilePath).toBeNull();
  });

  it('should set workspace path and load file tree', async () => {
    const store = useWorkspaceStore.getState();
    await store.loadWorkspace('/test/path');
    
    const state = useWorkspaceStore.getState();
    expect(state.workspacePath).toBe('/test/path');
  });

  it('should toggle folder expansion', () => {
    const folderPath = '/test/folder';
    
    // 第一次 toggle - 展开
    useWorkspaceStore.getState().toggleFolder(folderPath);
    
    let state = useWorkspaceStore.getState();
    expect(state.expandedFolders.has(folderPath)).toBe(true);
    
    // 第二次 toggle - 折叠
    useWorkspaceStore.getState().toggleFolder(folderPath);
    
    state = useWorkspaceStore.getState();
    expect(state.expandedFolders.has(folderPath)).toBe(false);
  });

  it('should update file content and mark as modified', () => {
    const store = useWorkspaceStore.getState();
    
    // 先打开一个文件
    store.openFile('/test/file.ts');
    
    // 更新内容
    store.updateFileContent('/test/file.ts', 'console.log("updated")');
    
    const state = useWorkspaceStore.getState();
    const file = state.openFiles.find(f => f.path === '/test/file.ts');
    
    expect(file?.content).toBe('console.log("updated")');
    expect(file?.isModified).toBe(true);
  });

  it('should close file', async () => {
    const store = useWorkspaceStore.getState();
    
    // 打开文件
    await store.openFile('/test/file.ts');
    
    // 关闭文件
    store.closeFile('/test/file.ts');
    
    const state = useWorkspaceStore.getState();
    expect(state.openFiles).toHaveLength(0);
  });

  it('should set active file', async () => {
    const store = useWorkspaceStore.getState();
    
    // 打开文件
    await store.openFile('/test/file.ts');
    
    // 设置活动文件
    store.setActiveFile('/test/file.ts');
    
    const state = useWorkspaceStore.getState();
    expect(state.activeFilePath).toBe('/test/file.ts');
  });
});
