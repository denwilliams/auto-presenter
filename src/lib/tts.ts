import OpenAI from 'openai';

let openai: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openai) {
    openai = new OpenAI();
  }
  return openai;
}

// OpenAI TTS voices: alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer
export type TTSVoice = 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'ember' | 'fable' | 'nova' | 'onyx' | 'sage' | 'shimmer' | 'verse' | 'marin' | 'cedar';

export async function generateTTS(text: string, voice: TTSVoice = 'alloy', speed: number = 1): Promise<Buffer> {
  console.log(`[TTS] Generating audio with voice: ${voice}, speed: ${speed}`);
  const response = await getClient().audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice,
    speed,
    input: text,
    response_format: 'mp3',
  });

  return Buffer.from(await response.arrayBuffer());
}
