
// src/App.tsx
import { useEffect, useState, useRef } from "react";
import {
  CreateMLCEngine,
  type MLCEngineInterface,
  type ChatCompletionMessageParam,
} from "@mlc-ai/web-llm";
import "./App.css";

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
  const [isFetchingCache, setIsFetchingCache] = useState(false);
  const [slowInternetAlert, setSlowInternetAlert] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const previousModelId = useRef<string | null>(null);
  const slowNetworkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removePreviousModelCache = async (oldModelId: string) => {
    try {
      if (oldModelId && oldModelId !== modelId) {
        await caches?.delete(oldModelId);
        console.log(`Cache cleared for previous model: ${oldModelId}`);
      }
    } catch (err) {
      console.error("Error clearing previous cache:", err);
    }
  };

  const loadModel = async () => {
    if (!("gpu" in navigator)) {
      setStatus("WebGPU not available. Try Chrome/Edge 113+ or recent Safari.");
      return;
    }
    try {
      // Clear previous model cache before loading new model
      if (previousModelId.current && previousModelId.current !== modelId) {
        await removePreviousModelCache(previousModelId.current);
      }

      setLoading(true);
      setIsFetchingCache(true);
      setSlowInternetAlert(false);
      setDownloadProgress(0);
      setStatus("Getting ready things dynamically...");

      // Set a timeout to show slow internet alert after 8 seconds
      slowNetworkTimeoutRef.current = setTimeout(() => {
        setSlowInternetAlert(true);
      }, 8000);

      const eng = await CreateMLCEngine(modelId, {
        initProgressCallback: (p) => {
          setStatus(p.text ?? "Downloading the llm model please wait for some time...");
          // Extract percentage if available
          const progressMatch = p.text?.match(/(\d+)%/);
          if (progressMatch) {
            setDownloadProgress(parseInt(progressMatch[1]));
          }
          // Clear slow internet alert when downloading is progressing
          if (p.text?.includes("Loading")) {
            setSlowInternetAlert(false);
            if (slowNetworkTimeoutRef.current) {
              clearTimeout(slowNetworkTimeoutRef.current);
            }
          }
        },
      });

      setEngine(eng);
      setStatus(`Model ready: ${modelId}`);
      previousModelId.current = modelId;
      setIsFetchingCache(false);
      setSlowInternetAlert(false);

      // Clear timeout on successful load
      if (slowNetworkTimeoutRef.current) {
        clearTimeout(slowNetworkTimeoutRef.current);
      }
    } catch (err) {
      console.error(err);
      setStatus("Failed to load model. See console.");
      setIsFetchingCache(false);
    } finally {
      setLoading(false);
      setSlowInternetAlert(false);
      if (slowNetworkTimeoutRef.current) {
        clearTimeout(slowNetworkTimeoutRef.current);
      }
    }
  };
  useEffect(() => {
    loadModel();

    return () => {
      if (slowNetworkTimeoutRef.current) {
        clearTimeout(slowNetworkTimeoutRef.current);
      }
    };
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
    <div className="app-container">
      {loading && (
        <div className="loading-overlay">
          <div className="loader-card">
            <div className="spinner"></div>
            <h2 className="loader-title">
              {isFetchingCache ? "Downloading the LLM Model" : "Getting Ready"}
            </h2>
            <p className="loader-subtitle">
              {isFetchingCache ? "Please wait for some time..." : "Getting things ready dynamically..."}
            </p>

            {/* Progress Bar */}
            {downloadProgress > 0 && (
              <div className="progress-container">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${downloadProgress}%` }}></div>
                </div>
                <p className="progress-text">{downloadProgress}%</p>
              </div>
            )}

            {/* Slow Internet Alert */}
            {slowInternetAlert && (
              <div className="alert-box slow-internet-alert">
                <span className="alert-icon">⚠️</span>
                <div className="alert-content">
                  <p className="alert-title">Slow Internet Speed Detected</p>
                  <p className="alert-message">
                    If download is too slow, try:
                  </p>
                  <ul className="alert-list">
                    <li>Try a different location or network</li>
                    <li>Wait for some more time</li>
                    <li>Check your internet connection</li>
                  </ul>
                </div>
              </div>
            )}

            <p className="loader-status">{status}</p>
          </div>
        </div>
      )}

      <div className="app-wrapper">
        <div className="app-content">
          <div className="model-selector-section">
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              disabled={loading}
              className="model-select"
            >
              {options.map((option) => (
                <option key={Object.values(option)[0]} value={Object.values(option)[0]}>
                  {Object.keys(option)[0]}
                </option>
              ))}
            </select>
            <span className="status-text">{status}</span>
          </div>

          <div className="chat-container">
            {messages.length === 0 && (
              <p className="no-history">
                No history.
                <a href="https://chat.webllm.ai/" target="_blank" rel="noopener noreferrer" className="help-link">
                  {" "}For more models visit this url.
                </a>
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className="message-wrapper">
                <strong className={`message-role ${m.role === "user" ? "user-role" : "assistant-role"}`}>
                  {m.role === "user" ? "You" : "Assistant"}:
                </strong>
                <br />
                <span className="message-content">
                  {typeof m.content === "string" ? m.content : ""}
                  {paused && m.role === "assistant" && (
                    <span className="paused-indicator"> ⏸ Paused</span>
                  )}
                </span>
              </div>
            ))}
          </div>

          <div className="input-section">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => (e.key === "Enter" && !e.shiftKey ? sendMessage() : null)}
              placeholder="Type your message…"
              disabled={!engine || streaming || loading}
              className="message-input"
            />
            <div className="button-group">
              <button
                onClick={sendMessage}
                disabled={!engine || streaming || !input.trim()}
                className="send-button"
              >
                {streaming ? "Generating…" : "Send"}
              </button>
              {streaming && (
                <button onClick={pauseGeneratingResponse} className="pause-button">
                  Pause
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
