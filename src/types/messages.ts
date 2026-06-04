// Server → Client (text frames, JSON)
export type ServerTextMessage =
  | { type: 'progress'; phase: 'planning' | 'generating' | 'presenting'; message: string }
  | { type: 'show_slide'; title: string; bullets: string[]; slideNumber: number; totalSlides: number }
  | { type: 'speak_start' }
  | { type: 'complete'; summary: string }
  | { type: 'error'; message: string };

export const TONES = [
  { id: 'professional', label: 'Professional', description: 'Clear, confident, and polished', voice: 'onyx' },
  { id: 'excitable', label: 'Excitable', description: 'High energy, enthusiastic, lots of emphasis', voice: 'shimmer' },
  { id: 'monotone', label: 'Monotone', description: 'Flat, dry, deadpan delivery', voice: 'fable' },
  { id: 'super-formal', label: 'Super Formal', description: 'Overly proper, boardroom stiff', voice: 'sage' },
  { id: 'angry', label: 'Angry', description: 'Frustrated, fed up, ranting', voice: 'ash' },
  { id: 'angsty', label: 'Angsty', description: 'Dramatic, brooding, existential dread', voice: 'ballad' },
  { id: 'sarcastic', label: 'Sarcastic', description: 'Dripping with irony and wit', voice: 'echo' },
  { id: 'motivational', label: 'Motivational', description: 'Inspirational, pump-up speech energy', voice: 'nova' },
  { id: 'conspiracy', label: 'Conspiracy Theorist', description: 'Hushed, paranoid, connecting dots', voice: 'echo' },
  { id: 'pirate', label: 'Pirate', description: 'Arrr, nautical metaphors and sea talk', voice: 'fable' },
  { id: 'noir', label: 'Film Noir', description: 'Hardboiled detective narrating a case', voice: 'onyx' },
  { id: 'surfer', label: 'Surfer Dude', description: 'Laid back, totally chill, radical', voice: 'ember' },
  { id: 'stoner', label: 'Stoner', description: 'Blazed, philosophical, easily distracted', voice: 'alloy' },
  { id: 'yoda', label: 'Yoda', description: 'Backwards speech, ancient wisdom, the Force', voice: 'echo' },
  { id: 'romance', label: 'Romance Novel', description: 'Breathless, heaving, smouldering intensity', voice: 'nova' },
  { id: 'wizard', label: 'Wizard School', description: 'Magical, whimsical, Dumbledore energy', voice: 'sage' },
  { id: 'nature-doc', label: 'Nature Documentary', description: 'Hushed, reverent, Attenborough narration', voice: 'onyx' },
  { id: 'sports', label: 'Sports Commentator', description: 'Play-by-play, high stakes, crowd energy', voice: 'ash' },
  { id: 'horror', label: 'Horror', description: 'Creeping dread, ominous foreshadowing', voice: 'echo' },
  { id: 'shakespearean', label: 'Shakespearean', description: 'Iambic pentameter, dramatic soliloquy', voice: 'fable' },
  { id: 'elon', label: 'Elon Musk', description: 'Unhinged tech bro, memes, Mars, X everything', voice: 'ash' },
] as const;

export type ToneId = (typeof TONES)[number]['id'];

// Client → Server (text frames, JSON)
export type ClientMessage =
  | { type: 'start'; markdown: string; objectives: string; slideCount: number; tone: ToneId }
  | { type: 'slide_displayed' }
  | { type: 'speech_complete' };

// Slide data passed around internally
export interface SlideData {
  title: string;
  bullets: string[];
  slideNumber: number;
  totalSlides: number;
}
