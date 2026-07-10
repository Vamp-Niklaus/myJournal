'use client';

import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { subDays, isAfter, isSameDay, startOfDay } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Lock } from 'lucide-react';
import { MonacoEditor } from '@/components/editor/MonacoEditor';
import { useAppStore } from '@/store/useAppStore';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';

export function DailyDiary() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // The 10-Day Time Lock Rule
  const today = startOfDay(new Date());
  const tenDaysAgo = subDays(today, 10);
  
  const isFuture = date ? isAfter(startOfDay(date), today) && !isSameDay(date, today) : false;
  const isArchived = date ? isAfter(tenDaysAgo, startOfDay(date)) : false;
  const isActive = date ? !isFuture && !isArchived : false;

  const dateKey = date ? date.toISOString().split('T')[0] : '';
  const diaryEntries = useAppStore((state) => state.diaryEntries);
  const updateDiaryEntry = useAppStore((state) => state.updateDiaryEntry);

  const currentEntry = diaryEntries[dateKey];

  const CalendarSidebarContent = (
    <>
      <Calendar
        mode="single"
        showOutsideDays={false}
        selected={date}
        onSelect={(newDate) => setDate(newDate || new Date())}
        className="dark rounded-md border-zinc-800 bg-zinc-950 text-zinc-100"
        classNames={{
          day: "!cursor-pointer h-9 w-9 p-0 font-normal aria-selected:opacity-100 text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-md transition-colors",
          day_button: "!cursor-pointer w-full h-full flex items-center justify-center",
          selected: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 hover:text-zinc-900 focus:bg-zinc-100 focus:text-zinc-900",
          today: "bg-zinc-800 text-white",
          button_next: "!cursor-pointer hover:bg-zinc-800 rounded-md transition-colors",
          button_previous: "!cursor-pointer hover:bg-zinc-800 rounded-md transition-colors",
        }}
      />
      
      <div className="mt-8 space-y-4 px-2">
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Status</h3>
        <div className="flex items-center gap-2 text-sm">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
          <span className={isActive ? 'text-zinc-200' : 'text-zinc-500'}>
            {isActive ? 'Active & Editable' : isArchived ? 'Archived (Read-Only)' : 'Locked (Future)'}
          </span>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Calendar Sidebar (Desktop) */}
      {isSidebarOpen && (
        <Card className="w-80 p-4 shrink-0 bg-zinc-900 border-zinc-800 shadow-2xl hidden md:flex flex-col">
          {CalendarSidebarContent}
        </Card>
      )}

      {/* Editor Canvas */}
      <div className="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden relative shadow-2xl flex flex-col">
        {/* Sticky Header */}
        <div className="flex-none px-6 py-4 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm flex items-center justify-between z-10">
          <div className="flex items-center gap-2 md:gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden md:block p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors !cursor-pointer flex-shrink-0"
              title="Toggle Calendar Sidebar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
              </svg>
            </button>
            <Sheet>
              <SheetTrigger 
                className="md:hidden p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors !cursor-pointer flex-shrink-0"
                title="Open Calendar"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 bg-zinc-900 border-zinc-800 p-6 flex flex-col items-center">
                <SheetTitle className="sr-only">Calendar Navigation</SheetTitle>
                <div className="mt-8 w-full flex flex-col">
                  {CalendarSidebarContent}
                </div>
              </SheetContent>
            </Sheet>
            
            <h1 className="text-base sm:text-xl font-semibold text-zinc-100 truncate">
              {date?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </h1>
          </div>
          {isArchived && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-500 bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/20">
              <Lock className="w-3.5 h-3.5" />
              Read-Only
            </div>
          )}
        </div>

        {isFuture ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 bg-zinc-950/50">
            <Lock className="w-12 h-12 mb-4 text-zinc-600" />
            <p className="text-lg font-medium">This date is in the future</p>
            <p className="text-sm mt-1">Check back later to write your entry.</p>
          </div>
        ) : (
          <div className={`flex-1 relative ${isArchived ? 'opacity-90' : ''}`}>
            <MonacoEditor 
              key={dateKey}
              initialContent={currentEntry?.content || ''}
              isReadOnly={isArchived}
              onChange={(content) => updateDiaryEntry(dateKey, { content })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
