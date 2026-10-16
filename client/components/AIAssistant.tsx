"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useAuth } from "@/context/AuthContext";

type AssistantConversation = {
  id: string;
  createdAt: string;
  updatedAt: string;
  lastMessage: string | null;
};

type AssistantMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type AssistantOpenRequest = {
  reportReference?: string;
};

const SUGGESTED_QUESTIONS = [
  "How do I report a municipal problem?",
  "How can I check a report I submitted?",
  "What report categories are available?",
  "How do I select my municipality?",
  "What does my report status mean?",
  "How do I submit a report with a location?",
];

async function assistantRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/assistant${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const result = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) {
    throw new Error(result.message || "The AI assistant is temporarily unavailable. Please try again.");
  }
  return result;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AIAssistant() {
  const { residentUser, isAuthReady } = useAuth();
  if (!isAuthReady || !residentUser) return null;
  return <ResidentAIAssistant key={residentUser.id} residentUser={residentUser} />;
}

function ResidentAIAssistant({
  residentUser,
}: {
  residentUser: NonNullable<ReturnType<typeof useAuth>["residentUser"]>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [reportReference, setReportReference] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const messageEndRef = useRef<HTMLDivElement>(null);

  const refreshConversations = useCallback(async () => {
    if (!residentUser) return;
    const result = await assistantRequest<{ conversations: AssistantConversation[] }>("/conversations");
    setConversations(result.conversations);
  }, [residentUser]);

  const loadConversation = useCallback(async (conversationId: string) => {
    setSelectedId(conversationId);
    setMessages([]);
    setIsLoadingHistory(true);
    setError("");
    try {
      const result = await assistantRequest<{ messages: AssistantMessage[] }>(
        `/conversations/${encodeURIComponent(conversationId)}/messages`,
      );
      setMessages(result.messages);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load this conversation.");
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    assistantRequest<{ conversations: AssistantConversation[] }>("/conversations")
      .then((result) => {
        if (active) setConversations(result.conversations);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load assistant history.");
        }
      });
    return () => { active = false; };
  }, [residentUser]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [isSending, messages]);

  useEffect(() => {
    const openRequested = (event: Event) => {
      const detail = (event as CustomEvent<AssistantOpenRequest>).detail || {};
      setReportReference(detail.reportReference || "");
      setSelectedId(null);
      setMessages([]);
      setError("");
      setIsOpen(true);
    };
    window.addEventListener("municipal-assistant:open", openRequested);
    return () => window.removeEventListener("municipal-assistant:open", openRequested);
  }, []);

  const startNewConversation = () => {
    setSelectedId(null);
    setMessages([]);
    setReportReference("");
    setDraft("");
    setError("");
  };

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isSending || !residentUser) return;
    setIsSending(true);
    setError("");
    try {
      let conversationId = selectedId;
      if (!conversationId) {
        const created = await assistantRequest<{ conversation: AssistantConversation }>("/conversations", {
          method: "POST",
          body: JSON.stringify({}),
        });
        conversationId = created.conversation.id;
        setSelectedId(conversationId);
      }

      const result = await assistantRequest<{ messages: AssistantMessage[] }>(
        `/conversations/${encodeURIComponent(conversationId)}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            content: trimmed,
            ...(reportReference.trim() ? { reportReference: reportReference.trim() } : {}),
          }),
        },
      );
      setMessages((current) => [...current, ...result.messages]);
      setDraft("");
      void refreshConversations().catch(() => {
        setError("Your message was sent, but conversation history could not be refreshed.");
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The AI assistant could not respond. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(draft);
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
        aria-expanded={isOpen}
        className="fixed bottom-4 right-4 z-[1000] flex h-14 items-center gap-2 rounded-full bg-emerald-700 px-4 text-white shadow-xl ring-4 ring-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:bottom-6 sm:right-6"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3.5a8.5 8.5 0 0 0-7.25 13l-.9 4 4.1-1.15A8.5 8.5 0 1 0 12 3.5Z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8.5 12h.01m3.49 0h.01m3.49 0h.01" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <span className="text-sm font-semibold">AI Assistant</span>
      </button>

      {isOpen && (
        <section
          aria-label="AI Assistant chat"
          className="fixed bottom-0 right-0 z-[1000] flex h-[min(44rem,100dvh)] w-full flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl sm:bottom-24 sm:right-6 sm:h-[min(42rem,calc(100dvh-8rem))] sm:w-[min(27rem,calc(100vw-3rem))] sm:rounded-2xl"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-slate-900">Municipal Help Assistant</h2>
              <p className="mt-0.5 text-xs text-slate-500">AI-generated answers · Not a municipal employee</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={startNewConversation}
                disabled={isSending}
                className="rounded-lg px-2 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
              >
                New chat
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close AI Assistant"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          </header>

          {conversations.length > 0 && (
            <div className="shrink-0 border-b border-slate-100 px-3 py-2">
              <label htmlFor="assistant-history" className="sr-only">Continue a previous conversation</label>
              <select
                id="assistant-history"
                value={selectedId || ""}
                disabled={isSending}
                onChange={(event) => {
                  setReportReference("");
                  if (event.target.value) void loadConversation(event.target.value);
                  else startNewConversation();
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
              >
                <option value="">New conversation</option>
                {conversations.map((conversation) => (
                  <option key={conversation.id} value={conversation.id}>
                    Conversation · {formatTimestamp(conversation.updatedAt)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3" aria-live="polite" aria-relevant="additions text">
            {isLoadingHistory ? (
              <p role="status" className="py-8 text-center text-sm text-slate-500">Loading conversation history…</p>
            ) : messages.length ? messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <article key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[90%] rounded-2xl px-3 py-2 ${isUser ? "rounded-br-sm bg-emerald-700 text-white" : "rounded-bl-sm border border-slate-200 bg-white text-slate-800"}`}>
                    <p className={`mb-1 text-[11px] font-semibold ${isUser ? "text-emerald-100" : "text-slate-500"}`}>
                      {isUser ? "You" : "AI Assistant"}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-sm leading-5">{message.content}</p>
                    <time dateTime={message.createdAt} className={`mt-1 block text-right text-[10px] ${isUser ? "text-emerald-100" : "text-slate-400"}`}>
                      {formatTimestamp(message.createdAt)}
                    </time>
                  </div>
                </article>
              );
            }) : (
              <div className="space-y-4 py-2">
                <article className="flex justify-start">
                  <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3 py-2 text-slate-800">
                    <p className="mb-1 text-[11px] font-semibold text-slate-500">AI Assistant</p>
                    <p className="text-sm leading-5">Hello! I can explain how to use the reporting service and help you understand your own report information. I’m an AI assistant, not a municipal employee.</p>
                  </div>
                </article>
                {!reportReference && (
                  <div className="space-y-2">
                    <p className="px-1 text-xs font-semibold text-slate-500">Try asking</p>
                    {SUGGESTED_QUESTIONS.map((question) => (
                      <button
                        key={question}
                        type="button"
                        disabled={isSending}
                        onClick={() => {
                          setDraft(question);
                          void sendMessage(question);
                        }}
                        className="block w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-left text-xs font-medium text-emerald-900 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {isSending && (
              <p role="status" className="flex items-center gap-2 px-2 py-1 text-xs text-slate-500">
                <span className="inline-flex gap-1" aria-hidden="true">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-600" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-600 [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-600 [animation-delay:240ms]" />
                </span>
                AI Assistant is responding…
              </p>
            )}
            <div ref={messageEndRef} />
          </div>

          {error && (
            <div role="alert" className="shrink-0 border-t border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              <p>{error}</p>
              {draft.trim() && (
                <button
                  type="button"
                  onClick={() => void sendMessage(draft)}
                  disabled={isSending}
                  className="mt-1 font-semibold underline disabled:opacity-50"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="shrink-0 border-t border-slate-200 bg-white p-3">
            <label htmlFor="assistant-report-reference" className="sr-only">Optional report reference</label>
            <input
              id="assistant-report-reference"
              value={reportReference}
              maxLength={100}
              disabled={isSending}
              onChange={(event) => setReportReference(event.target.value)}
              placeholder="Optional: your report reference"
              className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
            <label htmlFor="assistant-message" className="sr-only">Message the AI Assistant</label>
            <div className="flex items-end gap-2">
              <textarea
                id="assistant-message"
                value={draft}
                maxLength={2000}
                rows={2}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="Ask a question…"
                className="min-h-12 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
              <button
                type="submit"
                disabled={!draft.trim() || isSending}
                className="rounded-xl bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSending ? "Thinking…" : "Send"}
              </button>
            </div>
            <p className="mt-1 text-right text-[10px] text-slate-400">{draft.length}/2000 · Enter to send, Shift+Enter for a new line</p>
            <p className="mt-1 text-[10px] text-slate-500">Your conversation is saved to your account. Do not share passwords or access codes.</p>
          </form>
        </section>
      )}
    </>
  );
}
