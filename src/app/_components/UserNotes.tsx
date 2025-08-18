"use client";
import { useEffect, useMemo, useState } from "react";

function key(movieId: string) {
  return `cc_notes_${movieId}`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Super-light Markdown: headings, bold, italic, inline code, links, lists, paragraphs
function markdownToHtml(md: string) {
  let s = escapeHtml(md);
  // headings
  s = s.replace(/^######\s?(.*)$/gm, '<h6 class="mt-3 font-semibold">$1</h6>');
  s = s.replace(/^#####\s?(.*)$/gm, '<h5 class="mt-3 font-semibold">$1</h5>');
  s = s.replace(/^####\s?(.*)$/gm, '<h4 class="mt-3 font-semibold">$1</h4>');
  s = s.replace(/^###\s?(.*)$/gm, '<h3 class="mt-3 font-semibold">$1</h3>');
  s = s.replace(/^##\s?(.*)$/gm, '<h2 class="mt-3 font-semibold">$1</h2>');
  s = s.replace(/^#\s?(.*)$/gm, '<h1 class="mt-3 font-bold">$1</h1>');
  // bold, italic, code
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  s = s.replace(/`([^`]+?)`/g, '<code class="px-1 py-0.5 rounded bg-black/5">$1</code>');
  // links
  s = s.replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a class="text-[#994d51] underline" href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  // unordered list
  s = s.replace(/^(?:-\s+.+(?:\n|$))+?/gm, (block) => {
    const items = block
      .trim()
      .split(/\n/)
      .map((l) => l.replace(/^-\s+/, "").trim())
      .map((li) => `<li class="ml-5 list-disc">${li}</li>`) 
      .join("");
    return `<ul class="my-2">${items}</ul>`;
  });
  // paragraphs and line breaks
  s = s.replace(/\n{2,}/g, "</p><p class=\"mt-2\">");
  s = `<p class="whitespace-pre-wrap">${s}</p>`;
  return s;
}

export default function UserNotes({ movieId }: { movieId: string }) {
  const [value, setValue] = useState("");
  const [preview, setPreview] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key(movieId));
      if (raw) setValue(raw);
    } catch {}
  }, [movieId]);

  useEffect(() => {
    try {
      localStorage.setItem(key(movieId), value);
    } catch {}
  }, [movieId, value]);

  const html = useMemo(() => markdownToHtml(value || ""), [value]);

  return (
    <div className="glass-strong p-4 rounded-2xl border border-white/30">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#1b0e0e]">Your Notes</h3>
        <label className="text-sm text-[#6b4a4c] flex items-center gap-2">
          <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} />
          <span>Preview</span>
        </label>
      </div>
      <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Write Markdown notes about this movie..."
          className="min-h-40 w-full rounded-xl border border-[#e7d0d1] bg-white/80 px-3 py-2 text-sm shadow-sm focus:outline-none"
        />
        {preview && (
          <div
            className="prose prose-sm max-w-none text-[#1b0e0e]"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  );
}
