
// src/App.tsx
import { useEffect, useState } from "react";
import {
  CreateMLCEngine,
  type MLCEngineInterface,
  type ChatCompletionMessageParam,
} from "@mlc-ai/web-llm";

const options = [
  { Qwen2: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC" },
  { Llama: "Llama-3.2-1B-Instruct-q4f16_1-MLC" },
  { Phi: "Phi-3-mini-4k-instruct-q4f16_1-MLC" },
  { Deepseek: "DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC" },
  { Mistral: "Hermes-2-Pro-Mistral-7B-q4f16_1-MLC" }
]

const App = () => {
  const [engine, setEngine] = useState<MLCEngineInterface | null>(null);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatCompletionMessageParam[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState("No model loaded.");
  const [modelId, setModelId] = useState<string>(Object.values(options[0])[0]);
  const [paused, setPaused] = useState(false);
  const loadModel = async () => {
    if (!("gpu" in navigator)) {
      setStatus("WebGPU not available. Try Chrome/Edge 113+ or recent Safari.");
      return;
    }
    try {
      setLoading(true);
      setStatus("Downloading / initializing model...");
      const eng = await CreateMLCEngine(modelId, {
        initProgressCallback: (p) => setStatus(p.text ?? "Loading..."),
      });
      setEngine(eng);
      setStatus(`Model ready: ${modelId}`);
    } catch (err) {
      console.error(err);
      setStatus("Failed to load model. See console.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    loadModel();
  }, [modelId]);
  async function sendMessage() {
    setStatus(``)
    setPaused(false);
    if (!engine || !input.trim()) return;
    const userMsg: ChatCompletionMessageParam = {
      role: "user",
      content: input.trim(),
    };

    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setStreaming(true);

    let acc = "";
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const stream = await engine.chat.completions.create({
        stream: true,
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          ...next,
        ],
      });

      for await (const chunk of stream) {
        const piece = chunk?.choices?.[0]?.delta?.content ?? "";
        if (!piece) continue;
        acc += piece;
        setMessages((prev) => {
          const copy = prev.slice();
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch (e) {
      setMessages((prev) => {
        const copy = prev.slice();
        copy[copy.length - 1] = {
          role: "assistant",
          content: "⚠️ Error during generation.",
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }
  const pauseGeneratingResponse = async () => {
    if (engine) {
      engine.interruptGenerate()
      setLoading(false)
      setStreaming(false)
      setStatus(`Generation paused.`)
      setPaused(true);
    }
  };
  return (
    <div style={{ padding: 16, color: "#e5e7eb", fontFamily: "system-ui", width: 700 }}>
      <div style={{ marginBottom: 12 }}>
        <select value={modelId} onChange={(e) => setModelId(e.target.value)} disabled={loading}>
          {options.map((option) => (<option key={Object.values(option)[0]} value={Object.values(option)[0]}>{Object.keys(option)[0]}</option>))}
          {/* <option value={options.Qwen2}>Qwen</option>
          <option value={options.Llama}>Llama</option>
          <option value={options.Phi}>Phi</option> */}
        </select>
        <span style={{ marginLeft: 12, color: "#9ca3af" }}>{status}</span>
      </div>

      <div style={{ border: "1px solid #1f2937", borderRadius: 8, padding: 12, height: "55vh", overflowY: "auto", background: "#0b1020" }}>
        {messages.length === 0 && <p style={{ color: "#9ca3af" }}>
          No history.
          <a href="https://chat.webllm.ai/" style={{ textDecoration: "none" }}> for more model visit this url.</a>
        </p>}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <strong style={{ color: m.role === "user" ? "#93c5fd" : "#a7f3d0" }}>
              {m.role === "user" ? "You" : "BAssistant"}:
            </strong><br />
            <span>{typeof m.content === "string" ? m.content : ""}<br /><span style={{ color: "gray" }}>{paused && m.role === "assistant" ? " Paused by YOU" : ""}</span></span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => (e.key === "Enter" && !e.shiftKey ? sendMessage() : null)}
          placeholder="Type your message…"
          disabled={!engine || streaming || loading}
          style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #1f2937", background: "#111827", color: "white" }}
        />
        <button onClick={sendMessage} disabled={!engine || streaming || !input.trim()}>
          {streaming ? "Generating…" : "Send"}
        </button>
        {streaming && (
          <button onClick={pauseGeneratingResponse}>
            Pause
          </button>
        )}
      </div>
    </div>
  );
};

export default App;
