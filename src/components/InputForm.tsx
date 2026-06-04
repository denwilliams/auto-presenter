'use client';

import { useState } from 'react';
import { TONES, type ToneId } from '@/types/messages';

interface InputFormProps {
  onStart: (markdown: string, objectives: string, slideCount: number, tone: ToneId) => void;
  disabled: boolean;
}

export default function InputForm({ onStart, disabled }: InputFormProps) {
  const [markdown, setMarkdown] = useState('');
  const [objectives, setObjectives] = useState('');
  const [slideCount, setSlideCount] = useState(5);
  const [tone, setTone] = useState<ToneId>('professional');

  const canStart = markdown.trim().length > 0 && objectives.trim().length > 0 && !disabled;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <label htmlFor="markdown" className="block text-sm font-medium text-gray-300 mb-2">
          Markdown Content
        </label>
        <textarea
          id="markdown"
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          placeholder="Paste your markdown content here..."
          className="w-full h-64 bg-gray-800 border border-gray-600 rounded-lg p-4 text-white placeholder-gray-500 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
          disabled={disabled}
        />
      </div>

      <div>
        <label htmlFor="objectives" className="block text-sm font-medium text-gray-300 mb-2">
          Presentation Objectives
        </label>
        <input
          id="objectives"
          type="text"
          value={objectives}
          onChange={(e) => setObjectives(e.target.value)}
          placeholder="e.g., Summarize key findings for executives, focus on ROI..."
          className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={disabled}
        />
      </div>

      <div>
        <label htmlFor="slideCount" className="block text-sm font-medium text-gray-300 mb-2">
          Number of Slides: <span className="text-white font-bold text-lg">{slideCount}</span>
        </label>
        <input
          id="slideCount"
          type="range"
          min={1}
          max={20}
          value={slideCount}
          onChange={(e) => setSlideCount(parseInt(e.target.value, 10))}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          disabled={disabled}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>1</span>
          <span>20</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Presentation Tone
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TONES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTone(t.id)}
              disabled={disabled}
              className={`p-3 rounded-lg border text-left transition-colors ${
                tone === t.id
                  ? 'border-blue-500 bg-blue-500/20 text-white'
                  : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500'
              } disabled:opacity-50`}
            >
              <div className="font-medium text-sm">{t.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{t.description}</div>
              <div className="text-xs text-gray-500 mt-0.5">Voice: {t.voice}</div>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => canStart && onStart(markdown, objectives, slideCount, tone)}
        disabled={!canStart}
        className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
      >
        {disabled ? 'Connecting...' : 'Start Presenting'}
      </button>
    </div>
  );
}
