'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Calculator, Calendar, FileText, Link as LinkIcon, Folder, Smile, Settings, User } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  
  const fileSystem = useAppStore(state => state.fileSystem);
  const diaryEntries = useAppStore(state => state.diaryEntries);
  const notes = useAppStore(state => state.notes);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Format search items
  const fsItems = Object.values(fileSystem).filter(n => n.id !== 'root' && n.id !== 'trash');
  const diaryItems = Object.values(diaryEntries);

  return (
    <>
      <div className="fixed bottom-4 right-4 text-xs text-zinc-500 flex items-center gap-1 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800 backdrop-blur-sm shadow-xl z-50 pointer-events-none">
        <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">Ctrl</kbd> + <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">K</kbd> to search
      </div>
      
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search for links, notes, folders..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          
          {fsItems.length > 0 && (
            <CommandGroup heading="Asset Organizer">
              {fsItems.map((item) => (
                <CommandItem key={item.id} onSelect={() => {
                  setOpen(false);
                  // In a real app we would navigate to the folder or open the note
                  console.log('Selected', item.name);
                }}>
                  {item.type === 'folder' && <Folder className="mr-2 h-4 w-4 text-blue-400" />}
                  {item.type === 'link' && <LinkIcon className="mr-2 h-4 w-4 text-emerald-400" />}
                  {item.type === 'note' && <FileText className="mr-2 h-4 w-4 text-amber-400" />}
                  <span>{item.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {diaryItems.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Daily Diary">
                {diaryItems.map((entry) => (
                  <CommandItem key={entry.id} onSelect={() => {
                    setOpen(false);
                    console.log('Selected Diary', entry.title);
                  }}>
                    <Calendar className="mr-2 h-4 w-4 text-purple-400" />
                    <span>{entry.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
