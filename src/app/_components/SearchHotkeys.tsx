"use client";
import { useEffect } from "react";

export default function SearchHotkeys({ formId }: { formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    // Focus the Title input if present
    const titleInput = form?.querySelector<HTMLInputElement>('input[name="search"]');
    titleInput?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && form) {
        const elements = Array.from(form.elements) as Array<HTMLInputElement | HTMLSelectElement>;
        elements.forEach(el => {
          if (el.tagName === 'INPUT') {
            const inp = el as HTMLInputElement;
            if (inp.type === 'text' || inp.type === 'number' || inp.type === 'search' || inp.type === 'url') {
              inp.value = "";
            }
          } else if (el.tagName === 'SELECT') {
            (el as HTMLSelectElement).selectedIndex = 0;
          }
        });
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [formId]);

  return null;
}
