"use client";

import React, { useState, useRef, useEffect } from "react";

interface ComboboxProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options?: string[];
  placeholder?: string;
}

export default function Combobox({ label, value, onChange, options = [], placeholder }: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const filteredOptions = React.useMemo(() => {
    if (!value) return options.slice(0, 50);
    
    const normalize = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const searchVal = normalize(value);
    
    return options.filter(opt => {
      const optNormalized = normalize(opt);
      return optNormalized.includes(searchVal);
    }).slice(0, 50);
  }, [options, value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && filteredOptions.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setIsOpen(true);
    }
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < filteredOptions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        onChange(filteredOptions[highlightedIndex]);
        setIsOpen(false);
      } else {
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1 ml-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
          setHighlightedIndex(-1);
        }}
        onFocus={() => {
          if (filteredOptions.length > 0) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-xl p-3 text-sm font-medium text-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all placeholder-zinc-600"
      />
      
      {isOpen && filteredOptions.length > 0 && (
        <ul className="absolute z-50 w-full mt-2 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl overflow-y-auto max-h-60">
          {filteredOptions.map((opt, index) => (
            <li
              key={index}
              onClick={() => {
                onChange(opt);
                setIsOpen(false);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`px-4 py-3 cursor-pointer text-sm font-medium transition-colors ${
                index === highlightedIndex
                  ? "bg-blue-600 text-white"
                  : "text-zinc-300 hover:bg-zinc-700 hover:text-white"
              }`}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
