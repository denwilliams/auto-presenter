'use client';

export interface ProgressMessage {
  phase: 'planning' | 'generating' | 'presenting';
  message: string;
}

interface ProgressDisplayProps {
  messages: ProgressMessage[];
}

const phaseLabels = {
  planning: 'Planning',
  generating: 'Generating',
  presenting: 'Presenting',
};

const phaseColors = {
  planning: 'text-yellow-400',
  generating: 'text-blue-400',
  presenting: 'text-green-400',
};

export default function ProgressDisplay({ messages }: ProgressDisplayProps) {
  if (messages.length === 0) return null;

  const latest = messages[messages.length - 1];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <div className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full" />
        <span className={`font-semibold ${phaseColors[latest.phase]}`}>
          {phaseLabels[latest.phase]}
        </span>
      </div>

      <div className="bg-gray-800 rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
        {messages.map((msg, i) => (
          <div key={i} className="text-sm">
            <span className={`font-mono text-xs ${phaseColors[msg.phase]} mr-2`}>
              [{phaseLabels[msg.phase]}]
            </span>
            <span className="text-gray-300 whitespace-pre-wrap">{msg.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
