"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function QuranGPTInterface() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(
    "As-salamu ‘alaykum. I am QuranGPT Pro. Ask me about Quranic grammar, Tafsir, Hadith, or verse analysis. I’ll respond with classical and scholarly sources, insha’Allah."
  );
  const [loading, setLoading] = useState(false);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);

    const res = await fetch("/api/qurangpt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: question }),
    });

    const data = await res.json();
    setAnswer(data.reply);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f7f7f7] flex flex-col items-center justify-start px-4 py-8">
      {/* Logo and Heading */}
      <div className="w-full max-w-2xl mx-auto space-y-8">
        <div className="flex flex-col items-center space-y-4">
          <h1 className="text-xl font-medium text-[#014421] font-cairo">QuranGPT Pro</h1>
        </div>

        {/* Input Section */}
        <form onSubmit={handleAsk} className="space-y-4 w-full flex flex-col items-center">
          <Input
            type="text"
            placeholder="Ask about a verse (e.g. 1:6) or type your Quranic question…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-[90%] md:w-[50%] px-4 py-3 text-base border border-[#014421] rounded-md"
          />
          <Button
            type="submit"
            className="px-8 py-3 bg-[#c49b0e] hover:bg-[#b8860b] text-white font-medium rounded-md"
          >
            {loading ? "Thinking..." : "Ask QuranGPT Pro"}
          </Button>
        </form>

        {/* Response Section */}
        <div className="w-full">
          <div className="min-h-[200px] w-full p-6 border border-gray-300 rounded-md bg-gray-100">
            <p className="text-base text-[#014421] leading-relaxed font-inter whitespace-pre-line">
              {answer}
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-auto pt-8 text-center">
          <p className="text-sm text-gray-500 text-center font-inter">
            Powered by @QuranGPTPro | Commissioned & Built by P² Cyber Solutions
          </p>
        </footer>
      </div>
    </div>
  );
}
