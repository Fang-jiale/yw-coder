import { create } from 'zustand';

export interface CodeAction {
  id: string;
  type: 'apply' | 'diff' | 'explain' | 'review';
  originalCode: string;
  suggestedCode: string;
  language: string;
  fileName: string;
  description: string;
  status: 'pending' | 'applied' | 'rejected';
}

interface CodeActionState {
  actions: CodeAction[];
  currentAction: CodeAction | null;
  showDiffViewer: boolean;
  
  // Actions
  createAction: (action: Omit<CodeAction, 'id' | 'status'>) => string;
  setCurrentAction: (action: CodeAction | null) => void;
  applyAction: (id: string) => void;
  rejectAction: (id: string) => void;
  showDiff: (id: string) => void;
  hideDiff: () => void;
  clearActions: () => void;
}

export const useCodeActionStore = create<CodeActionState>((set, get) => ({
  actions: [],
  currentAction: null,
  showDiffViewer: false,

  createAction: (action) => {
    const id = Math.random().toString(36).substring(2, 15);
    const newAction: CodeAction = {
      ...action,
      id,
      status: 'pending',
    };
    
    set((state) => ({
      actions: [...state.actions, newAction],
      currentAction: newAction,
      showDiffViewer: true,
    }));
    
    return id;
  },

  setCurrentAction: (action) => {
    set({ currentAction: action });
  },

  applyAction: (id) => {
    set((state) => ({
      actions: state.actions.map((action) =>
        action.id === id ? { ...action, status: 'applied' } : action
      ),
      showDiffViewer: false,
    }));
  },

  rejectAction: (id) => {
    set((state) => ({
      actions: state.actions.map((action) =>
        action.id === id ? { ...action, status: 'rejected' } : action
      ),
      showDiffViewer: false,
    }));
  },

  showDiff: (id) => {
    const action = get().actions.find((a) => a.id === id);
    if (action) {
      set({
        currentAction: action,
        showDiffViewer: true,
      });
    }
  },

  hideDiff: () => {
    set({ showDiffViewer: false });
  },

  clearActions: () => {
    set({ actions: [], currentAction: null, showDiffViewer: false });
  },
}));
