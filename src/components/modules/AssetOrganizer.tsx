'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Folder, Link as LinkIcon, FileText, ChevronRight, ChevronDown, Plus, MoreVertical, Search, Trash2, ArrowLeft, X, Eye } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, DragEndEvent } from '@dnd-kit/core';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { SortableContext, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { MonacoEditor } from '@/components/editor/MonacoEditor';
import { toast } from 'sonner';

const DraggableGridItem = React.forwardRef<HTMLDivElement, { node: any; isTrash?: boolean; children: React.ReactNode; onClick: () => void }>(({ node, isTrash, children, onClick }, ref) => {
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: node.id,
    data: node
  });
  
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: node.id,
    data: node
  });

  const setNodeRefs = (el: HTMLDivElement | null) => {
    setDragRef(el);
    setDropRef(el);
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };
  
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragging ? 50 : 'auto',
  } : undefined;
  
  return (
    <div 
      ref={setNodeRefs}
      style={style}
      {...listeners}
      {...attributes}
      className={`p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 transition-all group relative ${isOver && node.type === 'folder' ? 'ring-2 ring-emerald-500 bg-zinc-800' : ''} ${isTrash ? 'cursor-default' : 'hover:bg-zinc-800 !cursor-pointer'}`}
      onClick={(e) => {
        // Prevent click if we just dragged
        if (transform && (Math.abs(transform.x) > 5 || Math.abs(transform.y) > 5)) return;
        if (isTrash) return;
        onClick();
      }}
    >
      {children}
    </div>
  );
});

export function AssetOrganizer() {
  const fileSystem = useAppStore(state => state.fileSystem);
  const addNode = useAppStore(state => state.addNode);
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const currentFolderId = searchParams.get('folder') || 'root';
  
  const setCurrentFolderId = (folderId: string) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    current.set('folder', folderId);
    router.push(`${pathname}?${current.toString()}`);
  };

  const [searchQuery, setSearchQuery] = useState('');
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<'folder' | 'note' | 'link' | null>(null);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newRemark, setNewRemark] = useState('');
  const [viewingNoteId, setViewingNoteId] = useState<string | null>(null);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const notes = useAppStore(state => state.notes);
  const updateNode = useAppStore(state => state.updateNode);
  const updateNote = useAppStore(state => state.updateNote);
  const deleteNode = useAppStore(state => state.deleteNode);
  const permanentlyDeleteNode = useAppStore(state => state.permanentlyDeleteNode);
  const restoreNode = useAppStore(state => state.restoreNode);
  const moveNode = useAppStore(state => state.moveNode);
  const executePaste = useAppStore(state => state.executePaste);
  const clipboard = useAppStore(state => state.clipboard);
  const setClipboard = useAppStore(state => state.setClipboard);
  
  const currentFolder = fileSystem[currentFolderId];
  
  let childrenNodes = currentFolder?.childrenIds?.map(id => fileSystem[id]).filter(Boolean) || [];
  if (searchQuery.trim()) {
    const lowerQuery = searchQuery.toLowerCase();
    // Search within current folder recursively, or globally if in root? Let's search all descendants of current folder.
    // Simpler: Just search all files in fileSystem that are descendants of currentFolderId.
    const getDescendants = (folderId: string): any[] => {
      const folder = fileSystem[folderId];
      if (!folder || !folder.childrenIds) return [];
      const children = folder.childrenIds.map(id => fileSystem[id]).filter(Boolean);
      return [...children, ...children.filter(c => c.type === 'folder').flatMap(c => getDescendants(c.id))];
    };
    childrenNodes = getDescendants(currentFolderId).filter(n => n.name.toLowerCase().includes(lowerQuery));
  }

  // Sort children: Folders first, then Links, then Notes
  const typeOrder: Record<string, number> = { folder: 1, link: 2, note: 3 };
  childrenNodes.sort((a, b) => {
    const weightA = typeOrder[a.type] || 4;
    const weightB = typeOrder[b.type] || 4;
    if (weightA === weightB) {
      // Optional: Alphabetical sort within same type
      return a.name.localeCompare(b.name);
    }
    return weightA - weightB;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const activeNode = fileSystem[active.id as string];
      const overNode = fileSystem[over.id as string];
      if (activeNode && overNode && overNode.type === 'folder') {
        const result = moveNode(active.id as string, over.id as string);
        if (!result.success) {
          toast.error(result.error);
        }
      }
    }
  };

  const handlePaste = () => {
    const result = executePaste(currentFolderId);
    if (!result.success) {
      toast.error(result.error);
    }
  };

  // Breadcrumbs generator
  const getBreadcrumbs = () => {
    const crumbs = [];
    let currentId: string | null = currentFolderId;
    while (currentId && fileSystem[currentId]) {
      crumbs.unshift(fileSystem[currentId]);
      currentId = fileSystem[currentId].parentId;
    }
    return crumbs;
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    if (editingLinkId) {
      updateNode(editingLinkId, { name: newName, url: newUrl, remark: newRemark });
      setEditingLinkId(null);
    } else {
      const id = crypto.randomUUID();
      addNode({
        id,
        name: newName + (createType === 'note' && !newName.endsWith('.md') ? '.md' : createType === 'link' && !newName.endsWith('.url') ? '.url' : ''),
        type: createType!,
        parentId: currentFolderId,
        childrenIds: createType === 'folder' ? [] : undefined,
        url: createType === 'link' ? newUrl : undefined,
        remark: createType === 'link' ? newRemark : undefined,
        contentId: createType === 'note' ? id : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      if (createType === 'note') {
        updateNote(id, { title: newName, content: '' });
      }
    }

    setIsDialogOpen(false);
    setNewName('');
    setNewUrl('');
    setNewRemark('');
    setCreateType(null);
  };

  const SidebarContent = (
    <div className="flex flex-col h-full">
      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Directories</h3>
      <ScrollArea className="flex-1">
        <div className="space-y-1">
          <Button variant="ghost" className="w-full justify-start text-zinc-300 hover:bg-zinc-800 hover:text-white !cursor-pointer" onClick={() => { setCurrentFolderId('root'); setViewingNoteId(null); setSearchQuery(''); }}>
            <Folder className="w-4 h-4 mr-2" />
            Root
          </Button>
          <Button variant="ghost" className="w-full justify-start text-zinc-300 hover:bg-zinc-800 hover:text-white !cursor-pointer" onClick={() => { setCurrentFolderId('trash'); setViewingNoteId(null); setSearchQuery(''); }}>
            <Trash2 className="w-4 h-4 mr-2 text-red-400" />
            Trash
          </Button>
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Sidebar Tree (Desktop) */}
      <div className="w-64 bg-zinc-900 border-r border-zinc-800 p-4 hidden md:flex flex-col">
        {SidebarContent}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar: Breadcrumbs & Search */}
        <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-2 sm:px-4 bg-zinc-900/50">
          <div className="flex items-center text-sm overflow-hidden flex-1 mr-2">
            <Sheet>
              <SheetTrigger 
                className="md:hidden p-1.5 mr-2 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors !cursor-pointer flex-shrink-0"
                title="Open Directories"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 bg-zinc-900 border-zinc-800 p-4">
                <SheetTitle className="sr-only">Directories</SheetTitle>
                <div className="mt-8 h-full">
                  {SidebarContent}
                </div>
              </SheetContent>
            </Sheet>
            {!searchQuery.trim() && currentFolder?.parentId && (
              <button 
                onClick={() => setCurrentFolderId(currentFolder.parentId!)}
                className="mr-3 text-zinc-400 hover:text-white transition-colors flex items-center !cursor-pointer"
                title="Go Up"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            {searchQuery.trim() ? (
              <span className="text-zinc-400">Search Results</span>
            ) : (
              getBreadcrumbs().map((crumb, idx, arr) => (
                <div key={crumb.id} className="flex items-center flex-shrink-0">
                  <button 
                    onClick={() => setCurrentFolderId(crumb.id)}
                    className="text-zinc-400 hover:text-white transition-colors !cursor-pointer truncate max-w-[80px] sm:max-w-[150px]"
                  >
                    {crumb.name}
                  </button>
                  {idx < arr.length - 1 && <ChevronRight className="w-4 h-4 mx-0.5 sm:mx-1 text-zinc-600 flex-shrink-0" />}
                </div>
              ))
            )}
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {!searchQuery.trim() && (
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-2 sm:px-3 text-xs font-medium text-zinc-100 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-700 disabled:pointer-events-none disabled:opacity-50 !cursor-pointer">
                  <Plus className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">New</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-zinc-900 border-zinc-800 text-zinc-300">
                  <DropdownMenuItem className="cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white" onClick={() => { setCreateType('folder'); setIsDialogOpen(true); }}>
                    <Folder className="w-4 h-4 mr-2 text-zinc-400" /> Folder
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white" onClick={() => { setCreateType('note'); setIsDialogOpen(true); }}>
                    <FileText className="w-4 h-4 mr-2 text-zinc-400" /> Note (.md)
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white" onClick={() => { setCreateType('link'); setIsDialogOpen(true); }}>
                    <LinkIcon className="w-4 h-4 mr-2 text-zinc-400" /> Link (.url)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2 text-zinc-500" />
              <Input 
                placeholder="Search..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-28 sm:w-48 md:w-64 h-8 pl-8 sm:pl-9 ${searchQuery.trim() ? 'pr-8' : ''} bg-zinc-900 border-zinc-700 focus-visible:ring-zinc-700 text-xs sm:text-sm`}
              />
              {searchQuery.trim() && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300 !cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Directory Contents */}
        {viewingNoteId ? (
          <div className="flex-1 flex flex-col min-w-0 bg-zinc-950 relative">
            <div className="flex-none px-6 py-4 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm flex items-center gap-3 z-10">
              <button 
                onClick={() => setViewingNoteId(null)}
                className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors !cursor-pointer"
                title="Back to folder"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <h2 className="text-xl font-semibold text-zinc-100">{fileSystem[viewingNoteId]?.name}</h2>
            </div>
            <div className="flex-1 relative">
              <MonacoEditor 
                key={viewingNoteId}
                initialContent={notes[fileSystem[viewingNoteId]?.contentId || viewingNoteId]?.content || ''}
                onChange={(content) => updateNote(fileSystem[viewingNoteId]?.contentId || viewingNoteId, { content })}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 relative flex flex-col w-full min-h-0">
            <ContextMenu>
              <ContextMenuTrigger className="absolute inset-0 flex flex-col overflow-auto p-4 z-0 block">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 flex-1 content-start w-full">
                  {childrenNodes.map((node) => (
                    <ContextMenu key={node.id}>
                      <ContextMenuTrigger className="block w-full">
                          <DraggableGridItem node={node} isTrash={currentFolderId === 'trash'} onClick={() => {
                            if (node.type === 'folder') setCurrentFolderId(node.id);
                            if (node.type === 'note') setViewingNoteId(node.id);
                          }}>
                            <div className="flex items-start gap-3 pointer-events-none w-full">
                              {node.type === 'folder' && <Folder className="w-8 h-8 text-blue-400 flex-shrink-0" />}
                              {node.type === 'link' && <LinkIcon className="w-8 h-8 text-emerald-400 cursor-pointer pointer-events-auto flex-shrink-0" onClick={(e) => { e.stopPropagation(); window.open(node.url, '_blank'); }} />}
                              {node.type === 'note' && <FileText className="w-8 h-8 text-amber-400 flex-shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-zinc-200 truncate">{node.name}</p>
                                <p className="text-xs text-zinc-500 mt-1 uppercase tracking-wider">{node.type}</p>
                              </div>
                              {searchQuery.trim() && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentFolderId(node.parentId || 'root');
                                    setSearchQuery('');
                                  }}
                                  className="pointer-events-auto p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-md transition-colors !cursor-pointer flex-shrink-0"
                                  title="Show in folder"
                                >
                                  <Eye className="w-5 h-5" />
                                </button>
                              )}
                            </div>
                          </DraggableGridItem>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-48 bg-zinc-900 border-zinc-800 text-zinc-300">
                        {currentFolderId === 'trash' ? (
                          <>
                            <ContextMenuItem className="cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white" onClick={() => restoreNode(node.id)}>Restore</ContextMenuItem>
                            <ContextMenuItem className="cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white" onClick={() => setClipboard({ itemId: node.id, action: 'cut' })}>Cut</ContextMenuItem>
                            <ContextMenuSeparator className="bg-zinc-800" />
                            <ContextMenuItem className="cursor-pointer text-red-400 focus:bg-zinc-800 focus:text-red-300" onClick={() => permanentlyDeleteNode(node.id)}>Permanently Delete</ContextMenuItem>
                          </>
                        ) : (
                          <>
                            <ContextMenuItem className="cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white" onClick={() => { setCreateType(node.type as 'folder'|'note'|'link'); setEditingLinkId(node.id); setNewName(node.name); setNewUrl(node.url || ''); setNewRemark(node.remark || ''); setIsDialogOpen(true); }}>Rename</ContextMenuItem>
                            {node.type === 'link' && (
                              <ContextMenuItem className="cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white" onClick={() => { setCreateType('link'); setEditingLinkId(node.id); setNewName(node.name); setNewUrl(node.url || ''); setNewRemark(node.remark || ''); setIsDialogOpen(true); }}>Edit Link</ContextMenuItem>
                            )}
                            <ContextMenuItem className="cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white" onClick={() => setClipboard({ itemId: node.id, action: 'copy' })}>Copy</ContextMenuItem>
                            <ContextMenuItem className="cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white" onClick={() => setClipboard({ itemId: node.id, action: 'cut' })}>Cut</ContextMenuItem>
                            <ContextMenuSeparator className="bg-zinc-800" />
                            <ContextMenuItem className="cursor-pointer text-red-400 focus:bg-zinc-800 focus:text-red-300" onClick={() => deleteNode(node.id)}>Delete</ContextMenuItem>
                          </>
                        )}
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}
                  {childrenNodes.length === 0 && (
                    <div className="col-span-4 flex flex-col items-center justify-center py-20 text-zinc-500 pointer-events-none">
                      <Folder className="w-12 h-12 mb-4 opacity-50" />
                      <p>This folder is empty.</p>
                    </div>
                  )}
                </div>
              </DndContext>
            </ContextMenuTrigger>
          <ContextMenuContent className="w-48 bg-zinc-900 border-zinc-800 text-zinc-300">
            {currentFolderId !== 'trash' && (
              <>
                {clipboard && (
                  <>
                    <ContextMenuItem className="cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white" onClick={handlePaste}>
                      {clipboard.action === 'cut' ? 'Move Here' : 'Paste'}
                    </ContextMenuItem>
                    <ContextMenuSeparator className="bg-zinc-800" />
                  </>
                )}
                <ContextMenuItem className="cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white" onClick={() => { setCreateType('folder'); setIsDialogOpen(true); }}>New Folder</ContextMenuItem>
                <ContextMenuItem className="cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white" onClick={() => { setCreateType('note'); setIsDialogOpen(true); }}>New Note (.md)</ContextMenuItem>
                <ContextMenuItem className="cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white" onClick={() => { setCreateType('link'); setIsDialogOpen(true); }}>New Link (.url)</ContextMenuItem>
              </>
            )}
            {currentFolderId === 'trash' && (
              <div className="px-2 py-1.5 text-sm text-zinc-500">No actions available here</div>
            )}
          </ContextMenuContent>
        </ContextMenu>
          </div>
        )}
      </div>

      {/* Creation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className={createType === 'link' ? "sm:max-w-[600px] bg-zinc-900 border-zinc-800 text-white shadow-2xl" : "sm:max-w-[425px] bg-zinc-900 border-zinc-800 text-white shadow-2xl"}>
          <form onSubmit={handleCreateSubmit} className="flex flex-col h-full">
            <DialogHeader className="flex-none">
              <DialogTitle>{editingLinkId ? `Edit ${createType}` : `Create New ${createType === 'folder' ? 'Folder' : createType === 'note' ? 'Note' : 'Link'}`}</DialogTitle>
              <DialogDescription className="text-zinc-400">
                {createType === 'folder' ? 'Organize your assets by creating a new directory.' 
                 : createType === 'note' ? 'Write down your thoughts in a new markdown note.' 
                 : 'Save a bookmark with an optional remark.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2 flex-none">
                <label className="text-sm font-medium text-zinc-300">
                  {createType === 'link' ? 'Title' : 'Name'}
                </label>
                <Input 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)} 
                  className="bg-zinc-950 border-zinc-700 focus-visible:ring-zinc-600" 
                  placeholder={createType === 'folder' ? 'e.g. Work Projects' : createType === 'note' ? 'e.g. LeetCode Solution' : 'e.g. Google'}
                  required 
                  autoFocus
                />
              </div>
              
              {createType === 'link' && (
                <>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-zinc-300">URL</label>
                    <Input 
                      value={newUrl} 
                      onChange={e => setNewUrl(e.target.value)} 
                      className="bg-zinc-950 border-zinc-700 focus-visible:ring-zinc-600" 
                      placeholder="https://example.com"
                      type="url"
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-zinc-300">Remark (Optional)</label>
                    <Input 
                      value={newRemark} 
                      onChange={e => setNewRemark(e.target.value)} 
                      className="bg-zinc-950 border-zinc-700 focus-visible:ring-zinc-600" 
                      placeholder="Why are you saving this link?"
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter className="flex-none bg-transparent pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-white">
                Cancel
              </Button>
              <Button type="submit" className="bg-white text-black hover:bg-zinc-200">
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
