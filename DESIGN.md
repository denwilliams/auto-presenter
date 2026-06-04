# Auto-Presenter: Architecture & Design

## Design Decisions (Resolved Open Questions)

| Question | Decision | Rationale |
|----------|----------|-----------|
| Claude Agents SDK vs standard tool use | **Standard SDK with `toolRunner()`** | Handles the agent loop automatically, async tool handlers, no MCP/subprocess overhead. The Agents SDK is overkill for 3 custom tools. |
| WebSocket in Next.js | **Custom `server.ts` wrapping Next.js + `ws`** | App Router does not support WebSocket upgrades. Custom server is the only reliable pattern. |
| reveal.js integration | **Direct imperative DOM manipulation** | React wrappers are designed for static slides. Dynamic slides via WebSocket require `appendChild()` + `deck.sync()`. |
| TTS call location | **Server-side proxy** | Keeps OpenAI API key secure. Server fetches audio, sends binary over WebSocket to browser. |
| TTS voice | **Default "alloy"** | Good general-purpose voice. Hardcoded for PoC. |
| Slide theming | **"black" theme** | Clean, high-contrast, presentation-ready. Hardcoded for PoC. |
| Audio pre-generation vs on-demand | **On-demand per slide** | Simpler agent flow. Agent calls `speak_script`, server generates audio, streams to browser. No upfront batch. |

---

## Tech Stack (Final)

| Layer | Package | Version |
|-------|---------|---------|
| Framework | `next` | 15.x |
| Runtime | `tsx` (dev), `node` (prod) | - |
| AI SDK | `@anthropic-ai/sdk` | latest |
| WebSocket (server) | `ws` | 8.x |
| WebSocket (client) | Native `WebSocket` API | - |
| Presentation | `reveal.js` | 5.x |
| TTS | `openai` (Node SDK) | latest |
| Styling | Tailwind CSS | 4.x |
| Language | TypeScript | 5.x |

---

## Project Structure

```
auto-presenter/
├── server.ts                    # Custom server: Next.js + WebSocket
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── .env.local                   # ANTHROPIC_API_KEY, OPENAI_API_KEY
├── .gitignore
│
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout (Tailwind, fonts)
│   │   ├── page.tsx             # Main page (server component, renders InputForm + Presenter)
│   │   └── globals.css          # Tailwind base + reveal.js overrides
│   │
│   ├── components/
│   │   ├── InputForm.tsx        # Markdown input, objectives, slider, start button
│   │   ├── ProgressDisplay.tsx  # Planning/generation progress messages
│   │   ├── Presenter.tsx        # Embedded reveal.js deck + audio playback
│   │   └── AppShell.tsx         # State machine: input → progress → presenting → done
│   │
│   ├── hooks/
│   │   └── useWebSocket.ts     # WebSocket connection hook (connect, send, onMessage)
│   │
│   ├── lib/
│   │   ├── agent.ts            # Claude agent loop with tool definitions
│   │   ├── tools.ts            # Tool handler implementations (show_slide, speak_script, etc.)
│   │   ├── tts.ts              # OpenAI TTS API wrapper
│   │   └── ws-bridge.ts        # Promise-based WebSocket bridge (send command, await ack)
│   │
│   └── types/
│       └── messages.ts         # Shared types: ServerMessage, ClientMessage
│
├── REQUIREMENTS.md
└── DESIGN.md
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    AppShell                           │   │
│  │                                                       │   │
│  │  State: "input" | "generating" | "presenting" | "done"│   │
│  │                                                       │   │
│  │  ┌────────────┐ ┌──────────────┐ ┌───────────────┐  │   │
│  │  │ InputForm  │ │ProgressDisp. │ │   Presenter   │  │   │
│  │  │            │ │              │ │               │  │   │
│  │  │ - markdown │ │ - phase      │ │ - reveal.js   │  │   │
│  │  │ - prompt   │ │ - messages[] │ │ - <audio>     │  │   │
│  │  │ - slider   │ │              │ │               │  │   │
│  │  │ - start    │ │              │ │               │  │   │
│  │  └─────┬──────┘ └──────▲──────┘ └───▲───────────┘  │   │
│  │        │                │            │               │   │
│  │        │         useWebSocket hook                   │   │
│  │        │         ┌──────┴────────────┤               │   │
│  └────────│─────────│───────────────────│───────────────┘   │
│           │         │                   │                    │
│    { start }    { progress }     { show_slide }             │
│    message      messages         { speak: audio }           │
│           │         │            { complete }                │
│           │         │                   │                    │
│           ▼         │            ack: { slide_displayed }    │
│                     │            ack: { speech_complete }    │
└───────────│─────────│───────────────────│────────────────────┘
            │         │                   │
         WebSocket (ws://localhost:3000/ws)
            │         │                   │
┌───────────▼─────────┴───────────────────▼────────────────────┐
│                     server.ts                                 │
│                                                               │
│  ┌─────────────┐    ┌──────────────────────────────────────┐ │
│  │  Next.js    │    │          WebSocket Handler           │ │
│  │  (HTTP)     │    │                                      │ │
│  │             │    │  on "start" message:                 │ │
│  │  Pages,     │    │    → Launch agent loop               │ │
│  │  static     │    │                                      │ │
│  │  assets     │    │  ws-bridge.ts:                       │ │
│  │             │    │    sendAndWait(command, ackType)      │ │
│  └─────────────┘    │    → send JSON to client             │ │
│                      │    → return Promise                  │ │
│                      │    → resolve on matching ack         │ │
│                      └───────────────┬──────────────────────┘ │
│                                      │                        │
│                      ┌───────────────▼──────────────────────┐ │
│                      │         agent.ts                      │ │
│                      │                                       │ │
│                      │  anthropic.messages.create() loop     │ │
│                      │  via toolRunner()                     │ │
│                      │                                       │ │
│                      │  System prompt:                       │ │
│                      │    "You are a presentation creator.   │ │
│                      │     Given markdown + objectives,      │ │
│                      │     plan slides, then present each."  │ │
│                      │                                       │ │
│                      │  Tools:                               │ │
│                      │    show_slide → ws-bridge → browser   │ │
│                      │    speak_script → tts.ts → ws-bridge  │ │
│                      │    presentation_complete → ws-bridge   │ │
│                      └───────────┬───────────────────────────┘ │
│                                  │                             │
│                      ┌───────────▼───────────────┐            │
│                      │  External APIs             │            │
│                      │  - Anthropic (Claude)      │            │
│                      │  - OpenAI (TTS)            │            │
│                      └───────────────────────────-┘            │
└───────────────────────────────────────────────────────────────┘
```

---

## Component Design

### 1. `server.ts` — Custom Server

**Responsibilities:**
- Create HTTP server, attach Next.js request handler
- Create `WebSocketServer` with `noServer: true`
- Route `upgrade` requests: `/_next/webpack-hmr` → Next.js HMR, `/ws` → our handler
- On WebSocket connection: listen for `start` message, launch agent loop
- Single-connection model (PoC scope)

```typescript
// Pseudocode
const server = createServer(nextHandler);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  if (pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  }
  // Let Next.js handle /_next/webpack-hmr internally
});

wss.on('connection', (ws) => {
  ws.on('message', async (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'start') {
      const bridge = new WsBridge(ws);
      await runAgent(msg.markdown, msg.objectives, msg.slideCount, bridge);
    }
  });
});
```

### 2. `ws-bridge.ts` — Promise-Based WebSocket Bridge

**Responsibilities:**
- Send typed messages to client over WebSocket
- Return a Promise that resolves when the matching acknowledgment arrives
- Handle timeouts (30s default)
- Send progress messages (fire-and-forget, no ack needed)

```typescript
class WsBridge {
  private ws: WebSocket;
  private pendingAck: { type: string; resolve: (v: string) => void } | null = null;

  constructor(ws: WebSocket) {
    this.ws = ws;
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (this.pendingAck && msg.type === this.pendingAck.type) {
        this.pendingAck.resolve(msg.type);
        this.pendingAck = null;
      }
    });
  }

  // Fire-and-forget
  sendProgress(phase: string, message: string): void;

  // Send and wait for ack
  async sendAndWait(message: ServerMessage, ackType: string): Promise<string>;

  // Convenience methods
  async showSlide(data: SlideData): Promise<string>;
  async speakScript(audioBuffer: Buffer): Promise<string>;
  async presentationComplete(summary: string): Promise<string>;
}
```

### 3. `agent.ts` — Claude Agent Loop

**Responsibilities:**
- Build system prompt with markdown content and objectives
- Define tools with Zod schemas
- Run `toolRunner()` which handles the full agent loop automatically
- Tool handlers delegate to `WsBridge`

**System Prompt Design:**

```
You are a presentation creator. You will be given markdown content,
presentation objectives, and a target slide count.

Your workflow:
1. First, plan the presentation by deciding the title and theme for each
   slide. Announce your plan.
2. Then present each slide one at a time:
   - Call show_slide with the title, bullet points, slide number, and total.
   - Call speak_script with a natural narration script for that slide.
   - Wait for each tool to complete before moving on.
3. After all slides, call presentation_complete with a brief summary.

Important:
- Target exactly {slideCount} slides.
- Bullet points should be concise (3-6 per slide).
- Narration should be conversational and expand on the bullets.
- Do NOT skip any slides or combine steps.
```

**Agent loop using `toolRunner()`:**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

async function runAgent(
  markdown: string,
  objectives: string,
  slideCount: number,
  bridge: WsBridge
) {
  const anthropic = new Anthropic();

  // Send planning progress to client
  bridge.sendProgress('planning', 'Starting presentation planning...');

  const showSlideTool = betaZodTool({
    name: 'show_slide',
    description: 'Display a slide in the presentation. Wait for confirmation.',
    inputSchema: z.object({
      title: z.string(),
      bullets: z.array(z.string()),
      slideNumber: z.number().int(),
      totalSlides: z.number().int(),
    }),
    run: async (input) => {
      bridge.sendProgress('presenting', `Showing slide ${input.slideNumber}/${input.totalSlides}`);
      await bridge.showSlide(input);
      return 'Slide displayed successfully.';
    },
  });

  const speakScriptTool = betaZodTool({
    name: 'speak_script',
    description: 'Read narration aloud via TTS. Returns when speech completes.',
    inputSchema: z.object({
      text: z.string().describe('Narration script to read aloud'),
    }),
    run: async (input) => {
      // Generate TTS audio server-side
      const audioBuffer = await generateTTS(input.text);
      // Send audio to browser, wait for playback to finish
      await bridge.speakScript(audioBuffer);
      return 'Speech complete.';
    },
  });

  const presentationCompleteTool = betaZodTool({
    name: 'presentation_complete',
    description: 'Signal that the presentation is finished.',
    inputSchema: z.object({
      summary: z.string().optional(),
    }),
    run: async (input) => {
      await bridge.presentationComplete(input.summary || '');
      return 'Presentation ended.';
    },
  });

  await anthropic.beta.messages.toolRunner({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 8192,
    system: buildSystemPrompt(slideCount),
    messages: [
      {
        role: 'user',
        content: `Here is the markdown content:\n\n${markdown}\n\nObjectives: ${objectives}\n\nPlease create and present a ${slideCount}-slide presentation.`,
      },
    ],
    tools: [showSlideTool, speakScriptTool, presentationCompleteTool],
  });
}
```

### 4. `tts.ts` — OpenAI TTS Wrapper

**Responsibilities:**
- Call OpenAI TTS API with narration text
- Return audio as a `Buffer` (mp3 format)

```typescript
import OpenAI from 'openai';

const openai = new OpenAI();

export async function generateTTS(text: string): Promise<Buffer> {
  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'alloy',
    input: text,
    response_format: 'mp3',
  });

  return Buffer.from(await response.arrayBuffer());
}
```

### 5. `AppShell.tsx` — Client State Machine

**States:**
```
input → generating → presenting → done
                                    ↓
                                  input (restart)
```

```typescript
type AppState = 'input' | 'generating' | 'presenting' | 'done';

// State transitions triggered by WebSocket messages:
// "start" button click → 'generating'
// first "show_slide" message → 'presenting'
// "complete" message → 'done'
// "restart" button click → 'input'
```

### 6. `Presenter.tsx` — Embedded reveal.js

**Responsibilities:**
- Dynamic import of reveal.js (avoid SSR crash)
- Initialize deck in embedded mode with ref guard
- Expose `addSlide(data)` method via imperative DOM manipulation
- Play audio via `<audio>` element, detect `ended` event
- Communicate acks back via WebSocket

**Key implementation details:**
- reveal.js is initialized with `embedded: true`, `keyboardCondition: 'focused'`
- Slides are added via `appendChild()` on the `.slides` container + `deck.sync()` + `deck.slide(n)`
- Audio is received as binary (mp3 buffer) over WebSocket, converted to Blob URL, played via `<audio>`
- `audio.onended` triggers `{ type: 'speech_complete' }` ack
- Initial placeholder slide ("Waiting for presentation...") replaced on first real slide

### 7. `useWebSocket.ts` — Connection Hook

```typescript
function useWebSocket(url: string) {
  // Returns: { send, lastMessage, readyState, connect, disconnect }
  // Connects on mount, disconnects on unmount
  // Handles binary messages (audio) and JSON messages separately
  // Reconnection: not needed for PoC (single-use)
}
```

---

## Sequence Diagram: Full Presentation Flow

```
Browser                    Server                    Claude API       OpenAI TTS
  │                          │                          │                │
  │──── WS connect ─────────>│                          │                │
  │<──── connected ──────────│                          │                │
  │                          │                          │                │
  │  { type: "start",       │                          │                │
  │    markdown, objectives, │                          │                │
  │    slideCount }          │                          │                │
  │─────────────────────────>│                          │                │
  │                          │                          │                │
  │                          │── toolRunner() ─────────>│                │
  │                          │   system prompt +        │                │
  │                          │   user message           │                │
  │                          │                          │                │
  │  { type: "progress",    │<── text: "I'll create   │                │
  │    phase: "planning" }   │    5 slides..."          │                │
  │<─────────────────────────│                          │                │
  │                          │                          │                │
  │                          │<── tool_use: show_slide  │                │
  │                          │    { title, bullets,     │                │
  │  { type: "show_slide",  │      slideNumber: 1,     │                │
  │    title, bullets, ... } │      totalSlides: 5 }    │                │
  │<─────────────────────────│                          │                │
  │                          │                          │                │
  │  [render slide in        │                          │                │
  │   reveal.js]             │                          │                │
  │                          │                          │                │
  │  { type: "slide_displayed" }                        │                │
  │─────────────────────────>│                          │                │
  │                          │── tool_result: "displayed"│                │
  │                          │─────────────────────────>│                │
  │                          │                          │                │
  │                          │<── tool_use: speak_script│                │
  │                          │    { text: "Welcome..." }│                │
  │                          │                          │                │
  │                          │── TTS request ──────────────────────────>│
  │                          │<── audio/mp3 ───────────────────────────│
  │                          │                          │                │
  │  { type: "speak",       │                          │                │
  │    audio: <binary mp3> } │                          │                │
  │<─────────────────────────│                          │                │
  │                          │                          │                │
  │  [play audio via         │                          │                │
  │   <audio> element]       │                          │                │
  │  ...playing...           │                          │                │
  │  [audio.onended fires]   │                          │                │
  │                          │                          │                │
  │  { type: "speech_complete" }                        │                │
  │─────────────────────────>│                          │                │
  │                          │── tool_result: "done"    │                │
  │                          │─────────────────────────>│                │
  │                          │                          │                │
  │         ... repeat for slides 2-5 ...               │                │
  │                          │                          │                │
  │                          │<── tool_use:             │                │
  │                          │    presentation_complete  │                │
  │  { type: "complete",    │                          │                │
  │    summary: "..." }      │                          │                │
  │<─────────────────────────│                          │                │
  │                          │                          │                │
  │  [show "Done" state]     │                          │                │
```

---

## WebSocket Message Protocol (Final)

### Server → Client (JSON)

```typescript
type ServerMessage =
  | { type: 'progress'; phase: 'planning' | 'generating' | 'presenting'; message: string }
  | { type: 'show_slide'; title: string; bullets: string[]; slideNumber: number; totalSlides: number }
  | { type: 'speak'; audio: ArrayBuffer }  // Binary frame (mp3)
  | { type: 'complete'; summary: string }
  | { type: 'error'; message: string }
```

**Note on `speak`:** The audio data is sent as a binary WebSocket frame (not JSON). The client distinguishes binary frames (audio) from text frames (JSON commands). The server sends a JSON `{ type: 'speak_start' }` message first, then immediately sends the binary audio data. This avoids base64 encoding overhead.

Revised protocol:
```typescript
// Text frames (JSON)
type ServerTextMessage =
  | { type: 'progress'; phase: 'planning' | 'generating' | 'presenting'; message: string }
  | { type: 'show_slide'; title: string; bullets: string[]; slideNumber: number; totalSlides: number }
  | { type: 'speak_start' }   // Signals that a binary audio frame follows
  | { type: 'complete'; summary: string }
  | { type: 'error'; message: string }

// Binary frames
// Raw mp3 bytes — arrives after 'speak_start' text frame
```

### Client → Server (JSON)

```typescript
type ClientMessage =
  | { type: 'start'; markdown: string; objectives: string; slideCount: number }
  | { type: 'slide_displayed' }
  | { type: 'speech_complete' }
```

---

## Error Handling Strategy

| Error | Handling |
|-------|----------|
| Claude API failure | Send `{ type: 'error' }` to client. Client shows error with "Try Again" button. |
| OpenAI TTS failure | Send `{ type: 'error' }` to client with message. Agent tool returns error string so Claude can decide to retry or skip. |
| WebSocket disconnect during presentation | Server catches send errors, aborts agent loop. Client shows "Connection lost" with "Restart" option. |
| Agent exceeds max turns | `toolRunner` has implicit limits. Set `max_tokens` high enough. If agent stops early, treat as completion. |
| Audio playback failure | Client sends `{ type: 'speech_complete' }` anyway after a timeout (10s), allowing presentation to continue. |

---

## Key Design Constraints

1. **Single connection** — No connection tracking, no rooms. One WebSocket, one agent loop at a time.
2. **No persistence** — All state lives in memory for the duration of one presentation.
3. **Sequential tool calls** — Agent must call `show_slide` then `speak_script` in order. The `toolRunner()` handles this naturally since Claude decides the order.
4. **Binary audio over WebSocket** — Avoids base64 bloat. Client checks `typeof data === 'object'` (Blob/ArrayBuffer) vs string (JSON).
5. **reveal.js owns its DOM** — React does not manage slide elements. The `.reveal` container is a ref-controlled escape hatch.

---

## Implementation Order

1. **Project setup** — Next.js, TypeScript, Tailwind, dependencies
2. **Custom server** — `server.ts` with Next.js + WebSocket
3. **Types** — Shared message types
4. **WebSocket bridge** — `ws-bridge.ts` (server-side)
5. **TTS wrapper** — `tts.ts`
6. **Agent loop** — `agent.ts` with tool definitions
7. **Client WebSocket hook** — `useWebSocket.ts`
8. **Input form** — `InputForm.tsx`
9. **Progress display** — `ProgressDisplay.tsx`
10. **Presenter** — `Presenter.tsx` with reveal.js
11. **App shell** — `AppShell.tsx` state machine
12. **Integration & testing**
