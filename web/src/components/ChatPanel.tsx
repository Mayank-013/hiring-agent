"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { streamChat } from "@/lib/api";
import type { ChatMessage, ChatScope } from "@/lib/types";

type Props = {
  scope: ChatScope;
  candidateId?: string;
  disabled?: boolean;
  placeholder?: string;
};

export function ChatPanel({
  scope,
  candidateId,
  disabled,
  placeholder = "Ask the hiring desk…",
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    gsap.fromTo(
      rootRef.current,
      { autoAlpha: 0, y: 16 },
      { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }
    );
  }, [scope, candidateId]);

  useEffect(() => {
    setMessages([]);
  }, [scope, candidateId]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming || disabled) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    try {
      let assistant = "";
      await streamChat({
        scope,
        candidateId,
        messages: nextMessages,
        onToken: (token) => {
          assistant += token;
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: "assistant", content: assistant };
            return copy;
          });
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Chat failed";
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: `Something went wrong: ${msg}`,
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col">
      <div
        ref={listRef}
        className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-1 py-2"
      >
        {messages.length === 0 && (
          <p className="font-mono text-xs leading-relaxed text-[var(--mist)]">
            {scope === "global"
              ? "Compare candidates, ask for rankings, or surface red flags across the pipeline."
              : "Ask why a score is low, what to verify in interview, or summarize drawbacks."}
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={`${m.role}-${i}`}
            className={`max-w-[95%] whitespace-pre-wrap text-sm leading-relaxed ${
              m.role === "user"
                ? "ml-auto border border-[var(--line)] bg-[var(--ink-3)] px-3 py-2 text-[var(--paper)]"
                : "text-[var(--mist)]"
            }`}
          >
            {m.role === "assistant" && (
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--lime)]">
                Assistant
              </span>
            )}
            {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-3 flex gap-2 border-t border-[var(--line)] pt-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={disabled || streaming}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent px-2 py-2 font-mono text-sm text-[var(--paper)] outline-none placeholder:text-[var(--mist)]/50"
        />
        <button
          type="submit"
          disabled={disabled || streaming || !input.trim()}
          className="font-display bg-[var(--lime)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--lime-dim)] disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
