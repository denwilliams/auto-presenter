declare module 'reveal.js' {
  interface RevealOptions {
    embedded?: boolean;
    keyboardCondition?: string;
    controls?: boolean;
    progress?: boolean;
    transition?: string;
    hash?: boolean;
    respondToHashChanges?: boolean;
    width?: number;
    height?: number;
    [key: string]: unknown;
  }

  interface RevealApi {
    initialize(): Promise<void>;
    sync(): void;
    syncSlide(slide: HTMLElement): void;
    slide(indexh: number, indexv?: number, indexf?: number): void;
    destroy(): void;
    layout(): void;
    on(event: string, callback: (event: unknown) => void): void;
  }

  class Reveal {
    constructor(element: HTMLElement, options?: RevealOptions);
    initialize(): Promise<void>;
    sync(): void;
    syncSlide(slide: HTMLElement): void;
    slide(indexh: number, indexv?: number, indexf?: number): void;
    destroy(): void;
    layout(): void;
    on(event: string, callback: (event: unknown) => void): void;
  }

  export default Reveal;
}

declare module 'reveal.js/dist/reveal.css';
declare module 'reveal.js/dist/theme/black.css';
