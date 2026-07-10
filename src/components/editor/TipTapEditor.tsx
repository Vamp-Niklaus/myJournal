'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useState, useCallback } from 'react';

interface TipTapEditorProps {
  initialContent?: any[];
  isReadOnly?: boolean;
  onChange?: (blocks: any[]) => void;
}

export function TipTapEditor({ initialContent, isReadOnly = false, onChange }: TipTapEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent ? { type: 'doc', content: initialContent } : '',
    editable: !isReadOnly,
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-zinc prose-p:leading-relaxed max-w-none focus:outline-none min-h-[50vh]',
      },
    },
    onUpdate: ({ editor }) => {
      setIsSaving(true);
      const json = editor.getJSON();
      if (onChange) {
        onChange(json.content || []);
      }
    },
  });

  // Debounced save indicator
  useEffect(() => {
    if (!isSaving) return;
    const timeout = setTimeout(() => {
      setIsSaving(false);
    }, 1500);
    return () => clearTimeout(timeout);
  }, [isSaving]);

  // Update editable state if read-only prop changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!isReadOnly);
    }
  }, [editor, isReadOnly]);

  return (
    <div className="relative">
      {!isReadOnly && (
        <div className="absolute -top-12 right-0 text-xs text-zinc-500 font-medium">
          {isSaving ? 'Saving...' : 'All changes saved'}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
