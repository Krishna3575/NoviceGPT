"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY as string;

type Role = "user" | "ai" | "typing";

interface Message {
  id: number;
  role: Role;
  content: string;
}

interface GeminiAPIPart {
  text: string;
}

interface GeminiAPIContent {
  parts: GeminiAPIPart[];
  role: "model" | "user";
}

interface GeminiAPICandidate {
  content: GeminiAPIContent;
  finishReason: string;
  avgLogprobs?: number;
}

interface GeminiAPIResponse {
  candidates: GeminiAPICandidate[];
  usageMetadata?: any;
  modelVersion?: string;
  responseId?: string;
}

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [pdfTextContent, setPdfTextContent] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js";
    script.onload = () => {
      // @ts-ignore
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
    };
    document.body.appendChild(script);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setUploadedFileName(file.name);
      const reader = new FileReader();
      reader.onload = async () => {
        const typedarray = new Uint8Array(reader.result as ArrayBuffer);
        // @ts-ignore
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
        let textContent = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map((item: any) => item.str);
          textContent += strings.join(" ") + "\n";
        }
        setPdfTextContent(textContent);
        console.log("PDF Content:", textContent);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: input.trim(),
    };

    // Show only the user's input in chat UI
    setMessages((prev) => [...prev, userMessage]);

    const typingMessage: Message = {
      id: Date.now() + 1,
      role: "typing",
      content: "AI is typing...",
    };
    setMessages((prev) => [...prev, typingMessage]);

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "40px";

    try {
      const apiContents: GeminiAPIContent[] = [];

      // Add hidden PDF context to API request (not shown in UI)
      if (pdfTextContent.trim()) {
        apiContents.push({
          role: "user",
          parts: [{ text: `This is the content of the uploaded PDF:\n${pdfTextContent}` }],
        });
      }

      const allMessages = messages
        .filter((msg) => msg.role !== "typing")
        .concat(userMessage)
        .map((msg) => ({
          role: msg.role === "ai" ? "model" as const : "user" as const,
          parts: [{ text: msg.content }],
        }));

      apiContents.push(...allMessages);

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: apiContents }),
        }
      );

      const data = (await res.json()) as GeminiAPIResponse;

      const aiText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI.";

      const aiMessage: Message = {
        id: Date.now() + 2,
        role: "ai",
        content: aiText.trim(),
      };

      setMessages((prev) => [
        ...prev.filter((m) => m.role !== "typing"),
        aiMessage,
      ]);
    } catch (error) {
      console.error("API call failed:", error);
      setMessages((prev) => [
        ...prev.filter((m) => m.role !== "typing"),
        {
          id: Date.now() + 3,
          role: "ai",
          content: "Something went wrong. Please try again.",
        },
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div
      className="flex flex-col min-h-screen bg-black text-white p-4 items-center justify-start space-y-6"
      style={{
        backgroundImage: "url('/Pagebg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <h1 className="text-3xl font-bold text-black">NoviceGPT</h1>

      <Card
        className="flex flex-col max-w-2xl w-full mx-auto shadow-2xl rounded-3xl border border-zinc-700"
        style={{
          height: "70vh",
          backgroundColor: "rgba(240, 240, 246, 0.35)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          backgroundBlendMode: "overlay",
        }}
      >
        <CardContent
          className="flex flex-col p-4 gap-4 overflow-hidden"
          style={{ height: "100%" }}
        >
          <ScrollArea
            className="flex-grow pr-2"
            style={{ minHeight: 0, overflowY: "auto" }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                } mb-2`}
              >
                <div
                  className={`p-4 rounded-2xl text-sm whitespace-pre-wrap break-words max-w-[75%] ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white shadow-md"
                      : msg.role === "typing"
                      ? "bg-zinc-400 text-black italic shadow-sm"
                      : "bg-zinc-400 text-black border border-violet-900 shadow-md"
                  }`}
                  style={{ width: "fit-content" }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </ScrollArea>

          {uploadedFileName && (
            <p className="text-sm text-black">
              📄 File uploaded: {uploadedFileName}
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              className="text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>

          <div className="flex items-end gap-2 pt-2">
            <textarea
              ref={textareaRef}
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              rows={1}
              className="flex-grow resize-none bg-rgb(206, 195, 195) border border-whitesmoke text-black placeholder-black rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-whitesmoke transition-all duration-200 ease-in-out"
              style={{ minHeight: "44px", maxHeight: "160px", overflowY: "auto" }}
            />
            <Button
              className="bg-blue-600 hover:bg-indigo-800 active:scale-95 transition-transform duration-150 ease-in-out text-white rounded-lg px-5 py-3 flex items-center justify-center"
              onClick={sendMessage}
            >
              <Send className="w-5 h-5 mr-2" />
              Send
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
