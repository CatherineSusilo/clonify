"use client";

import { useEffect, useRef, useState } from "react";
import type { AddressSuggestion } from "@/lib/geocode";

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
}: {
  value: string;
  onChange: (street: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSearch = useRef(false);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    if (value.trim().length < 3) {
      debounceRef.current = setTimeout(() => {
        setSuggestions([]);
        setOpen(false);
      }, 0);
    } else {
      debounceRef.current = setTimeout(async () => {
        const res = await fetch(`/api/geocode/suggest?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
        setOpen(true);
      }, 350);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  return (
    <div className="relative">
      <input
        required
        placeholder="Street address"
        className="w-full border border-line bg-ink-soft px-4 py-2.5 focus:border-blueprint-light focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full border border-line bg-ink-soft text-sm shadow-lg">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left hover:bg-blueprint-light/10"
                onMouseDown={() => {
                  skipNextSearch.current = true;
                  setSuggestions([]);
                  onSelect(s);
                  setOpen(false);
                }}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
