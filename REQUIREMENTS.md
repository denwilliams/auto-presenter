# Auto-Presenter: Requirements Specification

## Overview

A web-based PoC that takes markdown content, presentation objectives, and a target slide count — then uses a Claude AI agent to generate and deliver an automated presentation with text-to-speech narration.

## User Flow

1. **Input Phase**: User pastes markdown content, enters an AI prompt for objectives, selects target slide count via slider
2. **Generation Phase**: Agent plans slides, generates content with progress streamed to UI
3. **Presentation Phase**: Agent drives a reveal.js presentation, advancing slides and narrating via OpenAI TTS — fully automatic, no user interaction needed
4. **Completion**: Agent signals done, UI shows completion state

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (TypeScript) |
| AI Agent | Anthropic Claude SDK with tool use |
| Slide Rendering | reveal.js |
| Text-to-Speech | OpenAI TTS API (tts-1 model) |
| Transport | WebSocket (bidirectional agent ↔ browser) |
| Styling | Tailwind CSS (or reveal.js built-in themes) |

## Functional Requirements

### FR-1: Input Form

- **FR-1.1**: Textarea for pasting markdown content (large, resizable)
- **FR-1.2**: Text input for AI prompt / presentation objectives
- **FR-1.3**: Slider to select target number of slides (range: 3–20, default: 5)
- **FR-1.4**: Display of selected slide count next to slider
- **FR-1.5**: "Start Presenting" button to initiate the workflow
- **FR-1.6**: Validation — markdown content and objectives must be non-empty

### FR-2: Agent Workflow — Planning Phase

- **FR-2.1**: Agent receives markdown content, objectives, and target slide count
- **FR-2.2**: Agent generates a high-level plan for the presentation (slide titles/themes targeting the given count)
- **FR-2.3**: Planning progress is streamed to the UI in real-time

### FR-3: Agent Workflow — Content Generation Phase

- **FR-3.1**: For each planned slide, agent generates:
  - Slide title
  - Bullet points (concise, presentation-style)
  - Narration script (conversational, to be read aloud by TTS)
- **FR-3.2**: Content generation progress is streamed to the UI (e.g., "Creating slide 2/8...")

### FR-4: Agent Workflow — Presentation Phase (Tool-Driven)

- **FR-4.1**: Agent has a `show_slide` tool — sends slide data to frontend via WebSocket
  - Input: `{ title: string, bullets: string[], slideNumber: number, totalSlides: number }`
  - Frontend renders the slide in reveal.js
  - Tool returns `"displayed"` once rendered
- **FR-4.2**: Agent has a `speak_script` tool — sends narration text to frontend via WebSocket
  - Input: `{ text: string }`
  - Frontend calls OpenAI TTS API, plays the audio
  - Tool returns `"speech_complete"` only after audio finishes playing
- **FR-4.3**: Agent calls `show_slide` → `speak_script` for each slide in sequence
- **FR-4.4**: Agent has a `presentation_complete` tool — signals the presentation is done
  - Frontend shows completion state

### FR-5: Presentation Display

- **FR-5.1**: Slides render in an embedded reveal.js container on the page
- **FR-5.2**: Slides have clean, readable styling (large text, clear bullets)
- **FR-5.3**: Slide transitions are smooth (fade or slide)
- **FR-5.4**: Current slide number / total is visible

### FR-6: Text-to-Speech

- **FR-6.1**: Use OpenAI TTS API (`tts-1` model) for narration
- **FR-6.2**: Audio plays in the browser via an `<audio>` element
- **FR-6.3**: End-of-speech is detected via the audio element's `ended` event
- **FR-6.4**: Only after audio completes does the tool return `"speech_complete"` to the agent

### FR-7: Progress/Status Display

- **FR-7.1**: During planning: show agent's plan as it's generated
- **FR-7.2**: During content generation: show which slide is being created (e.g., "Generating slide 3 of 8...")
- **FR-7.3**: During presentation: show current slide number and a "Presenting..." indicator
- **FR-7.4**: On completion: show "Presentation Complete" with option to return to input

## Non-Functional Requirements

### NFR-1: Performance
- TTS audio should start playing within 2-3 seconds of the agent calling `speak_script`
- Slide rendering should be near-instant (<100ms)

### NFR-2: Error Handling
- If Claude API fails, show error and allow retry
- If OpenAI TTS fails, show error, attempt to continue with next slide
- WebSocket disconnect should show reconnection attempt or error state

### NFR-3: Configuration
- API keys provided via environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`)
- No client-side API key entry needed

### NFR-4: PoC Scope
- Single user, single presentation at a time
- No persistence / no saving presentations
- No authentication
- Desktop browser only (Chrome primary target)

## Architecture

```
┌─────────────────────────────────────────────┐
│                  Browser                     │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │Input Form│→ │ Progress  │→ │ reveal.js │ │
│  │          │  │ Display   │  │ + Audio   │ │
│  └──────────┘  └──────────┘  └───────────┘ │
│       │              ↑             ↑↓        │
│       │              │         WebSocket     │
└───────│──────────────│─────────────│─────────┘
        │              │             │
        ▼              │             ▼
┌─────────────────────────────────────────────┐
│              Next.js Server                  │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │          Agent Loop (Claude SDK)        │ │
│  │                                         │ │
│  │  1. Receive markdown + objectives       │ │
│  │  2. Plan slides (stream progress)       │ │
│  │  3. Generate content (stream progress)  │ │
│  │  4. For each slide:                     │ │
│  │     - call show_slide tool              │ │
│  │     - call speak_script tool            │ │
│  │  5. Call presentation_complete          │ │
│  └────────────────────────────────────────┘ │
│       │                              │       │
│       ▼                              ▼       │
│  Claude API                   OpenAI TTS*    │
│  (Anthropic)                  (* or from     │
│                                browser)      │
└──────────────────────────────────────────────┘
```

**Note on TTS**: OpenAI TTS API can be called either from the server (proxied to browser) or directly from the browser. Server-side is cleaner for keeping the API key secure; browser-side reduces latency. Implementation should decide based on simplicity.

## Agent Tool Definitions

```typescript
// Tool: show_slide
{
  name: "show_slide",
  description: "Display a slide in the presentation",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Slide title" },
      bullets: {
        type: "array",
        items: { type: "string" },
        description: "Bullet points for the slide"
      },
      slideNumber: { type: "integer", description: "Current slide number (1-based)" },
      totalSlides: { type: "integer", description: "Total number of slides" }
    },
    required: ["title", "bullets", "slideNumber", "totalSlides"]
  }
}

// Tool: speak_script
{
  name: "speak_script",
  description: "Read aloud the narration script for the current slide. Returns when speech is complete.",
  input_schema: {
    type: "object",
    properties: {
      text: { type: "string", description: "The narration script to read aloud" }
    },
    required: ["text"]
  }
}

// Tool: presentation_complete
{
  name: "presentation_complete",
  description: "Signal that the presentation is finished",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "Brief summary of what was presented" }
    }
  }
}
```

## WebSocket Message Protocol

```typescript
// Server → Client
type ServerMessage =
  | { type: "progress", phase: "planning" | "generating" | "presenting", message: string }
  | { type: "show_slide", title: string, bullets: string[], slideNumber: number, totalSlides: number }
  | { type: "speak", text: string }
  | { type: "complete", summary: string }
  | { type: "error", message: string }

// Client → Server
type ClientMessage =
  | { type: "start", markdown: string, objectives: string, slideCount: number }
  | { type: "slide_displayed" }
  | { type: "speech_complete" }
```

## Open Questions

1. **Claude Agents SDK vs standard tool use**: Need to evaluate whether the Agents SDK (multi-agent orchestration) provides meaningful benefit over standard Claude SDK with tool use for this workflow. Standard tool use may be simpler and sufficient.
2. **TTS voice selection**: Should the user be able to pick a voice, or use a sensible default (e.g., "alloy" or "nova")?
3. **Slide theming**: Should the user pick a reveal.js theme, or use a single default?
4. **Audio pre-generation**: Should all TTS audio be generated upfront during content generation phase (better playback reliability) or on-demand per slide (simpler agent flow)?
