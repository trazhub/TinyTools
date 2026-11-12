"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  title?: string;
  hint: string;
  onFiles: (files: File[]) => void;
}

/**
 * An accessible file picker with drag-and-drop. The real <input type="file"> is
 * focusable and keyboard operable; the large label is its click target.
 */
export function FileDropzone({
  accept,
  multiple = false,
  disabled,
  title = "Drop files here or click to choose",
  hint,
  onFiles,
}: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handle(list: FileList | null) {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
    if (inputRef.current) inputRef.current.value = ""; // allow re-selecting the same file
  }

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) handle(e.dataTransfer.files);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-foreground px-6 py-10 text-center hover:bg-muted has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
        dragging && "bg-muted",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <span className="space-y-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{hint}</span>
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => handle(e.target.files)}
      />
    </label>
  );
}
