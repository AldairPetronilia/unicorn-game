'use client';

import { Difficulty } from './types';

interface DifficultyOption {
  id: Difficulty;
  label: string;
  icon: string;
  color: string;
  description: string;
}

interface DifficultySelectorProps {
  selectedDifficulty: Difficulty;
  onSelectDifficulty: (difficulty: Difficulty) => void;
}

const difficultyOptions: DifficultyOption[] = [
  {
    id: 'easy',
    label: 'Easy',
    icon: '🟢',
    color: '#10B981',
    description: 'Relaxed pace, more power-ups'
  },
  {
    id: 'medium',
    label: 'Medium',
    icon: '🟡',
    color: '#F59E0B',
    description: 'Balanced gameplay'
  },
  {
    id: 'hard',
    label: 'Hard',
    icon: '🔴',
    color: '#EF4444',
    description: 'Fast pace, more challenge'
  }
];

export default function DifficultySelector({ selectedDifficulty, onSelectDifficulty }: DifficultySelectorProps) {
  return (
    <div className="difficulty-selector">
      <h3 className="difficulty-title">Select Difficulty</h3>
      <div className="difficulty-options">
        {difficultyOptions.map((option) => (
          <button
            key={option.id}
            className={`difficulty-button ${selectedDifficulty === option.id ? 'selected' : ''}`}
            onClick={() => onSelectDifficulty(option.id)}
            style={{ '--difficulty-color': option.color } as React.CSSProperties}
          >
            <div className="difficulty-icon">{option.icon}</div>
            <div className="difficulty-label">{option.label}</div>
            <div className="difficulty-description">{option.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}