"use client";

import * as React from "react";
import { createPortal } from "react-dom";

export type ClientTypeaheadOption = {
  id: string;
  name: string;
};

export function ClientTypeahead(props: {
  clients: ClientTypeaheadOption[];
  valueName: string;
  onSelect: (client: ClientTypeaheadOption) => void;
  placeholder?: string;
  className?: string;
  maxResults?: number;
  openShowsAll?: boolean;
}) {
  const { clients, valueName, onSelect, placeholder, className, maxResults = 10, openShowsAll = false } = props;

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState(valueName);
  const [menuBox, setMenuBox] = React.useState<null | { left: number; top: number; width: number }>(null);

  React.useEffect(() => {
    setQuery(valueName);
  }, [valueName]);

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? clients.filter((client) => client.name.toLowerCase().includes(q)) : clients;
    // Fix: keep the worklog picker behavior by default, but allow full filtered scrolling
    // on other tabs where users need to browse more than the first handful of matches.
    return typeof maxResults === "number" ? filtered.slice(0, maxResults) : filtered;
  }, [clients, query, maxResults]);

  const updateMenuBox = React.useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuBox({ left: rect.left, top: rect.bottom, width: rect.width });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    updateMenuBox();

    const onScroll = () => updateMenuBox();
    const onResize = () => updateMenuBox();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, updateMenuBox]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          // Fix: some tabs need the picker to open as a true browseable dropdown first,
          // then switch into filtering only after the user starts typing.
          if (openShowsAll) setQuery("");
          setOpen(true);
          window.setTimeout(() => updateMenuBox(), 0);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false);
            if (openShowsAll) setQuery(valueName);
          }, 120);
        }}
        placeholder={placeholder ?? "Search client…"}
        className={"h-10 w-full rounded-md border bg-white px-3 " + (className ?? "border-zinc-300")}
      />

      {open && menuBox
        ? createPortal(
            <div
              style={{ left: menuBox.left, top: menuBox.top + 4, width: menuBox.width, position: "fixed", zIndex: 1000 }}
              className="max-h-64 overflow-auto rounded-md border border-zinc-200 bg-white shadow"
            >
              {matches.length === 0 ? (
                <div className="px-3 py-2 text-sm text-zinc-500">No matches</div>
              ) : (
                matches.map((client) => (
                  <button
                    key={client.id || "__empty"}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onSelect(client);
                      setOpen(false);
                    }}
                  >
                    {client.name}
                  </button>
                ))
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
