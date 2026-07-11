import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FileType = 'folder' | 'link' | 'note';

export interface FileSystemNode {
  id: string;
  name: string;
  type: FileType;
  parentId: string | null; // null for root level
  childrenIds?: string[];  // For folders
  url?: string;            // For links
  remark?: string;         // For links
  contentId?: string;      // For notes (links to a NoteContent)
  originalParentId?: string; // To support Restore from trash
  createdAt: string;
  updatedAt: string;
}

export interface NoteContent {
  id: string;
  title: string;
  content: string; // Markdown / Text content for Monaco Editor
  updatedAt: string;
}

export interface ClipboardState {
  itemId: string;
  action: 'copy' | 'cut';
}

interface AppState {
  fileSystem: Record<string, FileSystemNode>;
  notes: Record<string, NoteContent>;
  clipboard: ClipboardState | null;
  diaryEntries: Record<string, NoteContent>; // Keyed by YYYY-MM-DD
  
  // Actions
  addNode: (node: FileSystemNode) => void;
  updateNode: (id: string, updates: Partial<FileSystemNode>) => void;
  deleteNode: (id: string) => void; // Moves to trash
  permanentlyDeleteNode: (id: string) => void; // Wipes from DB
  restoreNode: (id: string) => void; // Moves back to originalParentId
  moveNode: (id: string, newParentId: string | null) => { success: boolean; error?: string };
  
  setClipboard: (state: ClipboardState | null) => void;
  executePaste: (targetParentId: string | null) => { success: boolean; error?: string };
  
  updateNote: (id: string, content: Partial<NoteContent>) => void;
  updateDiaryEntry: (dateKey: string, content: Partial<NoteContent>) => void;
  
  setFullState: (state: Pick<AppState, 'fileSystem' | 'notes' | 'diaryEntries'>) => void;
  resetState: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      fileSystem: {
        'root': {
          id: 'root',
          name: 'Root',
          type: 'folder',
          parentId: null,
          childrenIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        'trash': {
          id: 'trash',
          name: 'Trash',
          type: 'folder',
          parentId: null,
          childrenIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      },
      notes: {},
      clipboard: null,
      diaryEntries: {},

      setFullState: (newState) => set((state) => ({
        fileSystem: newState.fileSystem,
        notes: newState.notes,
        diaryEntries: newState.diaryEntries,
      })),

      resetState: () => set({
        fileSystem: {
          'root': {
            id: 'root',
            name: 'Root',
            type: 'folder',
            parentId: null,
            childrenIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          'trash': {
            id: 'trash',
            name: 'Trash',
            type: 'folder',
            parentId: null,
            childrenIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        },
        notes: {},
        diaryEntries: {},
        clipboard: null,
      }),

      addNode: (node) => set((state) => {
        const newFs = { ...state.fileSystem, [node.id]: node };
        if (node.parentId && newFs[node.parentId]) {
          newFs[node.parentId] = {
            ...newFs[node.parentId],
            childrenIds: [...(newFs[node.parentId].childrenIds || []), node.id]
          };
        }
        return { fileSystem: newFs };
      }),

      updateNode: (id, updates) => set((state) => {
        if (!state.fileSystem[id]) return state;
        return {
          fileSystem: {
            ...state.fileSystem,
            [id]: { ...state.fileSystem[id], ...updates, updatedAt: new Date().toISOString() }
          }
        };
      }),

      deleteNode: (id) => set((state) => {
        const node = state.fileSystem[id];
        if (!node) return state;
        
        const newFs = { ...state.fileSystem };
        
        // Remove from current parent
        if (node.parentId && newFs[node.parentId]) {
          newFs[node.parentId] = {
            ...newFs[node.parentId],
            childrenIds: (newFs[node.parentId].childrenIds || []).filter(cId => cId !== id)
          };
        }
        
        // Move to trash
        newFs[id] = { ...node, parentId: 'trash', originalParentId: node.parentId || 'root', updatedAt: new Date().toISOString() };
        newFs['trash'] = {
          ...newFs['trash'],
          childrenIds: [...(newFs['trash'].childrenIds || []), id]
        };
        
        return { fileSystem: newFs };
      }),

      permanentlyDeleteNode: (id) => set((state) => {
        const node = state.fileSystem[id];
        if (!node) return state;
        const newFs = { ...state.fileSystem };
        
        if (node.parentId && newFs[node.parentId]) {
          newFs[node.parentId] = {
            ...newFs[node.parentId],
            childrenIds: (newFs[node.parentId].childrenIds || []).filter(cId => cId !== id)
          };
        }
        delete newFs[id];
        
        const newNotes = { ...state.notes };
        if (node.contentId) delete newNotes[node.contentId];
        
        return { fileSystem: newFs, notes: newNotes };
      }),

      restoreNode: (id) => set((state) => {
        const node = state.fileSystem[id];
        if (!node) return state;
        
        const newFs = { ...state.fileSystem };
        
        // Remove from trash
        if (node.parentId && newFs[node.parentId]) {
          newFs[node.parentId] = {
            ...newFs[node.parentId],
            childrenIds: (newFs[node.parentId].childrenIds || []).filter(cId => cId !== id)
          };
        }
        
        // Determine restore target
        let targetId = node.originalParentId || 'root';
        if (!newFs[targetId]) targetId = 'root'; // Fallback if original folder was deleted
        
        newFs[id] = { ...node, parentId: targetId, originalParentId: undefined, updatedAt: new Date().toISOString() };
        newFs[targetId] = {
          ...newFs[targetId],
          childrenIds: [...(newFs[targetId].childrenIds || []), id]
        };
        
        return { fileSystem: newFs };
      }),

      moveNode: (id, newParentId) => {
        let result: { success: boolean; error?: string } = { success: true };
        set((state) => {
          const node = state.fileSystem[id];
          if (!node || node.parentId === newParentId) return state;

          // Circular dependency check
          let currId = newParentId;
          while (currId) {
            if (currId === id) {
              result = { success: false, error: 'The destination folder is a subfolder of the source folder.' };
              return state;
            }
            currId = state.fileSystem[currId]?.parentId || null;
          }

          const newFs = { ...state.fileSystem };

          // Remove from old parent
          if (node.parentId && newFs[node.parentId]) {
            newFs[node.parentId] = {
              ...newFs[node.parentId],
              childrenIds: (newFs[node.parentId].childrenIds || []).filter(cId => cId !== id)
            };
          }

          // Add to new parent
          if (newParentId && newFs[newParentId]) {
            newFs[newParentId] = {
              ...newFs[newParentId],
              childrenIds: [...(newFs[newParentId].childrenIds || []), id]
            };
          }

          newFs[id] = { ...node, parentId: newParentId, updatedAt: new Date().toISOString() };
          return { fileSystem: newFs };
        });
        return result as any;
      },
      setClipboard: (clipboardState) => set({ clipboard: clipboardState }),

      executePaste: (targetParentId) => {
        let result: { success: boolean; error?: string } = { success: true };
        set((state) => {
          const { clipboard, fileSystem } = state;
          if (!clipboard) return state;

          const sourceNode = fileSystem[clipboard.itemId];
          if (!sourceNode) return { clipboard: null }; // Source deleted

          // Circular dependency check
          let currId = targetParentId;
          while (currId) {
            if (currId === sourceNode.id) {
              result = { success: false, error: 'The destination folder is a subfolder of the source folder.' };
              return state;
            }
            currId = fileSystem[currId]?.parentId || null;
          }

          if (clipboard.action === 'cut') {
            // Re-use moveNode logic internally
            if (sourceNode.parentId === targetParentId) {
              return { clipboard: null };
            }
            
            const newFs = { ...fileSystem };
            if (sourceNode.parentId && newFs[sourceNode.parentId]) {
              newFs[sourceNode.parentId] = {
                ...newFs[sourceNode.parentId],
                childrenIds: (newFs[sourceNode.parentId].childrenIds || []).filter(id => id !== sourceNode.id)
              };
            }
            
            if (targetParentId && newFs[targetParentId]) {
              newFs[targetParentId] = {
                ...newFs[targetParentId],
                childrenIds: [...(newFs[targetParentId].childrenIds || []), sourceNode.id]
              };
            }
            
            newFs[sourceNode.id] = { ...sourceNode, parentId: targetParentId, updatedAt: new Date().toISOString() };
            return { fileSystem: newFs, clipboard: null };
          } 
          else {
            // Copy action (recursive deep copy logic would be complex, doing shallow copy for now)
            const newId = crypto.randomUUID();
            const newFs = { ...fileSystem };
            
            newFs[newId] = {
              ...sourceNode,
              id: newId,
              name: `${sourceNode.name} (Copy)`,
              parentId: targetParentId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            
            if (targetParentId && newFs[targetParentId]) {
              newFs[targetParentId] = {
                ...newFs[targetParentId],
                childrenIds: [...(newFs[targetParentId].childrenIds || []), newId]
              };
            }
            return { fileSystem: newFs }; // Keep clipboard for multiple pastes
          }
        });
        return result as any;
      },

      updateNote: (id, content) => set((state) => ({
        notes: {
          ...state.notes,
          [id]: { ...(state.notes[id] || { id, title: '', content: '', updatedAt: new Date().toISOString() }), ...content, updatedAt: new Date().toISOString() }
        }
      })),

      updateDiaryEntry: (dateKey, content) => set((state) => ({
        diaryEntries: {
          ...state.diaryEntries,
          [dateKey]: { ...(state.diaryEntries[dateKey] || { id: dateKey, title: dateKey, content: '', updatedAt: new Date().toISOString() }), ...content, updatedAt: new Date().toISOString() }
        }
      })),
    }),
    {
      name: 'unified-organizer-storage',
      // We will eventually add a middleware or effect to sync this with Supabase
    }
  )
);
