"use client";
import { useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@multica/ui/components/ui/button";
import { ArrowUp, Square } from "lucide-react";
import { cn } from "@multica/ui/lib/utils";
import "./chat-input.css";

export interface ChatInputRef {
  getText: () => string;
  setText: (text: string) => void;
  focus: () => void;
  clear: () => void;
}

interface ChatInputProps {
  onSubmit?: (value: string) => void;
  onAbort?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Initial value to pre-fill the input */
  defaultValue?: string;
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
  function ChatInput({ onSubmit, onAbort, isLoading, disabled, placeholder = "Type a message...", defaultValue }, ref) {
    // Use ref to avoid stale closure in Tiptap keydown handler
    const onSubmitRef = useRef(onSubmit);
    onSubmitRef.current = onSubmit;

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          // Disable all rich-text features — plain text only
          heading: false,
          bold: false,
          italic: false,
          strike: false,
          code: false,
          codeBlock: false,
          blockquote: false,
          bulletList: false,
          orderedList: false,
          listItem: false,
          horizontalRule: false,
        }),
        Placeholder.configure({ placeholder }),
      ],
      content: defaultValue ? `<p>${defaultValue}</p>` : "",
      immediatelyRender: false,
      // Scroll cursor into view on every content change (e.g., Shift+Enter newlines)
      onUpdate({ editor }) {
        editor.commands.scrollIntoView();
      },
      editorProps: {
        attributes: {
          class:
            "w-full resize-none bg-transparent px-1 py-1 text-base text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed",
        },
        // Ensure cursor scrolls into view when typing near container edges
        scrollThreshold: 20,
        scrollMargin: 20,
        handleKeyDown(_view, event) {
          // Guard for IME composition (Chinese/Japanese input)
          if (event.isComposing) return false;

          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            const text = _view.state.doc.textContent;
            if (!text.trim()) return true;
            onSubmitRef.current?.(text);
            // Clear editor after submit
            _view.dispatch(
              _view.state.tr
                .delete(0, _view.state.doc.content.size)
                .setMeta("addToHistory", false),
            );
            return true;
          }

          return false;
        },
      },
    });

    // Sync disabled state
    useEffect(() => {
      if (!editor) return;
      editor.setEditable(!disabled);
    }, [editor, disabled]);

    // Sync placeholder
    useEffect(() => {
      if (!editor) return;
      editor.extensionManager.extensions.find(
        (ext) => ext.name === "placeholder",
      )!.options.placeholder = placeholder;
      // Force view update so placeholder re-renders
      editor.view.dispatch(editor.state.tr);
    }, [editor, placeholder]);

    // Expose imperative API
    useImperativeHandle(ref, () => ({
      getText: () => editor?.state.doc.textContent ?? "",
      setText: (text: string) => {
        editor?.commands.setContent(text ? `<p>${text}</p>` : "");
      },
      focus: () => editor?.commands.focus(),
      clear: () => editor?.commands.clearContent(),
    }), [editor]);

    const handleSubmit = () => {
      if (!editor) return;
      const text = editor.state.doc.textContent;
      if (!text.trim()) return;
      onSubmit?.(text);
      editor.commands.clearContent();
    };

    const handleButtonClick = () => {
      if (isLoading && onAbort) {
        onAbort();
      } else {
        handleSubmit();
      }
    };

    const showStop = isLoading && !!onAbort;

    return (
      <div className={cn(
        "chat-input-editor bg-card rounded-xl p-2 border border-border transition-colors",
        disabled && "is-disabled cursor-not-allowed opacity-60",
      )}>
        <EditorContent className="min-h-12" editor={editor} />
        <div className="flex items-center justify-end pt-2">
          <Button size="icon" onClick={handleButtonClick} disabled={disabled && !showStop}>
            {showStop ? <Square className="size-4 fill-current" /> : <ArrowUp />}
          </Button>
        </div>
      </div>
    );
  },
);
