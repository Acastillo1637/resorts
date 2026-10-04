import { useRef } from "react";
import { formatoCLP, pegarCLP } from "@/lib/package-input";
import { input } from "../AppShell";
export function PrecioCLP({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean | undefined;
}) {
  const ref = useRef<HTMLInputElement>(null);
  function update(text: string, caret: number) {
    const digitsBefore = text.slice(0, caret).replaceAll(".", "").length;
    const digits = text.replaceAll(".", "");
    if (!/^\d*$/.test(digits)) return;
    onChange(digits);
    const formatted = formatoCLP(digits);
    let position = 0,
      count = 0;
    while (position < formatted.length && count < digitsBefore) {
      if (/\d/.test(formatted[position]!)) count++;
      position++;
    }
    requestAnimationFrame(() => ref.current?.setSelectionRange(position, position));
  }
  return (
    <input
      ref={ref}
      className={input}
      type="text"
      inputMode="numeric"
      required={required}
      value={formatoCLP(value)}
      onChange={(e) => update(e.target.value, e.target.selectionStart ?? e.target.value.length)}
      onPaste={(e) => {
        e.preventDefault();
        const digits = pegarCLP(e.clipboardData.getData("text"));
        if (digits === null) return;
        const target = e.currentTarget,
          start = target.selectionStart ?? 0,
          end = target.selectionEnd ?? start;
        update(
          target.value.slice(0, start) + digits + target.value.slice(end),
          start + digits.length,
        );
      }}
      onKeyDown={(e) => {
        if ([".", ",", "e", "E", "+", "-"].includes(e.key)) e.preventDefault();
        const target = e.currentTarget,
          start = target.selectionStart ?? 0;
        if (start !== target.selectionEnd) return;
        if (e.key === "Backspace" && target.value[start - 1] === ".")
          target.setSelectionRange(Math.max(0, start - 2), start);
        if (e.key === "Delete" && target.value[start] === ".")
          target.setSelectionRange(start, start + 2);
      }}
    />
  );
}
