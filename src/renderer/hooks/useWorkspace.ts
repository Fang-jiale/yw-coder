import { useCallback, useEffect } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';

export function useWorkspace() {
  const {
    workspacePath,
    fileTree,
    openFiles,
    activeFilePath,
    loadWorkspace,
    refreshFileTree,
    openFile,
    closeFile,
    setActiveFile,
    updateFileContent,
    saveFile,
  } = useWorkspaceStore();

  const handleOpenFolder = useCallback(async () => {
    try {
      const result = await window.electronAPI?.app?.showOpenDialog({
        properties: ['openDirectory'],
      });

      if (result && !result.canceled && result.filePaths.length > 0) {
        const path = result.filePaths[0];
        loadWorkspace(path);
        localStorage.setItem('lastWorkspace', path);
        return path;
      }
    } catch (error) {
      console.error('Failed to open folder:', error);
    }
    return null;
  }, [loadWorkspace]);

  const restoreLastWorkspace = useCallback(() => {
    const savedWorkspace = localStorage.getItem('lastWorkspace');
    if (savedWorkspace) {
      loadWorkspace(savedWorkspace);
      return savedWorkspace;
    }
    return null;
  }, [loadWorkspace]);

  useEffect(() => {
    restoreLastWorkspace();
  }, [restoreLastWorkspace]);

  return {
    workspacePath,
    fileTree,
    openFiles,
    activeFilePath,
    handleOpenFolder,
    refreshFileTree,
    openFile,
    closeFile,
    setActiveFile,
    updateFileContent,
    saveFile,
  };
}
