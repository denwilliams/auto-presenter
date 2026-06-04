import type { WebSocket } from 'ws';
import type { ServerTextMessage, SlideData } from '@/types/messages';

export class WsBridge {
  private ws: WebSocket;
  private pendingAck: { type: string; resolve: () => void; timer: NodeJS.Timeout } | null = null;

  constructor(ws: WebSocket) {
    this.ws = ws;

    ws.on('message', (data: Buffer | string) => {
      // Only handle text frames for acks
      if (typeof data !== 'string' && !Buffer.isBuffer(data)) return;
      try {
        const msg = JSON.parse(data.toString());
        if (this.pendingAck && msg.type === this.pendingAck.type) {
          clearTimeout(this.pendingAck.timer);
          this.pendingAck.resolve();
          this.pendingAck = null;
        }
      } catch {
        // Ignore non-JSON messages
      }
    });
  }

  private send(message: ServerTextMessage): void {
    if (this.ws.readyState === this.ws.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private sendBinary(data: Buffer): void {
    if (this.ws.readyState === this.ws.OPEN) {
      this.ws.send(data);
    }
  }

  private waitForAck(ackType: string, timeoutMs = 120_000): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingAck = null;
        reject(new Error(`Timed out waiting for ${ackType} ack`));
      }, timeoutMs);

      this.pendingAck = { type: ackType, resolve, timer };
    });
  }

  sendProgress(phase: 'planning' | 'generating' | 'presenting', message: string): void {
    this.send({ type: 'progress', phase, message });
  }

  sendError(message: string): void {
    this.send({ type: 'error', message });
  }

  async showSlide(data: SlideData): Promise<void> {
    // Set up ack listener BEFORE sending to avoid race condition
    const ackPromise = this.waitForAck('slide_displayed');
    this.send({
      type: 'show_slide',
      title: data.title,
      bullets: data.bullets,
      slideNumber: data.slideNumber,
      totalSlides: data.totalSlides,
    });
    await ackPromise;
  }

  async speakScript(audioBuffer: Buffer): Promise<void> {
    // Set up ack listener BEFORE sending to avoid race condition
    const ackPromise = this.waitForAck('speech_complete', 300_000);
    this.send({ type: 'speak_start' });
    this.sendBinary(audioBuffer);
    await ackPromise;
  }

  async presentationComplete(summary: string): Promise<void> {
    this.send({ type: 'complete', summary });
  }
}
