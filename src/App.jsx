import { useState, useRef } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";

const AGENTS = {
  architect: {
    id: "architect", name: "Architect", mmName: "သုတ",
    icon: "🗺️", role: "Roadmap ချပေးသူ", color: "#4f9eff",
    systemPrompt: `You are the Architect agent (သုတ). Give clear ROADMAP and tech stack recommendations.
- Write in Myanmar (Burmese) + technical English
- Provide step-by-step roadmap, tech stack, folder structure if needed
- Be concise (3-5 points max)
- Do NOT write code examples — that's Instructor's job`,
  },
  instructor: {
    id: "instructor", name: "Instructor", mmName: "ဆရာဟန်",
    icon: "👨‍🏫", role: "ကုဒ်သင်ပေးသူ", color: "#43e97b",
    systemPrompt: `You are the Instructor agent (ဆရာဟန်). TEACH with working code examples.
- Write in Myanmar (Burmese) + technical English
- Provide real, working code with brief Burmese explanations per section
- Explain the WHY behind the code, not just the HOW`,
  },
  reviewer: {
    id: "reviewer", name: "Reviewer", mmName: "ဂျီးများသူ",
    icon: "🔍", role: "ကုဒ်စစ်ဆေးသူ", color: "#f7971e",
    systemPrompt: `You are the Reviewer agent (ဂျီးများသူ). Critically review code.
- Write in Myanmar (Burmese)
- Find issues, bad practices, security holes, performance problems
- Suggest specific fixes with corrected snippets
- Give "Code Score: X/10" with honest reasoning
- Be direct and constructive`,
  },
  debugger: {
    id: "debugger", name: "Debugger", mmName: "ကိုဖြေ",
    icon: "🐛", role: "Error ရှင်းပေးသူ", color: "#f953c6",
    systemPrompt: `You are the Debugger agent (ကိုဖြေ). Fix errors and explain bugs.
- Write in Myanmar (Burmese)
- Show ❌ Wrong → ✅ Fixed for each bug
- Explain WHY the error happens
- End with ✅ Final Checklist`,
  },
};

const ROUTER_PROMPT = `You are a smart router for a Coding Mentor AI system with 4 agents:
- architect: For roadmap, planning, "where to start", tech stack questions
- instructor: For "how to code", learning concepts, code examples, tutorials
- reviewer: For "is my code good?", code review, best practices check, pasting code for feedback
- debugger: For errors, bugs, "why doesn't this work", fixing issues

Analyze the user's question and return ONLY a JSON array of agent IDs needed.
Rules:
- Return minimum agents needed (usually 1-2)
- Only use all 4 for very broad/complex questions
- Return format: ["architect"] or ["instructor","reviewer"] etc.
- No explanation, just the JSON array.`;

async function callClaude(system, userMsg) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY?.trim();
  if (!apiKey) throw new Error("Missing VITE_GROQ_API_KEY");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama3-70b-8192",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
      max_tokens: 1000,
    }),
  });

  const data = await res.json();
  if (!data.choices || !data.choices[0]) {
    throw new Error(data.error?.message || JSON.stringify(data));
  }
  return data.choices[0].message.content;
}

async function routeQuestion(question) {
  const raw = await callClaude(ROUTER_PROMPT, question);
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const ids = JSON.parse(clean);
    return ids.filter((id) => AGENTS[id]);
  } catch {
    return ["instructor"];
  }
}

function AgentBadge({ agent, state }) {
  const isActive = state === "thinking";
  const isDone = state === "done";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "4px 10px",
      background: isActive ? `${agent.color}18` : isDone ? "#43e97b12" : "#ffffff06",
      border: `1px solid ${isActive ? agent.color : isDone ? "#43e97b" : "#ffffff0a"}`,
      borderRadius: 99,
      fontSize: 12,
      color: isActive ? agent.color : isDone ? "#43e97b" : "#5a5a7a",
      transition: "all 0.3s",
      boxShadow: isActive ? `0 0 10px ${agent.color}33` : "none",
    }}>
      <span>{agent.icon}</span>
      <span style={{ fontWeight: 600 }}>{agent.mmName}</span>
      {isActive && (
        <span style={{ display: "flex", gap: 2 }}>
          {[0,1,2].map(i => (
            <span key={i} style={{
              width: 3, height: 3, borderRadius: "50%",
              background: agent.color,
              display: "inline-block",
              animation: `dot 1.2s ease ${i*0.2}s infinite`,
            }}/>
          ))}
        </span>
      )}
      {isDone && <span style={{ fontSize: 10 }}>✓</span>}
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  const isRouter = msg.role === "router";
  const isAgent = msg.role === "agent";

  if (isUser) return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
      <div style={{
        maxWidth: "70%", padding: "11px 16px",
        background: "linear-gradient(135deg,#4f9eff,#7b6dfa)",
        borderRadius: "18px 18px 4px 18px",
        fontSize: 14, color: "#fff", lineHeight: 1.6,
      }}>{msg.text}</div>
    </div>
  );

  if (isRouter) return (
    <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
      <div style={{
        padding: "8px 14px",
        background: "#1a1a2e", border: "1px solid #ffffff0a",
        borderRadius: "18px 18px 18px 4px",
        fontSize: 12, color: "#5a5a7a",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span>⚡</span>
        <span>Router → {msg.agents.map(id => AGENTS[id]?.mmName).join(", ")} ကို ခေါ်မယ်</span>
      </div>
    </div>
  );

  if (isAgent) {
    const agent = AGENTS[msg.agentId];
    return (
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "flex-start" }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: `${agent.color}18`, border: `1px solid ${agent.color}33`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16,
        }}>{agent.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: agent.color }}>{agent.name}</span>
            <span style={{ fontSize: 11, color: "#3a3a5a" }}>{agent.mmName}</span>
            <span style={{ fontSize: 11, color: "#3a3a5a", marginLeft: "auto" }}>{msg.elapsed}s</span>
          </div>
          <div 
            style={{
              background: "#13141f", border: "1px solid #ffffff08",
              borderRadius: "4px 18px 18px 18px",
              padding: "12px 14px",
              fontSize: 14, lineHeight: 1.75,
              color: "#cccce0",
            }}
            dangerouslySetInnerHTML={{
              __html: msg.text
                // Python Code Block တွေကို ပြင်ဆင်ခြင်း
                .replace(/```python\n([\s\S]*?)```/g, "<pre style='background:#000;color:#0f0;padding:10px;border-radius:5px;font-family:monospace;'><code>$1</code></pre>")
                // စာလုံးအမည်း (Bold) တင်ခြင်း
                .replace(/\*\*\*(.*?)\*\*\*/g, "<strong>$1</strong>")
                .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                // စာလုံးစောင်း (Italic) တင်ခြင်း
                .replace(/\*(.*?)\*/g, "<em>$1</em>")
                // Inline Code များ
                .replace(/`(.*?)`/g, "<code style='background:#ffffff15;padding:2px 6px;border-radius:4px'>$1</code>")
                // စာကြောင်းအသစ် ဆင်းခြင်း
                .replace(/\n/g, "<br/>")
            }}
          />
        </div>
      </div>
    );
  }
  return null;
}

function ThinkingBubble({ agent }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        background: `${agent.color}18`, border: `1px solid ${agent.color}44`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, boxShadow: `0 0 12px ${agent.color}22`,
      }}>{agent.icon}</div>
      <div style={{
        background: "#13141f", border: `1px solid ${agent.color}22`,
        borderRadius: "4px 18px 18px 18px",
        padding: "12px 16px",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ fontSize: 12, color: agent.color }}>{agent.mmName} စဉ်းစားနေတယ်</span>
        <span style={{ display: "flex", gap: 3 }}>
          {[0,1,2].map(i => (
            <span key={i} style={{
              width: 5, height: 5, borderRadius: "50%",
              background: agent.color, display: "inline-block",
              animation: `dot 1.2s ease ${i*0.2}s infinite`,
            }}/>
          ))}
        </span>
      </div>
    </div>
  );
}

export default function SmartAgentChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [running, setRunning] = useState(false);
  const [agentStates, setAgentStates] = useState({});
  const [thinkingAgent, setThinkingAgent] = useState(null);
  const bottomRef = useRef(null);

  const scroll = () => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

  const send = async () => {
    if (!input.trim() || running) return;
    const question = input.trim();
    setInput("");
    setRunning(true);
    setAgentStates({});

    setMessages(prev => [...prev, { role: "user", text: question }]);
    scroll();

    try {
      // Route
      const agentIds = await routeQuestion(question);
      setMessages(prev => [...prev, { role: "router", agents: agentIds }]);
      scroll();

      // Call each agent
      const prevResponses = [];
      for (const agentId of agentIds) {
        const agent = AGENTS[agentId];
        setThinkingAgent(agentId);
        setAgentStates(s => ({ ...s, [agentId]: "thinking" }));
        scroll();

        const context = prevResponses.length > 0
          ? `\n\nPrevious agents:\n${prevResponses.map(r => `[${r.name}]: ${r.text}`).join("\n\n")}`
          : "";

        const start = Date.now();
        const text = await callClaude(agent.systemPrompt, `User question: ${question}${context}`);
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);

        setThinkingAgent(null);
        setAgentStates(s => ({ ...s, [agentId]: "done" }));
        prevResponses.push({ name: agent.name, text });
        setMessages(prev => [...prev, { role: "agent", agentId, text, elapsed }]);
        scroll();
      }

    } catch (e) {
      setMessages(prev => [...prev, {
        role: "agent", agentId: "debugger",
        text: `Error ဖြစ်သွားတယ်: ${e.message}`, elapsed: "0"
      }]);
    }

    setThinkingAgent(null);
    setRunning(false);
    scroll();
  };

  const quickQuestions = [
    "React ကို ဘယ်ကစပြီး သင်ရမလဲ?",
    "useState ဘယ်လိုသုံးရမလဲ?",
    "ဒီ error ဘာဖြစ်နေလဲ: Cannot read property of undefined",
    "ငါ့ code စစ်ပေးပါ",
  ];

  const activeAgents = Object.entries(agentStates).filter(([,s]) => s).map(([id]) => id);

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: "#07080f", color: "#eeeeff",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes dot { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        textarea { outline: none; }
        * { box-sizing: border-box; }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "14px 20px",
        borderBottom: "1px solid #ffffff08",
        background: "#0f1018",
        display: "flex", alignItems: "center", gap: 12,
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 16,
          background: "linear-gradient(90deg,#4f9eff,#f953c6)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>Coding Mentor</div>
        <div style={{ fontSize: 11, color: "#3a3a5a" }}>Smart Agent Router</div>

        {/* Active agents */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {activeAgents.map(id => (
            <AgentBadge key={id} agent={AGENTS[id]} state={agentStates[id]} />
          ))}
          {activeAgents.length === 0 && (
            <div style={{ fontSize: 11, color: "#3a3a5a" }}>
              {Object.values(AGENTS).map(a => a.icon).join(" ")} အသင်ဆင်နေတယ်
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>

          {messages.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>🤖</div>
              <div style={{
                fontFamily: "Syne, sans-serif", fontSize: 20, fontWeight: 800,
                marginBottom: 8,
                background: "linear-gradient(90deg,#4f9eff,#f953c6)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>Smart Coding Mentor</div>
              <div style={{ fontSize: 13, color: "#5a5a7a", marginBottom: 28 }}>
                မေးခွန်းပေါ်မူတည်ပြီး သက်ဆိုင်တဲ့ Agent ကိုသာ ခေါ်မယ်
              </div>

              {/* Agent info */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24, textAlign: "left" }}>
                {Object.values(AGENTS).map(agent => (
                  <div key={agent.id} style={{
                    background: "#13141f", border: "1px solid #ffffff08",
                    borderRadius: 10, padding: "10px 12px",
                    display: "flex", gap: 8, alignItems: "center",
                  }}>
                    <span style={{ fontSize: 18 }}>{agent.icon}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: agent.color }}>{agent.mmName}</div>
                      <div style={{ fontSize: 11, color: "#3a3a5a" }}>{agent.role}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick questions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {quickQuestions.map(q => (
                  <button key={q} onClick={() => setInput(q)} style={{
                    padding: "9px 14px",
                    background: "#13141f", border: "1px solid #ffffff08",
                    borderRadius: 10, color: "#8888aa", fontSize: 13,
                    cursor: "pointer", textAlign: "left",
                    transition: "all 0.2s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor="#ffffff18"; e.currentTarget.style.color="#eeeeff"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor="#ffffff08"; e.currentTarget.style.color="#8888aa"; }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}

          {thinkingAgent && <ThinkingBubble agent={AGENTS[thinkingAgent]} />}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{
        padding: "12px 16px",
        borderTop: "1px solid #ffffff08",
        background: "#0f1018",
        flexShrink: 0,
      }}>
        <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", gap: 10 }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Coding မေးခွန်း ရေးပါ... (Enter နှိပ်ပြီး ပို့)"
            rows={1}
            style={{
              flex: 1, background: "#13141f",
              border: "1px solid #ffffff0a", borderRadius: 12,
              padding: "11px 14px", color: "#eeeeff",
              fontSize: 14, resize: "none",
              fontFamily: "DM Sans, sans-serif", lineHeight: 1.5,
            }}
          />
          <button onClick={send} disabled={running || !input.trim()} style={{
            width: 44, height: 44,
            background: running ? "#1a1a2e" : "linear-gradient(135deg,#4f9eff,#7b6dfa)",
            border: "none", borderRadius: 12,
            color: "#fff", fontSize: 18, cursor: running ? "not-allowed" : "pointer",
            opacity: (!input.trim() && !running) ? 0.4 : 1,
            flexShrink: 0, transition: "all 0.2s",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {running ? "⏳" : "↑"}
          </button>
        </div>
      </div>
    </div>
  );
}
