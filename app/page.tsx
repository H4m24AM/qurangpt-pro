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
    <div
      className="min-h-screen flex flex-col items-center justify-start px-4 py-8"
      style={{
        backgroundImage: "url('/backgrounds/quran-fatiha.png')",
        backgroundSize: "cover",
        backgroundAttachment: "fixed",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        filter: "brightness(0.3) blur(2px)",
      }}
    >
      <div className="bg-white bg-opacity-90 backdrop-blur-lg rounded-xl p-6 w-full max-w-3xl shadow-lg z-10">
        <div className="flex flex-col items-center space-y-4">
          <h1 className="text-xl font-medium text-[#014421] font-cairo">QuranGPT Pro</h1>
        </div>

        <form onSubmit={handleAsk} className="space-y-4 w-full flex flex-col items-center mt-6">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about a verse, multiple verses, or describe a topic for Quranic analysis..."
            className="w-[90%] md:w-[80%] p-4 text-base border border-[#014421] rounded-md focus:outline-none focus:ring-2 focus:ring-[#014421] h-36 resize-none bg-white bg-opacity-70"
          />

          <Button
            type="submit"
            className="px-8 py-3 bg-[#c89f0c] hover:bg-[#b78e00] text-white font-medium rounded-md transition"
          >
            {loading ? "Thinking..." : "Ask QuranGPT Pro"}
          </Button>
        </form>

        <div className="w-full mt-6">
          <div className="min-h-[200px] w-full p-6 border border-gray-300 rounded-md bg-gray-100 bg-opacity-80">
            <p className="text-base text-[#014421] leading-relaxed font-inter whitespace-pre-line">
              {answer}
            </p>
          </div>
          {answer && (
            <div className="flex justify-end mt-2">
              <button
                onClick={() => navigator.clipboard.writeText(answer)}
                className="px-4 py-2 bg-[#014421] text-white rounded-md text-sm hover:bg-green-900 transition"
              >
                Copy Response
              </button>
            </div>
          )}
        </div>

        <footer className="mt-8 pt-4 text-center">
          <p className="text-sm text-gray-500 font-inter">
            Powered by @QuranGPTPro | Built by P² Cyber Solutions
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Suggestions? Email: <a href="mailto:info@p2-cyber.com" className="underline text-blue-600">info@p2-cyber.com</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
