import { create } from 'zustand';

interface CodeSelection {
  filePath: string;
  code: string;
  startLine: number;
  endLine: number;
  language: string;
}

interface CodeEdit {
  id: string;
  filePath: string;
  originalCode: string;
  suggestedCode: string;
  description: string;
  language: string;
  applied: boolean;
}

interface CodeEditorState {
  // Current selection
  selection: CodeSelection | null;
  
  // Pending edits
  pendingEdits: CodeEdit[];
  
  // Actions
  setSelection: (selection: CodeSelection | null) => void;
  clearSelection: () => void;
  
  // Edit management
  addEdit: (edit: Omit<CodeEdit, 'id' | 'applied'>) => string;
  applyEdit: (editId: string) => void;
  rejectEdit: (editId: string) => void;
  clearEdits: () => void;
  
  // Getters
  getPendingEdits: () => CodeEdit[];
  getEditById: (id: string) => CodeEdit | undefined;
}

export const useCodeEditorStore = create<CodeEditorState>((set, get) => ({
  selection: null,
  pendingEdits: [],

  setSelection: (selection) => {
    set({ selection });
  },

  clearSelection: () => {
    set({ selection: null });
  },

  addEdit: (edit) => {
    const id = `edit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newEdit: CodeEdit = {
      ...edit,
      id,
      applied: false,
    };
    set((state) => ({
      pendingEdits: [...state.pendingEdits, newEdit],
    }));
    return id;
  },

  applyEdit: (editId) => {
    set((state) => ({
      pendingEdits: state.pendingEdits.map((edit) =>
        edit.id === editId ? { ...edit, applied: true } : edit
      ),
    }));
  },

  rejectEdit: (editId) => {
    set((state) => ({
      pendingEdits: state.pendingEdits.filter((edit) => edit.id !== editId),
    }));
  },

  clearEdits: () => {
    set({ pendingEdits: [] });
  },

  getPendingEdits: () => {
    return get().pendingEdits.filter((edit) => !edit.applied);
  },

  getEditById: (id) => {
    return get().pendingEdits.find((edit) => edit.id === id);
  },
}));
