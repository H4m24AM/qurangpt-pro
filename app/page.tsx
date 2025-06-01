"use client";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "system",
      content: "Assalamu alaykum. I am your AI Assistant QuranGPT Pro. Ask me about Quranic grammar, Tafsir, Hadith, or verse analysis."
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [animatedText, setAnimatedText] = useState("");
  const [fontSize, setFontSize] = useState("text-base");
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef(null);
  const backgroundRef = useRef(null);
  const inputRef = useRef(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setPrinting(true);
    setAnimatedText("");

    const newMessages = [...messages, { role: "user", content: query }].slice(-10);
    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setQuery("");

    try {
      const res = await fetch("/api/qurangpt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: query }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let fullText = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value);
        fullText += chunkValue;
        setAnimatedText(prev => prev + chunkValue);
      }

      setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content: fullText }]);
    } catch (err) {
      console.error("Streaming error:", err);
      setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content: "Error retrieving response." }]);
    } finally {
      setPrinting(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSearch(e);
    }
  };

  return (
    <div ref={backgroundRef} className="min-h-screen bg-cover bg-center bg-no-repeat flex flex-col justify-start" style={{ backgroundImage: "url('/backgrounds/qurangpt-background.jpg')" }}>
      <div className="flex justify-center pt-16">
        <Image src="/Quran.png" alt="QuranGPT Pro Logo" width={400} height={100} priority />
      </div>

      <div className="flex justify-center mt-4 space-x-2">
        <button onClick={() => setFontSize("text-sm")} className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300">A-</button>
        <button onClick={() => setFontSize("text-base")} className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300">A</button>
        <button onClick={() => setFontSize("text-lg")} className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300">A+</button>
      </div>

      <div className="flex justify-center mt-2">
        <button onClick={() => setExpanded(!expanded)} className="text-sm text-blue-700 underline">
          {expanded ? "Minimize Chat Window" : "Expand Chat Window"}
        </button>
      </div>

      <div className="flex justify-center mt-4 px-4">
        <div className={`w-full max-w-4xl ${expanded ? "h-[60vh]" : "h-[30vh]"} overflow-y-auto bg-white bg-opacity-90 backdrop-blur-md rounded-lg p-6 space-y-4 shadow-md`}>
          {messages.slice(-10).map((msg, idx) => (
            <div key={idx} className={`${fontSize} ${msg.role === "user" ? "text-right text-black" : "text-left text-green-900"}`}>
              <span className="block font-semibold mb-1">{msg.role === "user" ? "Me:" : msg.role === "assistant" ? "QuranGPT Pro:" : ""}</span>
              <span className="block whitespace-pre-line">
                {msg.role === "assistant" && idx === messages.length - 1
                  ? (printing ? animatedText : msg.content)
                  : msg.content}
              </span>
              {msg.role === "assistant" && msg.content && (
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(msg.content)}
                    className="px-3 py-1 bg-green-800 text-white text-xs rounded hover:bg-green-900"
                  >
                    Copy
                  </button>
                </div>
              )}
              <hr className="my-4 border-t border-gray-300" />
            </div>
          ))}
          {loading && !printing && (
            <div className="text-left text-gray-500 italic">Thinking…</div>
          )}
          {printing && (
            <div className="text-left text-gray-500 italic">Printing…</div>
          )}
          <div ref={scrollRef} />
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex justify-center mt-4 px-4">
        <div className="w-full max-w-4xl">
          <div className="flex items-center rounded-full bg-white shadow-md overflow-hidden">
            <textarea
              ref={inputRef}
              rows={1}
              onKeyDown={handleKeyDown}
              className="flex-grow px-6 py-4 text-lg bg-transparent outline-none placeholder-gray-500 text-black resize-none"
              placeholder={messages.length > 1 ? "Enter text here..." : "1:7"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="px-6 bg-blue-800 hover:bg-blue-900 text-white font-semibold">
              {loading ? "..." : "🔍"}
            </button>
          </div>
        </div>
      </form>

      <div className="text-center text-gray-800 mt-6 px-6 max-w-3xl mx-auto">
        <p className="text-md font-medium">
          Ask us anything about Quran and its language, grammar, verses, words, letters and meanings.
        </p>
        <p className="text-sm mt-1">
          <strong>QuranGPT may produce inaccurate information about people, places, or facts.</strong>
        </p>
      </div>

      <footer className="text-center text-gray-700 text-sm mt-10 py-6">
        <p>Powered by P² Cyber Solutions</p>
        <p className="mt-1">Send suggestions to <a href="mailto:info@p2-cyber.com" className="text-blue-700 underline">info@p2-cyber.com</a></p>
      </footer>
    </div>
  );
}
