import { create } from 'zustand';
import { SearchResult } from '@shared/types';

interface SearchState {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  error: string | null;
  
  // Actions
  setQuery: (query: string) => void;
  search: (query: string, workspacePath: string) => Promise<void>;
  clearResults: () => void;
  clearError: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  results: [],
  isSearching: false,
  error: null,

  setQuery: (query: string) => set({ query }),

  search: async (query: string, workspacePath: string) => {
    if (!query.trim() || !workspacePath) {
      set({ results: [], query });
      return;
    }

    set({ isSearching: true, error: null, query });

    try {
      const results = await window.electronAPI?.file?.search(query, workspacePath);
      set({ results: results || [], isSearching: false });
    } catch (error) {
      set({ error: String(error), isSearching: false, results: [] });
    }
  },

  clearResults: () => set({ results: [], query: '' }),
  
  clearError: () => set({ error: null }),
}));
