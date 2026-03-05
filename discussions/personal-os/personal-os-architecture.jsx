import { useState } from "react";

const schema = {
  vectors: {
    label: "Vector Store",
    color: "#00D4FF",
    description: "Atomic facts & thoughts with embeddings",
    table: "memory_chunks",
    fields: [
      { name: "id", type: "uuid", note: "PK" },
      { name: "text", type: "text", note: "Full rich content" },
      { name: "embedding", type: "vector(1536)", note: "OpenAI / Cohere" },
      { name: "tags", type: "text[]", note: "e.g. ['USP','marketing']" },
      { name: "entity_type", type: "enum", note: "business | person | challenge | insight | preference" },
      { name: "linked_pursuits", type: "text[]", note: "pursuit slugs" },
      { name: "importance", type: "float", note: "0.0 – 1.0, LLM-scored" },
      { name: "created_at", type: "timestamptz", note: "" },
      { name: "superseded_by", type: "uuid", note: "FK → self (versioning)" },
    ]
  },
  narratives: {
    label: "Temporal Narratives",
    color: "#FF6B35",
    description: "Living documents per major entity / pursuit",
    table: "narratives",
    fields: [
      { name: "id", type: "uuid", note: "PK" },
      { name: "topic", type: "text", note: "e.g. 'daga-wallpapers', 'marketing'" },
      { name: "topic_type", type: "enum", note: "business | pursuit | person | domain" },
      { name: "content", type: "text", note: "Timestamped markdown narrative" },
      { name: "summary", type: "text", note: "LLM-generated TL;DR" },
      { name: "last_updated", type: "timestamptz", note: "" },
      { name: "version", type: "int", note: "Increments on each LLM edit" },
    ]
  },
  pursuits: {
    label: "Task Graph",
    color: "#A855F7",
    description: "Pursuits → Projects → Tasks execution layer",
    table: "pursuits / projects / tasks",
    fields: [
      { name: "pursuit", type: "text", note: "marketing | biz-dev | ops | sales" },
      { name: "project_name", type: "text", note: "e.g. 'Instagram Ads'" },
      { name: "task_title", type: "text", note: "Atomic action item" },
      { name: "status", type: "enum", note: "backlog | active | done | blocked" },
      { name: "context_chunk_ids", type: "uuid[]", note: "← links to vector store" },
      { name: "narrative_id", type: "uuid", note: "FK → narratives" },
      { name: "due_date", type: "date", note: "" },
    ]
  }
};

const pipeline = [
  {
    step: "01",
    title: "Input",
    color: "#00D4FF",
    description: "Voice or text message arrives",
    detail: "Transcribed via Whisper if audio. Raw input passed to LLM Router."
  },
  {
    step: "02",
    title: "LLM Router",
    color: "#FFD700",
    description: "Classify intent of the message",
    detail: `Prompt: "Classify this message into one or more of: [FACT, TASK, QUESTION, CONTEXT_UPDATE, REFLECTION]. Extract entities mentioned."`,
    code: `const ROUTER_PROMPT = \`
Classify the user message. Return JSON:
{
  "intents": ["FACT"|"TASK"|"QUESTION"|"CONTEXT_UPDATE"],
  "entities": ["Daga Wallpapers", "marketing", ...],
  "pursuits_affected": ["marketing", "biz-dev", ...],
  "importance": 0.0-1.0
}\``
  },
  {
    step: "03",
    title: "Dual Write",
    color: "#FF6B35",
    description: "Write to Vector Store AND update Narrative",
    detail: "Parallel async writes. Vector chunk stores full text + embedding. Narrative LLM appends a timestamped line to the relevant topic doc.",
    code: `// Vector write
await supabase.from('memory_chunks').insert({
  text: message,
  embedding: await embed(message),
  tags: extracted_tags,
  linked_pursuits: pursuits_affected,
  importance: score
});

// Narrative update (async, non-blocking)
const narrative = await getNarrative(primary_entity);
const updated = await llm.append(narrative, message);
await supabase.from('narratives')
  .update({ content: updated, version: narrative.version + 1 })
  .eq('topic', primary_entity);`
  },
  {
    step: "04",
    title: "Task Extraction",
    color: "#A855F7",
    description: "If TASK intent detected, create/update task graph",
    detail: "LLM determines which pursuit/project this belongs to. Creates new project if no match found above similarity threshold.",
    code: `// Find best matching project
const matches = await supabase.rpc('match_projects', {
  query_embedding: await embed(message),
  threshold: 0.78
});

if (matches.length === 0) {
  // Create new project
  await createProject(pursuit, inferred_name);
}
await createTask(project_id, task_title, context_chunk_ids);`
  },
  {
    step: "05",
    title: "Retrieval",
    color: "#00FF88",
    description: "On query: hybrid vector + narrative fetch",
    detail: "Vector search finds relevant atomic facts. Narrative for the primary topic is loaded in full. Both injected into LLM context.",
    code: `// Hybrid retrieval
const chunks = await supabase.rpc('vector_search', {
  query_embedding: await embed(query),
  match_count: 8,
  filter_pursuits: active_pursuits
});

const narrative = await getNarrative(primary_topic);

const context = \`
### Recent Facts:
\${chunks.map(c => \`- \${c.text}\`).join('\\n')}

### \${narrative.topic} Overview:
\${narrative.summary}
\${narrative.content.slice(-2000)} // last 2000 chars
\`;`
  }
];

const codeSnippets = {
  embed: `// Embedding utility
export async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}`,
  narrativeUpdate: `// Narrative append prompt
const NARRATIVE_UPDATE_PROMPT = (existing, newInfo) => \`
You maintain a living document about: {topic}
Existing document:
{existing}

New information just shared:
"{newInfo}"

Append a timestamped entry. If the new info contradicts 
something old, mark the old fact as [SUPERSEDED].
Keep total length under 3000 words.
Return only the updated document.\``,
  supabaseRPC: `-- Supabase vector search RPC
create or replace function vector_search(
  query_embedding vector(1536),
  match_count int,
  filter_pursuits text[] default null
)
returns table (id uuid, text text, tags text[], similarity float)
language plpgsql as $$
begin
  return query
  select
    id, text, tags,
    1 - (embedding <=> query_embedding) as similarity
  from memory_chunks
  where
    superseded_by is null
    and (filter_pursuits is null 
         or linked_pursuits && filter_pursuits)
  order by embedding <=> query_embedding
  limit match_count;
end; $$;`
};

export default function PersonalOSArchitecture() {
  const [activeTab, setActiveTab] = useState("flow");
  const [activeStep, setActiveStep] = useState(null);
  const [activeSchema, setActiveSchema] = useState("vectors");
  const [activeSnippet, setActiveSnippet] = useState("embed");

  return (
    <div style={{
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      background: "#0A0A0F",
      color: "#E8E8E0",
      minHeight: "100vh",
      padding: "0",
      overflow: "hidden"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        .tab-btn { 
          background: none; border: none; cursor: pointer; 
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
          padding: 8px 18px; color: #555; transition: all 0.2s;
          border-bottom: 2px solid transparent;
        }
        .tab-btn.active { color: #E8E8E0; border-bottom-color: #00D4FF; }
        .tab-btn:hover { color: #999; }
        .step-card {
          border: 1px solid #1A1A2E;
          background: #0D0D18;
          border-radius: 6px;
          padding: 14px 16px;
          cursor: pointer;
          transition: all 0.25s;
        }
        .step-card:hover, .step-card.active {
          border-color: var(--c);
          background: #12121F;
          box-shadow: 0 0 20px -5px var(--c);
        }
        .code-block {
          background: #060609;
          border: 1px solid #1A1A2E;
          border-radius: 6px;
          padding: 16px;
          font-size: 11px;
          line-height: 1.7;
          overflow-x: auto;
          white-space: pre;
          color: #A8B8C8;
        }
        .field-row {
          display: grid;
          grid-template-columns: 150px 130px 1fr;
          gap: 8px;
          padding: 6px 0;
          border-bottom: 1px solid #141420;
          font-size: 11px;
          align-items: center;
        }
        .field-row:last-child { border-bottom: none; }
        .tag {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 3px;
          font-size: 10px;
          letter-spacing: 0.05em;
        }
        .snippet-btn {
          background: none; border: 1px solid #1A1A2E; cursor: pointer;
          font-family: 'IBM Plex Mono', monospace; font-size: 10px;
          padding: 5px 12px; color: #555; transition: all 0.2s;
          border-radius: 3px; letter-spacing: 0.08em;
        }
        .snippet-btn.active { color: #00D4FF; border-color: #00D4FF40; background: #00D4FF08; }
        .snippet-btn:hover { color: #888; }
        .arch-box {
          border: 1px solid #1A1A2E;
          border-radius: 6px;
          padding: 12px 16px;
          background: #0D0D18;
        }
      `}</style>

      {/* Header */}
      <div style={{
        borderBottom: "1px solid #1A1A2E",
        padding: "16px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#08080F"
      }}>
        <div>
          <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>
            Personal OS · Implementation Design
          </div>
          <div style={{ fontSize: 16, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, color: "#E8E8E0", letterSpacing: "-0.02em" }}>
            Vector Store + Temporal Narratives
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["#2", "#5"].map(n => (
            <span key={n} style={{
              background: "#00D4FF15",
              border: "1px solid #00D4FF30",
              color: "#00D4FF",
              borderRadius: 4,
              padding: "3px 10px",
              fontSize: 11,
              letterSpacing: "0.05em"
            }}>{n}</span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid #1A1A2E", padding: "0 28px", background: "#08080F", display: "flex", gap: 4 }}>
        {["flow", "schema", "code", "context"].map(t => (
          <button key={t} className={`tab-btn ${activeTab === t ? "active" : ""}`} onClick={() => setActiveTab(t)}>
            {t === "flow" ? "Pipeline Flow" : t === "schema" ? "DB Schema" : t === "code" ? "Code Patterns" : "Context Assembly"}
          </button>
        ))}
      </div>

      <div style={{ padding: "24px 28px", height: "calc(100vh - 108px)", overflowY: "auto" }}>

        {/* FLOW TAB */}
        {activeTab === "flow" && (
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Pipeline Steps</div>
              {pipeline.map((p, i) => (
                <div
                  key={i}
                  className={`step-card ${activeStep === i ? "active" : ""}`}
                  style={{ "--c": p.color }}
                  onClick={() => setActiveStep(activeStep === i ? null : i)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 10, color: p.color, letterSpacing: "0.1em", fontWeight: 600 }}>{p.step}</span>
                    <span style={{ fontSize: 12, fontFamily: "'Space Grotesk',sans-serif", fontWeight: 500 }}>{p.title}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "#555", marginTop: 4, lineHeight: 1.5 }}>{p.description}</div>
                </div>
              ))}
            </div>

            <div>
              {activeStep !== null ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <span style={{ fontSize: 11, color: pipeline[activeStep].color, letterSpacing: "0.1em" }}>{pipeline[activeStep].step}</span>
                    <span style={{ fontSize: 18, fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600 }}>{pipeline[activeStep].title}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#888", lineHeight: 1.8, marginBottom: 16 }}>{pipeline[activeStep].detail}</p>
                  {pipeline[activeStep].code && (
                    <div className="code-block">{pipeline[activeStep].code}</div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Architecture Overview</div>
                  {/* Flow diagram */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {[
                      { label: "Voice / Text Input", color: "#00D4FF", sub: "Whisper STT → raw string" },
                      { label: "LLM Router", color: "#FFD700", sub: "intent + entity classification" },
                      { label: "FACT / CONTEXT?", color: "#FF6B35", sub: null, branch: true },
                      { label: "Vector Chunk Write", color: "#FF6B35", sub: "embed → Supabase pgvector", indent: true },
                      { label: "Narrative Append", color: "#FF6B35", sub: "LLM updates living doc", indent: true },
                      { label: "TASK detected?", color: "#A855F7", sub: null, branch: true },
                      { label: "Match / Create Project", color: "#A855F7", sub: "similarity threshold 0.78", indent: true },
                      { label: "Task Record Created", color: "#A855F7", sub: "linked to chunk_ids", indent: true },
                      { label: "QUESTION / Query?", color: "#00FF88", sub: null, branch: true },
                      { label: "Hybrid Retrieval", color: "#00FF88", sub: "vector search + narrative load", indent: true },
                      { label: "LLM Response", color: "#00FF88", sub: "context-grounded answer", indent: true },
                    ].map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "stretch" }}>
                        {item.indent && (
                          <div style={{ width: 24, display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <div style={{ width: 1, background: "#1A1A2E", flex: 1 }} />
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "8px 12px",
                            margin: item.branch ? "6px 0 2px" : "2px 0",
                            background: item.branch ? "transparent" : "#0D0D18",
                            border: item.branch ? "none" : `1px solid ${item.color}20`,
                            borderRadius: 4,
                            borderLeft: item.branch ? `3px solid ${item.color}` : `3px solid ${item.color}`,
                          }}>
                            <span style={{
                              fontSize: item.branch ? 10 : 12,
                              color: item.branch ? item.color : "#D0D0C8",
                              letterSpacing: item.branch ? "0.1em" : "0",
                              textTransform: item.branch ? "uppercase" : "none",
                              fontFamily: item.branch ? "IBM Plex Mono" : "'Space Grotesk', sans-serif",
                              fontWeight: item.branch ? 400 : 500
                            }}>{item.label}</span>
                            {item.sub && <span style={{ fontSize: 10, color: "#444", marginLeft: "auto" }}>{item.sub}</span>}
                          </div>
                          {!item.branch && !item.indent && (
                            <div style={{ display: "flex", justifyContent: "center" }}>
                              <div style={{ width: 1, height: 4, background: "#1A1A2E" }} />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 16, fontSize: 10, color: "#444" }}>← Click a step to see implementation details</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SCHEMA TAB */}
        {activeTab === "schema" && (
          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Tables</div>
              {Object.entries(schema).map(([key, val]) => (
                <div
                  key={key}
                  onClick={() => setActiveSchema(key)}
                  style={{
                    padding: "10px 14px",
                    border: `1px solid ${activeSchema === key ? val.color + "50" : "#1A1A2E"}`,
                    borderLeft: `3px solid ${val.color}`,
                    background: activeSchema === key ? val.color + "08" : "#0D0D18",
                    borderRadius: 4,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  <div style={{ fontSize: 12, fontFamily: "'Space Grotesk',sans-serif", fontWeight: 500, color: activeSchema === key ? val.color : "#CCC" }}>{val.label}</div>
                  <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>{val.table}</div>
                </div>
              ))}
            </div>

            <div>
              {(() => {
                const s = schema[activeSchema];
                return (
                  <div>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 18, fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, color: s.color }}>{s.label}</div>
                      <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{s.description}</div>
                    </div>
                    <div className="arch-box">
                      <div className="field-row" style={{ borderBottom: "1px solid #1A1A2E" }}>
                        <span style={{ fontSize: 10, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase" }}>Column</span>
                        <span style={{ fontSize: 10, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase" }}>Type</span>
                        <span style={{ fontSize: 10, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase" }}>Notes</span>
                      </div>
                      {s.fields.map((f, i) => (
                        <div key={i} className="field-row">
                          <span style={{ color: s.color, fontWeight: 500, fontSize: 12 }}>{f.name}</span>
                          <span className="tag" style={{ background: "#1A1A2E", color: "#7090A0", fontFamily: "IBM Plex Mono" }}>{f.type}</span>
                          <span style={{ color: "#555", fontSize: 11 }}>{f.note}</span>
                        </div>
                      ))}
                    </div>

                    {activeSchema === "vectors" && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Indexing Strategy</div>
                        <div className="code-block">{`-- Enable pgvector
create extension if not exists vector;

-- HNSW index for fast ANN search
create index on memory_chunks 
using hnsw (embedding vector_cosine_ops)
with (m = 16, ef_construction = 64);

-- Composite index for filtered search
create index on memory_chunks(linked_pursuits, importance)
where superseded_by is null;`}</div>
                      </div>
                    )}

                    {activeSchema === "narratives" && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Example Narrative Content</div>
                        <div className="code-block">{`topic: "daga-wallpapers"
---
[2024-Nov] Company imports European wallpapers exclusively.
  USP: collections unavailable elsewhere in India. 
  Customers driven by exclusivity.

[2025-Jan] Main challenge: inventory visibility across 
  Kolkata store + pan-India distributors. ~60% digitized.

[2025-Feb] Started QR-based inventory system. 
  OCR verification layer added.

[2025-Mar] Footfall improving post-renovation. ~~[SUPERSEDED: 
  footfall was a challenge]~~ Kolkata store performing well.

[2025-Mar] Coordonné integration complete on website.
  CORS resolved via proxy approach.`}</div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* CODE TAB */}
        {activeTab === "code" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {Object.keys(codeSnippets).map(k => (
                <button key={k} className={`snippet-btn ${activeSnippet === k ? "active" : ""}`} onClick={() => setActiveSnippet(k)}>
                  {k === "embed" ? "embedding util" : k === "narrativeUpdate" ? "narrative prompt" : "supabase rpc"}
                </button>
              ))}
            </div>
            <div className="code-block" style={{ fontSize: 12, lineHeight: 1.8 }}>{codeSnippets[activeSnippet]}</div>

            <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="arch-box">
                <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Stack</div>
                {[
                  ["Vector DB", "Supabase pgvector", "#00D4FF"],
                  ["Embeddings", "text-embedding-3-small", "#00D4FF"],
                  ["LLM", "Claude Sonnet / GPT-4o", "#FFD700"],
                  ["Narratives", "Supabase postgres", "#FF6B35"],
                  ["Tasks", "Supabase postgres", "#A855F7"],
                  ["STT", "Whisper API", "#00FF88"],
                  ["Backend", "Next.js API routes", "#888"],
                ].map(([k, v, c]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #141420", fontSize: 11 }}>
                    <span style={{ color: "#666" }}>{k}</span>
                    <span style={{ color: c }}>{v}</span>
                  </div>
                ))}
              </div>

              <div className="arch-box">
                <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>LLM Calls per Interaction</div>
                {[
                  ["Router (classify)", "1 call", "always", "#FFD700"],
                  ["Narrative update", "1 call", "if FACT/CONTEXT", "#FF6B35"],
                  ["Project matching", "~0 calls", "vector similarity", "#A855F7"],
                  ["Response gen", "1 call", "if QUESTION", "#00FF88"],
                ].map(([k, v, when, c]) => (
                  <div key={k} style={{ padding: "6px 0", borderBottom: "1px solid #141420" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                      <span style={{ color: "#888" }}>{k}</span>
                      <span style={{ color: c, fontWeight: 600 }}>{v}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#444" }}>{when}</div>
                  </div>
                ))}
                <div style={{ marginTop: 8, fontSize: 10, color: "#555", lineHeight: 1.6 }}>
                  Max 2–3 LLM calls per message.<br />Narrative updates can be async / batched.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CONTEXT ASSEMBLY TAB */}
        {activeTab === "context" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Query → Context Assembly</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "1. Embed the query", color: "#00D4FF", detail: "Convert user question to vector" },
                  { label: "2. Vector search", color: "#00D4FF", detail: "Top 8 chunks by cosine similarity\nFiltered by active pursuits if known" },
                  { label: "3. Identify primary topic", color: "#FF6B35", detail: "LLM extracts main entity from query\ne.g. 'marketing', 'daga-wallpapers'" },
                  { label: "4. Load narrative", color: "#FF6B35", detail: "Full living doc for that topic\n+ summary of all other narratives" },
                  { label: "5. Load active tasks", color: "#A855F7", detail: "Open tasks linked to relevant pursuits\nShown as brief list" },
                  { label: "6. Assemble prompt", color: "#00FF88", detail: "Structured context block injected\ninto LLM system prompt" },
                ].map((s, i) => (
                  <div key={i} style={{
                    padding: "10px 14px",
                    background: "#0D0D18",
                    border: `1px solid ${s.color}20`,
                    borderLeft: `3px solid ${s.color}`,
                    borderRadius: 4
                  }}>
                    <div style={{ fontSize: 12, fontFamily: "'Space Grotesk',sans-serif", fontWeight: 500, color: "#CCC" }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: "#555", marginTop: 3, whiteSpace: "pre-line" }}>{s.detail}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Assembled Context (Example)</div>
              <div className="code-block" style={{ fontSize: 10.5, lineHeight: 1.75 }}>{`SYSTEM PROMPT:
You are Ishan's Personal OS. Answer using context below.
Be direct. Prioritize recent facts over older ones.

### Relevant Facts (vector search):
- Our USP: European collections unavailable elsewhere in India
- Coordonné integration complete on website (Mar 2025)
- Inventory system ~60% digitized
- Kolkata footfall improving post-renovation
- No photographer available for Instagram shoot currently

### Daga Wallpapers — Current Narrative:
[Summary]: European wallpaper importer with exclusive 
positioning. Inventory digitization in progress. 
Website recently updated with Coordonné.
[Recent]: Footfall improving. Photographer still needed
for Instagram campaign.

### Active Tasks (marketing pursuit):
- [ ] Find photographer for Instagram shoot
- [ ] Write copy for 3 reel concepts  
- [ ] Revamp website hero section

---
USER: What should I prioritize for marketing this week?`}</div>

              <div style={{ marginTop: 16 }} className="arch-box">
                <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Reorganization Handling</div>
                <p style={{ fontSize: 11, color: "#666", lineHeight: 1.8 }}>
                  When you re-think pursuit groupings, only the <span style={{ color: "#A855F7" }}>task graph edges</span> change.
                  <br /><br />
                  Vector chunks keep their <span style={{ color: "#00D4FF" }}>tags + embeddings</span> — just re-run a batch update on <code style={{ color: "#FF6B35" }}>linked_pursuits[]</code>.
                  <br /><br />
                  Narratives are by <span style={{ color: "#FF6B35" }}>topic</span>, not by pursuit hierarchy — so merging two pursuits just means loading both narratives at query time.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
