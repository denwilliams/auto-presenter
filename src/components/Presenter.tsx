'use client';

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import type Reveal from 'reveal.js';
import type { SlideData } from '@/types/messages';

export interface PresenterHandle {
  addSlide: (data: SlideData) => void;
  playAudio: (audioData: ArrayBuffer) => Promise<void>;
  reset: () => void;
}

interface PresenterProps {
  visible: boolean;
}

const Presenter = forwardRef<PresenterHandle, PresenterProps>(function Presenter(
  { visible },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const slidesRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<Reveal | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const initializedRef = useRef(false);
  const slideCountRef = useRef(0);
  const pendingSlides = useRef<SlideData[]>([]);

  // Internal function to render a slide into the DOM
  const renderSlide = useCallback((deck: Reveal, slidesContainer: HTMLDivElement, data: SlideData) => {
    // Remove placeholder slide on first real slide
    if (slideCountRef.current === 0) {
      const placeholder = slidesContainer.querySelector('.placeholder-slide');
      if (placeholder) {
        slidesContainer.removeChild(placeholder);
      }
    }

    const section = document.createElement('section');
    // Wrapper div for scalable content (excludes the fixed slide number)
    const content = document.createElement('div');
    content.className = 'slide-content';
    content.innerHTML = `
      <h2>${escapeHtml(data.title)}</h2>
      <ul>
        ${data.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}
      </ul>
    `;
    section.appendChild(content);

    const counter = document.createElement('p');
    counter.className = 'slide-counter';
    counter.textContent = `${data.slideNumber} / ${data.totalSlides}`;
    section.appendChild(counter);

    slidesContainer.appendChild(section);
    slideCountRef.current++;
    deck.sync();
    deck.slide(slideCountRef.current - 1);

    // Auto-scale: shrink font if content overflows the slide
    autoFitContent(content);
  }, []);

  // Initialize reveal.js — eagerly when mounted, regardless of visible
  useEffect(() => {
    if (initializedRef.current) return;

    const init = async () => {
      const RevealModule = (await import('reveal.js')).default;
      await import('reveal.js/dist/reveal.css');
      await import('reveal.js/dist/theme/black.css');

      if (!containerRef.current || initializedRef.current) return;
      initializedRef.current = true;

      const deck = new RevealModule(containerRef.current, {
        embedded: true,
        keyboardCondition: 'focused',
        controls: false,
        progress: true,
        transition: 'slide',
        hash: false,
        respondToHashChanges: false,
        width: 960,
        height: 540,
      });

      await deck.initialize();
      deckRef.current = deck;

      // Flush any slides that arrived before initialization
      if (pendingSlides.current.length > 0 && slidesRef.current) {
        for (const slide of pendingSlides.current) {
          renderSlide(deck, slidesRef.current, slide);
        }
        pendingSlides.current = [];
      }
    };

    init();

    return () => {
      if (deckRef.current) {
        try {
          deckRef.current.destroy();
        } catch {
          // Ignore destroy errors
        }
        deckRef.current = null;
        initializedRef.current = false;
        slideCountRef.current = 0;
        pendingSlides.current = [];
      }
    };
  }, [renderSlide]);

  // Re-layout when visibility changes (reveal.js needs this for embedded mode)
  useEffect(() => {
    if (visible && deckRef.current) {
      deckRef.current.layout();
    }
  }, [visible]);

  const addSlide = useCallback((data: SlideData) => {
    const deck = deckRef.current;
    const slidesContainer = slidesRef.current;

    if (!deck || !slidesContainer) {
      // Deck not ready yet — queue the slide
      pendingSlides.current.push(data);
      return;
    }

    renderSlide(deck, slidesContainer, data);
  }, [renderSlide]);

  const playAudio = useCallback((audioData: ArrayBuffer): Promise<void> => {
    return new Promise((resolve) => {
      const audio = audioRef.current;
      if (!audio) {
        resolve();
        return;
      }

      // Revoke previous blob URL if any
      if (audio.src && audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src);
      }

      const blob = new Blob([audioData], { type: 'audio/mp3' });
      audio.src = URL.createObjectURL(blob);

      const onEnded = () => {
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
        resolve();
      };

      const onError = () => {
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
        resolve(); // Resolve anyway to continue presentation
      };

      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);
      audio.play().catch(() => resolve());
    });
  }, []);

  const reset = useCallback(() => {
    // Revoke any lingering blob URL
    const audio = audioRef.current;
    if (audio?.src?.startsWith('blob:')) {
      URL.revokeObjectURL(audio.src);
      audio.src = '';
    }

    const slidesContainer = slidesRef.current;
    if (slidesContainer) {
      slidesContainer.innerHTML =
        '<section class="placeholder-slide"><h2>Waiting for presentation...</h2></section>';
    }
    slideCountRef.current = 0;
    pendingSlides.current = [];
    if (deckRef.current) {
      deckRef.current.sync();
      deckRef.current.slide(0);
    }
  }, []);

  useImperativeHandle(ref, () => ({ addSlide, playAudio, reset }), [
    addSlide,
    playAudio,
    reset,
  ]);

  return (
    <div className={visible ? 'block' : 'hidden'}>
      <div
        ref={containerRef}
        className="reveal mx-auto"
        style={{ width: '960px', height: '540px' }}
      >
        <div ref={slidesRef} className="slides">
          <section className="placeholder-slide">
            <h2>Waiting for presentation...</h2>
          </section>
        </div>
      </div>
      <audio ref={audioRef} />
    </div>
  );
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function autoFitContent(content: HTMLElement): void {
  // The slide area is 540px tall with padding, so usable height is ~460px
  const maxHeight = 460;
  let scale = 100; // Start at 100% font-size
  const minScale = 50; // Don't go below 50%

  while (content.scrollHeight > maxHeight && scale > minScale) {
    scale -= 5;
    content.style.fontSize = `${scale}%`;
  }
}

export default Presenter;
