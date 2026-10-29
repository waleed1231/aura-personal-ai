import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AudioLines,
  Bot,
  BrainCircuit,
  Check,
  ChevronDown,
  CircleHelp,
  Command,
  Globe2,
  Languages,
  Mic,
  MicOff,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
  Wifi,
  Zap,
} from "lucide-react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000/api/chat";
const HEALTH_URL = "http://127.0.0.1:8000/api/health";

const LANGUAGES = {
  Urdu: {
    code: "ur-PK",
    greeting: "السلام علیکم! میں AURA ہوں۔ آج میں آپ کی کیا مدد کر سکتی ہوں؟",
  },
  English: {
    code: "en-US",
    greeting: "Hello! I'm AURA, your personal AI assistant. What can I help you with today?",
  },
  Hindi: {
    code: "hi-IN",
    greeting: "नमस्ते! मैं AURA हूँ। आज मैं आपकी क्या मदद कर सकती हूँ?",
  },
};

const QUICK_ACTIONS = [
  {
    icon: BrainCircuit,
    title: "Think with me",
    prompt: "Help me think through an important decision. Ask me one question at a time.",
  },
  {
    icon: Command,
    title: "Plan my day",
    prompt: "Help me create a practical plan for my day. Ask me about my priorities.",
  },
  {
    icon: Sparkles,
    title: "Generate ideas",
    prompt: "Give me five creative, useful ideas for improving my work and daily life.",
  },
  {
    icon: Globe2,
    title: "Research a topic",
    prompt: "Help me research a topic. Ask me what I want to learn about.",
  },
];

function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export default function App() {
  const [language, setLanguage] = useState("Urdu");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [apiStatus, setApiStatus] = useState("checking");
  const [error, setError] = useState("");
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [activeTab, setActiveTab] = useState("Assistant");
  const [lastHeard, setLastHeard] = useState("");

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const messagesRef = useRef([]);

  const currentLanguage = LANGUAGES[language];

  useEffect(() => {
    messagesRef.current = messages;
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, busy]);

  useEffect(() => {
    let cancelled = false;

  async function checkBackend() {
  try {
    setApiStatus("checking");

    const response = await fetch(HEALTH_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Backend returned HTTP ${response.status}`);
    }

    const data = await response.json();

    console.log("AURA backend health:", data);

    if (!cancelled) {
      setApiStatus(data?.status === "online" ? "online" : "offline");
    }
  } catch (error) {
    console.error("AURA backend health check failed:", error);

    if (!cancelled) {
      setApiStatus("offline");
    }
  }
}

    // Run immediately, then recheck every five seconds.
    checkBackend();
    const intervalId = window.setInterval(checkBackend, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speak = useCallback(
    (text, selectedLanguage = language) => {
      if (!voiceEnabled || !window.speechSynthesis) return;

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = LANGUAGES[selectedLanguage]?.code || "ur-PK";
      utterance.rate = 1;
      utterance.pitch = 1;

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [language, voiceEnabled]
  );

  const sendMessage = useCallback(
    async (rawText) => {
      const text = rawText.trim();
      if (!text || busy) return;

      const lowerText = text.toLowerCase();

      let requestedLanguage = null;

      if (
        lowerText.includes("talk to me in english") ||
        lowerText.includes("english language") ||
        lowerText.includes("speak english")
      ) {
        requestedLanguage = "English";
      } else if (
        lowerText.includes("talk to me in urdu") ||
        lowerText.includes("speak urdu") ||
        text.includes("اردو میں بات")
      ) {
        requestedLanguage = "Urdu";
      } else if (
        lowerText.includes("talk to me in hindi") ||
        lowerText.includes("speak hindi") ||
        text.includes("हिंदी में बात")
      ) {
        requestedLanguage = "Hindi";
      }

      const activeLanguage = requestedLanguage || language;

      if (requestedLanguage) setLanguage(requestedLanguage);

      const userMessage = {
        id: `${Date.now()}-user`,
        role: "user",
        content: text,
      };

      const updatedMessages = [...messagesRef.current, userMessage];

      messagesRef.current = updatedMessages;
      setMessages(updatedMessages);
      setInput("");
      setError("");
      setBusy(true);

      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: updatedMessages.slice(-12).map(({ role, content }) => ({
              role,
              content:
                role === "user" && requestedLanguage && content === text
                  ? `${content}\n\nPlease reply in ${activeLanguage}.`
                  : content,
            })),
          }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.detail || data.error || `Request failed (${response.status})`
          );
        }

        const reply =
          data.reply ||
          data.response ||
          data.answer ||
          data.message ||
          "AURA received your message but returned an empty response.";

        const assistantMessage = {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          content: reply,
        };

        messagesRef.current = [...updatedMessages, assistantMessage];
        setMessages(messagesRef.current);
        speak(reply, activeLanguage);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to connect to AURA.";

        setError(
          message.includes("Failed to fetch")
            ? "Cannot connect to the backend. Start your FastAPI server on port 8000 and check that it is running."
            : message
        );
      } finally {
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [busy, language, speak]
  );

  const startListening = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition = getSpeechRecognition();

    if (!SpeechRecognition) {
      setError(
        "Voice recognition is not supported in this browser. Please try the latest Chrome or Edge."
      );
      return;
    }

    setError("");
    setLastHeard("");

    const recognition = new SpeechRecognition();
    recognition.lang = LANGUAGES[language].code;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript;
        } else {
          interimText += event.results[i][0].transcript;
        }
      }

      setLastHeard(finalText || interimText);

      if (finalText.trim()) {
        setInput((previous) =>
          `${previous}${previous ? " " : ""}${finalText}`.trim()
        );
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setError(
          `Microphone error: ${event.error}. Check your browser's microphone permissions.`
        );
      }
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setListening(false);
      setError("Could not start the microphone. Please try again.");
    }
  }, [language, listening]);

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage(input);
  };

  const clearConversation = () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();

    messagesRef.current = [];
    setMessages([]);
    setInput("");
    setError("");
    setLastHeard("");
    setSpeaking(false);
    setListening(false);
  };

  const toggleVoice = () => {
    if (voiceEnabled) {
      window.speechSynthesis?.cancel();
      setSpeaking(false);
    }
    setVoiceEnabled((value) => !value);
  };

  const statusText =
    apiStatus === "online"
      ? "SYSTEM CONNECTED"
      : apiStatus === "offline"
        ? "BACKEND OFFLINE"
        : "CONNECTING SYSTEM";

  return (
    <main className="aura-app">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <a className="brand" href="#home" aria-label="AURA home">
          <span className="brand-mark">
            <AudioLines size={25} strokeWidth={1.8} />
          </span>

          <span className="brand-copy">
            <strong>
              AURA<span> AI</span>
            </strong>
            <small>YOUR PERSONAL INTELLIGENCE</small>
          </span>
        </a>

        <div className="topbar-center">
          <span
            className={`status-dot ${
              apiStatus === "online"
                ? "is-online"
                : apiStatus === "offline"
                  ? "is-offline"
                  : ""
            }`}
          />
          <span>{statusText}</span>
          <span className="topbar-divider" />
          <span className="secure-label">
            <ShieldCheck size={14} /> PRIVATE SESSION
          </span>
        </div>

        <div className="topbar-actions">
          <div className="language-wrap">
            <button
              className="language-button"
              onClick={() => setShowLanguageMenu((value) => !value)}
              aria-expanded={showLanguageMenu}
            >
              <Languages size={16} />
              <span>{language}</span>
              <ChevronDown size={14} />
            </button>

            {showLanguageMenu && (
              <div className="language-menu">
                {Object.keys(LANGUAGES).map((item) => (
                  <button
                    key={item}
                    className={language === item ? "selected" : ""}
                    onClick={() => {
                      setLanguage(item);
                      setShowLanguageMenu(false);
                    }}
                  >
                    <span>{item}</span>
                    {language === item && <Check size={15} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className={`icon-button ${voiceEnabled ? "active" : ""}`}
            title={voiceEnabled ? "Mute spoken replies" : "Enable spoken replies"}
            onClick={toggleVoice}
          >
            {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>
      </header>

      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-label">WORKSPACE</div>

          {[
            { label: "Assistant", icon: Bot },
            { label: "Ideas & planning", icon: BrainCircuit },
            { label: "Voice control", icon: AudioLines },
          ].map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${
                activeTab === label ? "nav-active" : ""
              }`}
              onClick={() => {
                setActiveTab(label);

                if (label === "Voice control") startListening();
                if (label === "Ideas & planning") inputRef.current?.focus();
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === "Assistant" && <span className="nav-indicator" />}
            </button>
          ))}

          <div className="sidebar-label sidebar-label-spaced">
            QUICK ACTIONS
          </div>

          <div className="quick-actions">
            {QUICK_ACTIONS.map(({ icon: Icon, title, prompt }) => (
              <button
                key={title}
                className="quick-action"
                onClick={() => sendMessage(prompt)}
                disabled={busy}
              >
                <span className="quick-icon">
                  <Icon size={16} />
                </span>
                <span>{title}</span>
              </button>
            ))}
          </div>

          <div className="sidebar-bottom">
            <div className="mini-status">
              <span
                className={`status-dot ${
                  apiStatus === "online" ? "is-online" : ""
                }`}
              />
              <div>
                <strong>
                  {apiStatus === "online" ? "AURA is ready" : "Assistant status"}
                </strong>
                <small>
                  {apiStatus === "online"
                    ? "AI connection active"
                    : apiStatus === "offline"
                      ? "Start the Python backend"
                      : "Checking connection..."}
                </small>
              </div>
            </div>

            <button
              className="nav-item settings-item"
              onClick={() =>
                setError(
                  "Choose your language from the top-right menu. Use the speaker icon to turn spoken replies on or off."
                )
              }
            >
              <Settings2 size={18} />
              <span>Settings & help</span>
              <CircleHelp size={15} className="settings-help" />
            </button>

            <div className="sidebar-footer">
              AURA AI <span>•</span> PERSONAL ASSISTANT
            </div>
          </div>
        </aside>

        <section className="main-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" /> INTELLIGENCE INTERFACE
              </div>
              <h1>
                Your mind, <span>amplified.</span>
              </h1>
              <p>Think freely. Speak naturally. Let's get things moving.</p>
            </div>

            <button
              className="clear-button"
              onClick={clearConversation}
              title="Start a new conversation"
            >
              <span>New session</span>
              <Zap size={15} />
            </button>
          </div>

          <div className="command-stage">
            <div
              className={`orbital-system ${listening ? "orb-listening" : ""} ${
                speaking ? "orb-speaking" : ""
              }`}
            >
              <div className="orbit orbit-outer" />
              <div className="orbit orbit-middle" />
              <div className="orbit orbit-inner" />
              <div className="orbit-node node-one" />
              <div className="orbit-node node-two" />
              <div className="orbit-node node-three" />
              <div className="core-glow" />

              <button
                className="aura-core"
                onClick={startListening}
                aria-label={listening ? "Stop listening" : "Start voice command"}
              >
                <span className="core-rings" />
                <span className="core-logo">
                  <AudioLines size={45} strokeWidth={1.5} />
                </span>
                <span className="core-pulse" />
              </button>

              <div className="orbit-label label-top">
                <span className="tiny-dot" /> NEURAL CORE
              </div>

              <div className="orbit-label label-bottom">
                {listening
                  ? "LISTENING FOR YOUR VOICE"
                  : speaking
                    ? "AURA IS SPEAKING"
                    : "READY FOR INPUT"}
              </div>
            </div>

            <div className="stage-caption">
              <span className="stage-icon">
                <Activity size={15} />
              </span>
              <span>
                {listening
                  ? "Listening... go ahead and speak"
                  : speaking
                    ? "Responding with voice"
                    : "Your assistant is standing by"}
              </span>
              <span className="stage-caption-right">
                <Wifi size={14} /> LIVE
              </span>
            </div>
          </div>

          <div className="conversation-card">
            <div className="conversation-header">
              <div className="conversation-title">
                <span className="conversation-title-icon">
                  <Command size={16} />
                </span>
                <div>
                  <strong>Conversation</strong>
                  <small>YOUR PRIVATE THINKING SPACE</small>
                </div>
              </div>

              <span className="message-count">
                {messages.length}{" "}
                {messages.length === 1 ? "MESSAGE" : "MESSAGES"}
              </span>
            </div>

            <div
              className={`conversation-body ${
                messages.length ? "has-messages" : ""
              }`}
            >
              {messages.length === 0 ? (
                <div className="welcome-state">
                  <span className="welcome-spark">
                    <Sparkles size={19} />
                  </span>
                  <h2>{currentLanguage.greeting}</h2>
                  <p>
                    Ask a question, share a goal, or give me a task to work
                    through with you.
                  </p>

                  <div className="suggestion-chips">
                    <button
                      onClick={() =>
                        sendMessage("Help me organize my priorities for today.")
                      }
                    >
                      Organize my day <span>↗</span>
                    </button>
                    <button
                      onClick={() =>
                        sendMessage("Give me some fresh ideas for a project.")
                      }
                    >
                      Explore an idea <span>↗</span>
                    </button>
                    <button
                      onClick={() =>
                        sendMessage("What can you help me accomplish?")
                      }
                    >
                      What can you do? <span>↗</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="message-list">
                  {messages.map((message) => (
                    <article
                      key={message.id}
                      className={`chat-message ${
                        message.role === "user"
                          ? "user-message"
                          : "assistant-message"
                      }`}
                    >
                      <div className="message-avatar">
                        {message.role === "user" ? (
                          "Y"
                        ) : (
                          <AudioLines size={17} />
                        )}
                      </div>

                      <div className="message-content">
                        <div className="message-author">
                          {message.role === "user" ? "YOU" : "AURA AI"}
                        </div>
                        <p>{message.content}</p>

                        {message.role === "assistant" && (
                          <button
                            className="message-speak"
                            onClick={() => speak(message.content)}
                            title="Read response aloud"
                          >
                            <Volume2 size={14} /> Listen
                          </button>
                        )}
                      </div>
                    </article>
                  ))}

                  {busy && (
                    <div className="typing-indicator">
                      <span />
                      <span />
                      <span />
                      <small>AURA is thinking</small>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {error && (
              <div className="error-banner" role="alert">
                <CircleHelp size={16} />
                <span>{error}</span>
                <button
                  onClick={() => setError("")}
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </div>
            )}

            <form className="composer" onSubmit={handleSubmit}>
              <button
                type="button"
                className={`mic-button ${listening ? "mic-live" : ""}`}
                onClick={startListening}
                title={listening ? "Stop listening" : "Speak to AURA"}
              >
                {listening ? <MicOff size={19} /> : <Mic size={19} />}
              </button>

              <div className="composer-field">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={
                    listening
                      ? "Listening for your voice..."
                      : "Message AURA or give a command..."
                  }
                  aria-label="Message AURA"
                />

                <div className="composer-hint">
                  {lastHeard && listening
                    ? `HEARD: ${lastHeard}`
                    : "ENTER TO SEND"}{" "}
                  <span>•</span> {language.toUpperCase()}
                </div>
              </div>

              <button
                type="submit"
                className="send-button"
                disabled={!input.trim() || busy}
                aria-label="Send message"
              >
                {busy ? <span className="send-spinner" /> : <Send size={18} />}
              </button>
            </form>

            <div className="privacy-note">
              <ShieldCheck size={13} /> Voice features depend on your browser.
            </div>
          </div>

          <footer className="main-footer">
            <span>BUILT FOR YOUR EVERYDAY</span>
            <span className="footer-center">
              <span className="footer-dot" /> AI-POWERED ASSISTANCE
            </span>
            <span>
              STAY CURIOUS <Sparkles size={12} />
            </span>
          </footer>
        </section>

        <aside className="right-rail">
          <div className="rail-heading">
            <span>SESSION OVERVIEW</span>
            <span className="rail-live">LIVE</span>
          </div>

          <div className="metric-card">
            <div className="metric-top">
              <span>CORE STATUS</span>
              <span className="metric-icon">
                <Activity size={16} />
              </span>
            </div>
            <div className="metric-value">
              {apiStatus === "online"
                ? "Online"
                : apiStatus === "offline"
                  ? "Offline"
                  : "..."}
            </div>
            <div className="metric-sub">
              <span
                className={`status-dot ${
                  apiStatus === "online"
                    ? "is-online"
                    : apiStatus === "offline"
                      ? "is-offline"
                      : ""
                }`}
              />
              {apiStatus === "online"
                ? "Backend connected"
                : "Local API connection"}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-top">
              <span>VOICE INTERFACE</span>
              <span className="metric-icon">
                <AudioLines size={16} />
              </span>
            </div>
            <div className="metric-value">
              {listening ? "Listening" : speaking ? "Speaking" : "Standby"}
            </div>
            <div className="metric-sub">
              {voiceEnabled
                ? "Spoken responses enabled"
                : "Text responses only"}
            </div>

            <div className="voice-meter">
              {Array.from({ length: 22 }, (_, index) => (
                <span
                  key={index}
                  style={{ "--bar-index": index }}
                  className={listening || speaking ? "bar-active" : ""}
                />
              ))}
            </div>
          </div>

          <div className="metric-card language-metric">
            <div className="metric-top">
              <span>LANGUAGE MODE</span>
              <span className="metric-icon">
                <Globe2 size={16} />
              </span>
            </div>
            <div className="metric-value">{language}</div>
            <div className="metric-sub">
              Voice input: {currentLanguage.code}
            </div>

            <div className="language-pills">
              {Object.keys(LANGUAGES).map((item) => (
                <button
                  key={item}
                  onClick={() => setLanguage(item)}
                  className={
                    language === item ? "language-pill-active" : ""
                  }
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="rail-tip">
            <span className="tip-icon">
              <Sparkles size={17} />
            </span>
            <div>
              <strong>Pro tip</strong>
              <p>
                Talk naturally. Say “AURA, talk to me in English language” to
                switch languages, or type any task in the message box.
              </p>
            </div>
          </div>

          <div className="capabilities">
            <div className="capabilities-title">CAPABILITIES</div>

            {[
              { icon: BrainCircuit, label: "Reason & brainstorm" },
              { icon: AudioLines, label: "Voice conversations" },
              { icon: Command, label: "Plan & organize" },
              { icon: Globe2, label: "Multilingual chat" },
            ].map(({ icon: Icon, label }) => (
              <div className="capability-row" key={label}>
                <Icon size={15} />
                <span>{label}</span>
                <Check size={14} className="cap-check" />
              </div>
            ))}
          </div>

          <div className="rail-bottom">
            <span className="rail-shield">
              <ShieldCheck size={16} />
            </span>
            <span>
              YOUR ASSISTANT.
              <br />
              <strong>YOUR WORKFLOW.</strong>
            </span>
          </div>
        </aside>
      </div>
    </main>
  );
}