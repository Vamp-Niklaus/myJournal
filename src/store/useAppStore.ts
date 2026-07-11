import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/utils/supabase/client';

export type FileType = 'folder' | 'link' | 'note';

export interface FileSystemNode {
  id: string;
  name: string;
  type: FileType;
  parentId: string | null;
  childrenIds?: string[];
  url?: string;
  remark?: string;
  contentId?: string;
  originalParentId?: string;
  synced?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoteContent {
  id: string;
  title: string;
  content: string;
  synced?: boolean;
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
  diaryEntries: Record<string, NoteContent>;
  
  addNode: (node: FileSystemNode) => void;
  updateNode: (id: string, updates: Partial<FileSystemNode>) => void;
  deleteNode: (id: string) => void;
  permanentlyDeleteNode: (id: string) => void;
  restoreNode: (id: string) => void;
  moveNode: (id: string, newParentId: string | null) => { success: boolean; error?: string };
  
  setClipboard: (state: ClipboardState | null) => void;
  executePaste: (targetParentId: string | null) => { success: boolean; error?: string };
  
  updateNote: (id: string, content: Partial<NoteContent>) => void;
  updateDiaryEntry: (dateKey: string, content: Partial<NoteContent>) => void;
  
  setFullState: (state: Pick<AppState, 'fileSystem' | 'notes' | 'diaryEntries'>) => void;
  resetState: () => void;
}

// Background Sync Helpers
const syncNodeToCloud = async (node: FileSystemNode, set: any) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      id: node.id,
      user_id: user.id,
      name: node.name,
      type: node.type,
      parent_id: node.parentId,
      children_ids: node.childrenIds || [],
      url: node.url || null,
      remark: node.remark || null,
      content_id: node.contentId || null,
      original_parent_id: node.originalParentId || null,
      synced: true,
      created_at: node.createdAt,
      updated_at: node.updatedAt,
    };

    const { error } = await supabase.from('file_system').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    
    if (node.synced === false) {
      set((state: any) => ({
        fileSystem: { ...state.fileSystem, [node.id]: { ...state.fileSystem[node.id], synced: true } }
      }));
    }
  } catch (error) {
    console.error('Failed to sync node:', node.id, error);
    set((state: any) => ({
      fileSystem: { ...state.fileSystem, [node.id]: { ...state.fileSystem[node.id], synced: false } }
    }));
  }
};

const deleteNodeFromCloud = async (id: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('file_system').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw error;
  } catch (error) {
    console.error('Failed to delete node from cloud:', id, error);
  }
};

const syncNoteToCloud = async (note: NoteContent, set: any, isDiary: boolean) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const table = isDiary ? 'diary_entries' : 'notes';
    const stateKey = isDiary ? 'diaryEntries' : 'notes';

    const payload = {
      id: note.id,
      user_id: user.id,
      title: note.title,
      content: note.content,
      synced: true,
      updated_at: note.updatedAt,
    };

    const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    
    if (note.synced === false) {
      set((state: any) => ({
        [stateKey]: { ...state[stateKey], [note.id]: { ...state[stateKey][note.id], synced: true } }
      }));
    }
  } catch (error) {
    console.error('Failed to sync ' + (isDiary ? 'diary entry' : 'note') + ':', note.id, error);
    const stateKey = isDiary ? 'diaryEntries' : 'notes';
    set((state: any) => ({
      [stateKey]: { ...state[stateKey], [note.id]: { ...state[stateKey][note.id], synced: false } }
    }));
  }
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      fileSystem: {
        'root': { id: 'root', name: 'Root', type: 'folder', parentId: null, childrenIds: [], synced: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        'trash': { id: 'trash', name: 'Trash', type: 'folder', parentId: null, childrenIds: [], synced: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      },
      notes: {},
      clipboard: null,
      diaryEntries: {},

      setFullState: (newState) => set((state) => ({ fileSystem: newState.fileSystem, notes: newState.notes, diaryEntries: newState.diaryEntries })),

      resetState: () => set({
        fileSystem: {
          'root': { id: 'root', name: 'Root', type: 'folder', parentId: null, childrenIds: [], synced: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          'trash': { id: 'trash', name: 'Trash', type: 'folder', parentId: null, childrenIds: [], synced: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        },
        notes: {}, diaryEntries: {}, clipboard: null,
      }),

      addNode: (node) => set((state) => {
        const newFs = { ...state.fileSystem, [node.id]: node };
        let parentNode = null;
        if (node.parentId && newFs[node.parentId]) {
          parentNode = { ...newFs[node.parentId], childrenIds: [...(newFs[node.parentId].childrenIds || []), node.id], updatedAt: new Date().toISOString() };
          newFs[node.parentId] = parentNode;
        }
        syncNodeToCloud(node, set);
        if (parentNode) syncNodeToCloud(parentNode, set);
        return { fileSystem: newFs };
      }),

      updateNode: (id, updates) => set((state) => {
        if (!state.fileSystem[id]) return state;
        const updatedNode = { ...state.fileSystem[id], ...updates, updatedAt: new Date().toISOString() };
        syncNodeToCloud(updatedNode, set);
        return { fileSystem: { ...state.fileSystem, [id]: updatedNode } };
      }),

      deleteNode: (id) => set((state) => {
        const node = state.fileSystem[id];
        if (!node) return state;
        const newFs = { ...state.fileSystem };
        let oldParent = null;
        if (node.parentId && newFs[node.parentId]) {
          oldParent = { ...newFs[node.parentId], childrenIds: (newFs[node.parentId].childrenIds || []).filter(cId => cId !== id), updatedAt: new Date().toISOString() };
          newFs[node.parentId] = oldParent;
        }
        const trashedNode = { ...node, parentId: 'trash', originalParentId: node.parentId || 'root', updatedAt: new Date().toISOString() };
        newFs[id] = trashedNode;
        const newParent = { ...newFs['trash'], childrenIds: [...(newFs['trash'].childrenIds || []), id], updatedAt: new Date().toISOString() };
        newFs['trash'] = newParent;
        syncNodeToCloud(trashedNode, set);
        if (oldParent) syncNodeToCloud(oldParent, set);
        syncNodeToCloud(newParent, set);
        return { fileSystem: newFs };
      }),

      permanentlyDeleteNode: (id) => set((state) => {
        const node = state.fileSystem[id];
        if (!node) return state;
        const newFs = { ...state.fileSystem };
        let oldParent = null;
        if (node.parentId && newFs[node.parentId]) {
          oldParent = { ...newFs[node.parentId], childrenIds: (newFs[node.parentId].childrenIds || []).filter(cId => cId !== id), updatedAt: new Date().toISOString() };
          newFs[node.parentId] = oldParent;
        }
        delete newFs[id];
        deleteNodeFromCloud(id);
        if (oldParent) syncNodeToCloud(oldParent, set);
        const newNotes = { ...state.notes };
        if (node.contentId) {
          delete newNotes[node.contentId];
          supabase.from('notes').delete().eq('id', node.contentId).then();
        }
        return { fileSystem: newFs, notes: newNotes };
      }),

      restoreNode: (id) => set((state) => {
        const node = state.fileSystem[id];
        if (!node) return state;
        const newFs = { ...state.fileSystem };
        let oldParent = null;
        if (node.parentId && newFs[node.parentId]) {
          oldParent = { ...newFs[node.parentId], childrenIds: (newFs[node.parentId].childrenIds || []).filter(cId => cId !== id), updatedAt: new Date().toISOString() };
          newFs[node.parentId] = oldParent;
        }
        let targetId = node.originalParentId || 'root';
        if (!newFs[targetId]) targetId = 'root';
        const restoredNode = { ...node, parentId: targetId, originalParentId: undefined, updatedAt: new Date().toISOString() };
        newFs[id] = restoredNode;
        const newParent = { ...newFs[targetId], childrenIds: [...(newFs[targetId].childrenIds || []), id], updatedAt: new Date().toISOString() };
        newFs[targetId] = newParent;
        syncNodeToCloud(restoredNode, set);
        if (oldParent) syncNodeToCloud(oldParent, set);
        syncNodeToCloud(newParent, set);
        return { fileSystem: newFs };
      }),

      moveNode: (id, newParentId) => {
        let result: { success: boolean; error?: string } = { success: true };
        set((state) => {
          const node = state.fileSystem[id];
          if (!node || node.parentId === newParentId) return state;
          let currId = newParentId;
          while (currId) {
            if (currId === id) { result = { success: false, error: 'The destination folder is a subfolder of the source folder.' }; return state; }
            currId = state.fileSystem[currId]?.parentId || null;
          }
          const newFs = { ...state.fileSystem };
          let oldParent = null;
          if (node.parentId && newFs[node.parentId]) {
            oldParent = { ...newFs[node.parentId], childrenIds: (newFs[node.parentId].childrenIds || []).filter(cId => cId !== id), updatedAt: new Date().toISOString() };
            newFs[node.parentId] = oldParent;
          }
          let newParent = null;
          if (newParentId && newFs[newParentId]) {
            newParent = { ...newFs[newParentId], childrenIds: [...(newFs[newParentId].childrenIds || []), id], updatedAt: new Date().toISOString() };
            newFs[newParentId] = newParent;
          }
          const movedNode = { ...node, parentId: newParentId, updatedAt: new Date().toISOString() };
          newFs[id] = movedNode;
          syncNodeToCloud(movedNode, set);
          if (oldParent) syncNodeToCloud(oldParent, set);
          if (newParent) syncNodeToCloud(newParent, set);
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
          if (!sourceNode) return { clipboard: null };
          let currId = targetParentId;
          while (currId) {
            if (currId === sourceNode.id) { result = { success: false, error: 'The destination folder is a subfolder of the source folder.' }; return state; }
            currId = fileSystem[currId]?.parentId || null;
          }
          if (clipboard.action === 'cut') {
            if (sourceNode.parentId === targetParentId) return { clipboard: null };
            const newFs = { ...fileSystem };
            let oldParent = null;
            if (sourceNode.parentId && newFs[sourceNode.parentId]) {
              oldParent = { ...newFs[sourceNode.parentId], childrenIds: (newFs[sourceNode.parentId].childrenIds || []).filter(id => id !== sourceNode.id), updatedAt: new Date().toISOString() };
              newFs[sourceNode.parentId] = oldParent;
            }
            let newParent = null;
            if (targetParentId && newFs[targetParentId]) {
              newParent = { ...newFs[targetParentId], childrenIds: [...(newFs[targetParentId].childrenIds || []), sourceNode.id], updatedAt: new Date().toISOString() };
              newFs[targetParentId] = newParent;
            }
            const pastedNode = { ...sourceNode, parentId: targetParentId, updatedAt: new Date().toISOString() };
            newFs[sourceNode.id] = pastedNode;
            syncNodeToCloud(pastedNode, set);
            if (oldParent) syncNodeToCloud(oldParent, set);
            if (newParent) syncNodeToCloud(newParent, set);
            return { fileSystem: newFs, clipboard: null };
          } else {
            const newId = crypto.randomUUID();
            const newFs = { ...fileSystem };
            let newParent = null;
            const copiedNode = { ...sourceNode, id: newId, name: sourceNode.name + ' (Copy)', parentId: targetParentId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            newFs[newId] = copiedNode;
            if (targetParentId && newFs[targetParentId]) {
              newParent = { ...newFs[targetParentId], childrenIds: [...(newFs[targetParentId].childrenIds || []), newId], updatedAt: new Date().toISOString() };
              newFs[targetParentId] = newParent;
            }
            syncNodeToCloud(copiedNode, set);
            if (newParent) syncNodeToCloud(newParent, set);
            return { fileSystem: newFs };
          }
        });
        return result as any;
      },

      updateNote: (id, content) => set((state) => {
        const updatedNote = { ...(state.notes[id] || { id, title: '', content: '', updatedAt: new Date().toISOString() }), ...content, updatedAt: new Date().toISOString() };
        syncNoteToCloud(updatedNote, set, false);
        return { notes: { ...state.notes, [id]: updatedNote } };
      }),

      updateDiaryEntry: (dateKey, content) => set((state) => {
        const updatedDiary = { ...(state.diaryEntries[dateKey] || { id: dateKey, title: dateKey, content: '', updatedAt: new Date().toISOString() }), ...content, updatedAt: new Date().toISOString() };
        syncNoteToCloud(updatedDiary, set, true);
        return { diaryEntries: { ...state.diaryEntries, [dateKey]: updatedDiary } };
      }),
    }),
    {
      name: 'unified-organizer-storage',
    }
  )
);
