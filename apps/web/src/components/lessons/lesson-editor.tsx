"use client";

import { useEffect, useRef } from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";

type LessonEditorProps = {
  initialContent: JSONContent | null;
  editable: boolean;
  onChange: (content: JSONContent) => void;
};

export function LessonEditor({ initialContent, editable, onChange }: LessonEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    editable,
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({
        placeholder: "Write the lesson — what happened, impact, recommendation…",
      }),
    ],
    content: initialContent ?? undefined,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[240px]",
      },
    },
    onUpdate: ({ editor }) => onChangeRef.current(editor.getJSON()),
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) {
    return null;
  }

  return <EditorContent editor={editor} />;
}
