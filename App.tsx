import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, WineEntry } from './types';
import { fetchInventory } from './services/sheetService';
import { getChatResponseViaApi } from './services/chatApiService';

// Brand Logo: Minimalist Wine Glass
const BrandLogo = ({ className = "w-8 h-auto" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 22h8" />
    <path d="M12 15v7" />
    <path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z" />
    <path d="M7 10h10" strokeOpacity="0.3" />
  </svg>
);

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
);

const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path>
    <path d="M21 3v5h-5"></path>
  </svg>
);

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Welcome to **flere fugle**. I am your wine assistant, connected directly to our live inventory. How can I help you assist our guests today?',
      timestamp: new Date()
    }
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [inventory, setInventory] = useState<WineEntry[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const loadInventory = async () => {
    setIsRefreshing(true);
    setInventoryError(null);
    try {
      const data = await fetchInventory();
      setInventory(data);
      if (!data?.length) {
        setInventoryError("Inventory loaded but appears empty. Check the LIVE tab export.");
      }
    } catch (err: any) {
      console.error(err);
      setInventory(null);
      setInventoryError("Could not load inventory. Check the LIVE sheet is public + reachable.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || !inventory) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    // IMPORTANT FIX:
    // Use nextMessages so the API receives a history that includes the just-submitted user message.
    const nextMessages = [...messages, userMsg];

    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);

    try {
      // Send the updated chat history (including the new user message)
      const response = await getChatResponseViaApi(userMsg.content, nextMessages, inventory);

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error(err);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I encountered an issue accessing the cellar records. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white text-black max-w-5xl mx-auto border-x border-stone-100 shadow-sm overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 bg-[#007c80] text-white sticky top-0 z-10">
        <div className="flex items-center gap-5">
          <BrandLogo className="w-9 h-auto text-white" />
          <div className="border-l border-white/20 pl-5">
            <div className="flex items-baseline">
              <h1 className="text-2xl brand-heading lowercase leading-none tracking-tight">flere fugle</h1>
              <span className="text-[10px] font-bold text-white/30 uppercase ml-3 tracking-widest">v1.0.0-rev</span>
            </div>
            <p className="text-[9px] font-semibold tracking-[0.2em] uppercase mt-1 opacity-70">Wine Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end mr-2">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Status</span>
            <span className={`text-[11px] font-bold tracking-wide uppercase ${inventory ? 'text-emerald-300' : 'text-amber-200'}`}>
              {inventory ? 'Live Inventory' : 'No Inventory'}
            </span>
          </div>

          <button
            onClick={loadInventory}
            disabled={isRefreshing}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 disabled:opacity-50 border border-white/10"
            title="Refresh Stock"
          >
            <div className={isRefreshing ? 'animate-spin' : ''}>
              <RefreshIcon />
            </div>
          </button>
        </div>
      </header>

      {/* Message Area */}
      <main
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-8 md:px-12 md:py-10 space-y-8 bg-[#fafafa]"
      >
        {inventoryError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-sm">
            <strong>Inventory warning:</strong> {inventoryError}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl p-6 ${
                msg.role === 'user'
                  ? 'bg-[#6d342d] text-white shadow-md'
                  : 'bg-white border border-stone-200 text-black shadow-sm assistant-bubble'
              }`}
            >
              <div className="prose-custom">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>

              <div className={`mt-4 flex items-center gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && <BrandLogo className="w-5 h-auto text-[#007c80]" />}
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-30">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-stone-200 px-6 py-5 rounded-xl flex items-center gap-4 shadow-sm">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-[#007c80] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-[#007c80] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-[#007c80] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#007c80]">Checking Stock...</span>
            </div>
          </div>
        )}
      </main>

      {/* Input Area */}
      <footer className="px-6 py-8 md:px-12 md:py-10 bg-white border-t border-stone-100">
        <form onSubmit={handleSubmit} className="relative flex items-center gap-3 max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={inventory ? "Ask a question about our wines..." : "Inventory not loaded yet — tap refresh"}
            disabled={isLoading || !inventory}
            className="flex-1 bg-stone-50 border-2 border-stone-100 rounded-lg px-6 py-4 text-black placeholder-stone-400 focus:outline-none focus:border-[#007c80] transition-all disabled:opacity-50 text-base font-medium"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim() || !inventory}
            className="bg-[#6d342d] hover:bg-[#5a2b25] disabled:bg-stone-100 disabled:text-stone-300 text-white px-6 py-4 rounded-lg transition-all active:scale-95 shadow-sm flex items-center justify-center font-bold uppercase tracking-widest text-[11px]"
          >
            <span className="mr-3 hidden sm:inline">Submit</span>
            <SendIcon />
          </button>
        </form>
      </footer>
    </div>
  );
}
