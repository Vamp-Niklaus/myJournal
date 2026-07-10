'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';

interface MonacoEditorProps {
  initialContent?: string;
  isReadOnly?: boolean;
  onChange?: (content: string) => void;
}

export function MonacoEditor({ initialContent = '', isReadOnly = false, onChange }: MonacoEditorProps) {
  const monaco = useMonaco();
  const statusRef = React.useRef<HTMLButtonElement>(null);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const currentContentRef = React.useRef(initialContent);
  
  // Clean up timeout on unmount
  useEffect(() => {
    if (monaco) {
      monaco.editor.defineTheme('myJournalTheme', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#09090b', // zinc-950
          'editor.lineHighlightBackground': '#18181b', // zinc-900
          'editorLineNumber.foreground': '#52525b', // zinc-500
          'editorIndentGuide.background': '#27272a', // zinc-800
        },
      });
      monaco.editor.setTheme('myJournalTheme');
    }
    
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [monaco]);

  const forceSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (onChange) {
      onChange(currentContentRef.current);
    }
    if (statusRef.current) {
      statusRef.current.innerText = 'All changes saved';
      statusRef.current.classList.remove('bg-emerald-500/20', 'text-emerald-400', 'hover:bg-emerald-500/30', 'cursor-pointer', 'border-emerald-500/30');
      statusRef.current.classList.add('bg-zinc-950/80', 'text-zinc-500', 'cursor-default', 'border-zinc-800');
    }
  }, [onChange]);

  const handleChange = useCallback((val: string | undefined) => {
    const currentVal = val || '';
    currentContentRef.current = currentVal;
    
    // UI Feedback immediately without React re-render
    if (statusRef.current) {
      statusRef.current.innerText = 'Save to cloud';
      statusRef.current.classList.remove('bg-zinc-950/80', 'text-zinc-500', 'cursor-default', 'border-zinc-800');
      statusRef.current.classList.add('bg-emerald-500/20', 'text-emerald-400', 'hover:bg-emerald-500/30', 'cursor-pointer', 'border-emerald-500/30');
    }
    
    // Clear any existing timeout since user is still typing
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Wait for 5 continuous seconds of no typing before dispatching
    timeoutRef.current = setTimeout(() => {
      forceSave();
    }, 5000);
    
  }, [forceSave]);

  return (
    <div className="relative w-full h-full min-h-[50vh]">
      {!isReadOnly && (
        <button 
          ref={statusRef} 
          onClick={() => {
            if (statusRef.current?.innerText === 'Save to cloud') {
              forceSave();
            }
          }}
          className="absolute -top-[52px] right-6 text-xs font-medium z-50 px-3 py-1.5 rounded-md shadow-sm border border-zinc-800 bg-zinc-900 text-zinc-500 cursor-default transition-all"
        >
          All changes saved
        </button>
      )}
      <div className="w-full h-full border border-zinc-800 rounded-lg overflow-hidden">
        <Editor
          height="100%"
        defaultLanguage="markdown"
        defaultValue={initialContent}
        onChange={handleChange}
        theme="myJournalTheme"
        options={{
          readOnly: isReadOnly,
          minimap: { enabled: false },
          fontSize: 15,
          fontFamily: 'var(--font-geist-mono), monospace',
          wordWrap: 'on',
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          padding: { top: 24, bottom: 24 },
          renderLineHighlight: 'all',
          tabSize: 2,
        }}
      />
      </div>
    </div>
  );
}
