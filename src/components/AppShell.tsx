'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import InputForm from './InputForm';
import ProgressDisplay, { type ProgressMessage } from './ProgressDisplay';
import Presenter, { type PresenterHandle } from './Presenter';
import type { ServerTextMessage, ToneId } from '@/types/messages';

type AppState = 'input' | 'generating' | 'presenting' | 'done';

export default function AppShell() {
  const [appState, setAppState] = useState<AppState>('input');
  const [progressMessages, setProgressMessages] = useState<ProgressMessage[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<string>('');
  const presenterRef = useRef<PresenterHandle>(null);

  const { status, sendStart, sendAck, onTextMessage, onBinaryMessage } = useWebSocket();

  // Handle text messages from server
  const handleTextMessage = useCallback(
    (msg: ServerTextMessage) => {
      switch (msg.type) {
        case 'progress':
          setProgressMessages((prev) => [...prev, { phase: msg.phase, message: msg.message }]);
          if (msg.phase === 'presenting') {
            setAppState('presenting');
          }
          break;

        case 'show_slide':
          setAppState('presenting');
          presenterRef.current?.addSlide({
            title: msg.title,
            bullets: msg.bullets,
            slideNumber: msg.slideNumber,
            totalSlides: msg.totalSlides,
          });
          sendAck('slide_displayed');
          break;

        case 'speak_start':
          // Audio binary frame will follow — handled by onBinaryMessage
          break;

        case 'complete':
          setSummary(msg.summary);
          setAppState('done');
          break;

        case 'error':
          setErrorMessage(msg.message);
          break;
      }
    },
    [sendAck],
  );

  // Handle binary messages (audio) from server
  const handleBinaryMessage = useCallback(
    async (data: ArrayBuffer) => {
      if (presenterRef.current) {
        await presenterRef.current.playAudio(data);
      }
      sendAck('speech_complete');
    },
    [sendAck],
  );

  // Wire up callbacks
  useEffect(() => {
    onTextMessage.current = handleTextMessage;
    onBinaryMessage.current = handleBinaryMessage;
  }, [handleTextMessage, handleBinaryMessage, onTextMessage, onBinaryMessage]);

  const handleStart = useCallback(
    (markdown: string, objectives: string, slideCount: number, tone: ToneId) => {
      setAppState('generating');
      setProgressMessages([]);
      setErrorMessage(null);
      setSummary('');
      presenterRef.current?.reset();
      sendStart(markdown, objectives, slideCount, tone);
    },
    [sendStart],
  );

  const handleRestart = useCallback(() => {
    setAppState('input');
    setProgressMessages([]);
    setErrorMessage(null);
    setSummary('');
    presenterRef.current?.reset();
  }, []);

  const showPresenter = appState === 'generating' || appState === 'presenting' || appState === 'done';

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="border-b border-gray-800 py-4 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Auto-Presenter 2000</h1>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                status === 'connected'
                  ? 'bg-green-400'
                  : status === 'connecting'
                    ? 'bg-yellow-400'
                    : 'bg-red-400'
              }`}
            />
            <span className="text-xs text-gray-400">{status}</span>
          </div>
        </div>
      </header>

      <main className="py-8 px-6">
        {/* Error banner */}
        {errorMessage && (
          <div className="max-w-3xl mx-auto mb-6 bg-red-900/50 border border-red-700 rounded-lg p-4">
            <p className="text-red-300 text-sm">{errorMessage}</p>
            <button
              onClick={handleRestart}
              className="mt-2 text-sm text-red-400 underline hover:text-red-300"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Input state */}
        {appState === 'input' && (
          <InputForm onStart={handleStart} disabled={status !== 'connected'} />
        )}

        {/* Generating state — show progress */}
        {appState === 'generating' && <ProgressDisplay messages={progressMessages} />}

        {/* Single Presenter instance — mounted during generating/presenting/done, hidden until presenting */}
        {showPresenter && (
          <Presenter
            ref={presenterRef}
            visible={appState === 'presenting' || appState === 'done'}
          />
        )}

        {/* Done state — show completion message below the presenter */}
        {appState === 'done' && (
          <div className="max-w-3xl mx-auto text-center mt-8">
            <h2 className="text-2xl font-bold text-green-400 mb-3">Presentation Complete</h2>
            {summary && <p className="text-gray-400 mb-6">{summary}</p>}
            <button
              onClick={handleRestart}
              className="py-3 px-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              New Presentation
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
