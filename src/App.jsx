import React, { useState, useEffect, useCallback, useReducer, useMemo } from 'react';
import { Trophy, Play, Clock, Target, Award } from 'lucide-react';

// ============================================================================
// DOMAIN LAYER - Pure Business Logic
// ============================================================================

const OPERATIONS = {
  ADDITION: { symbol: '+', fn: (a, b) => a + b, name: 'suma' },
  SUBTRACTION: { symbol: '-', fn: (a, b) => a - b, name: 'resta' },
  MULTIPLICATION: { symbol: '×', fn: (a, b) => a * b, name: 'multiplicación' },
  DIVISION: { symbol: '÷', fn: (a, b) => a / b, name: 'división' }
};

class MathProblem {
  constructor(operand1, operand2, operation) {
    this.operand1 = operand1;
    this.operand2 = operand2;
    this.operation = operation;
    this.answer = operation.fn(operand1, operand2);
  }

  toString() {
    return `${this.operand1} ${this.operation.symbol} ${this.operand2}`;
  }

  isCorrect(userAnswer) {
    return Math.abs(parseFloat(userAnswer) - this.answer) < 0.01;
  }
}

class ProblemGenerator {
  static generate() {
    const operations = Object.values(OPERATIONS);
    let operand1, operand2, operation;

    do {
      operand1 = Math.floor(Math.random() * 9) + 1;
      operand2 = Math.floor(Math.random() * 9) + 1;
      operation = operations[Math.floor(Math.random() * operations.length)];

      // Evitar divisiones con resto y división por 0
      if (operation === OPERATIONS.DIVISION) {
        if (operand2 === 0 || operand1 % operand2 !== 0) {
          continue;
        }
      }

      // Evitar restas negativas
      if (operation === OPERATIONS.SUBTRACTION && operand1 < operand2) {
        [operand1, operand2] = [operand2, operand1];
      }

      break;
    } while (true);

    return new MathProblem(operand1, operand2, operation);
  }
}

class ScoreManager {
  static STORAGE_KEY = 'math_game_scores';

  static getTopScores(limit = 5) {
    try {
      const scores = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
      return scores
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch {
      return [];
    }
  }

  static saveScore(playerName, score) {
    try {
      const scores = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
      scores.push({
        name: playerName,
        score,
        date: new Date().toISOString()
      });
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(scores));
    } catch (e) {
      console.error('Error saving score:', e);
    }
  }
}

// ============================================================================
// STATE MANAGEMENT - Reducer Pattern con Immutability
// ============================================================================

const GAME_STATES = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  GAME_OVER: 'GAME_OVER'
};

const INITIAL_STATE = {
  gameState: GAME_STATES.MENU,
  currentProblem: null,
  userInput: '',
  score: 0,
  timeRemaining: 30,
  showSuccess: false,
  topScores: [],
  playerNameToSave: null
};

const gameReducer = (state, action) => {
  switch (action.type) {
    case 'START_GAME':
      return {
        ...state,
        gameState: GAME_STATES.PLAYING,
        currentProblem: ProblemGenerator.generate(),
        score: 0,
        timeRemaining: 30,
        userInput: '',
        showSuccess: false
      };

    case 'UPDATE_INPUT':
      return { ...state, userInput: action.payload };

    case 'CORRECT_ANSWER':
      return {
        ...state,
        score: state.score + 1,
        currentProblem: ProblemGenerator.generate(),
        userInput: '',
        showSuccess: true
      };

    case 'HIDE_SUCCESS':
      return { ...state, showSuccess: false };

    case 'TICK':
      const newTime = Math.max(0, state.timeRemaining - 1);
      return {
        ...state,
        timeRemaining: newTime,
        gameState: newTime === 0 ? GAME_STATES.GAME_OVER : state.gameState
      };

    case 'SAVE_SCORE':
      return { ...state, playerNameToSave: action.payload };

    case 'RETURN_TO_MENU':
      return { ...INITIAL_STATE, topScores: ScoreManager.getTopScores() };

    case 'LOAD_SCORES':
      return { ...state, topScores: ScoreManager.getTopScores() };

    default:
      return state;
  }
};

// ============================================================================
// CUSTOM HOOKS - Separation of Concerns
// ============================================================================

const useGameTimer = (isPlaying, onTick) => {
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(onTick, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, onTick]);
};

const useAutoValidation = (userInput, currentProblem, onCorrect) => {
  useEffect(() => {
    if (!userInput || !currentProblem) return;

    const numericInput = parseFloat(userInput);
    if (isNaN(numericInput)) return;

    // Validar cuando el usuario termine de escribir un número válido
    if (currentProblem.isCorrect(userInput)) {
      onCorrect();
    }
  }, [userInput, currentProblem, onCorrect]);
};

const useSuccessAnimation = (showSuccess, onHide) => {
  useEffect(() => {
    if (!showSuccess) return;

    const timeout = setTimeout(onHide, 500);
    return () => clearTimeout(timeout);
  }, [showSuccess, onHide]);
};

// ============================================================================
// PRESENTATION COMPONENTS - Pure & Reusable
// ============================================================================

const Button = ({ onClick, children, variant = 'primary', icon: Icon, className = '' }) => {
  const baseClass = 'px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 flex items-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-105';
  const variants = {
    primary: 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300'
  };

  return (
    <button
      onClick={onClick}
      className={`${baseClass} ${variants[variant]} ${className}`}
    >
      {Icon && <Icon size={24} />}
      {children}
    </button>
  );
};

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl shadow-2xl p-8 ${className}`}>
    {children}
  </div>
);

const StatDisplay = ({ icon: Icon, label, value, color = 'blue' }) => (
  <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-4">
    <Icon size={24} className={`text-${color}-500`} />
    <div>
      <div className="text-sm text-gray-600">{label}</div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
    </div>
  </div>
);

// ============================================================================
// SCREEN COMPONENTS - Smart Components
// ============================================================================

const MenuScreen = ({ onStart, topScores }) => (
  <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
    <Card className="max-w-2xl w-full text-center">
      <h1 className="text-5xl font-black text-gray-800 mb-4">
        🧮 Math Rush
      </h1>
      <p className="text-gray-600 mb-8 text-lg">
        ¡30 segundos para demostrar tus habilidades matemáticas!
      </p>

      <Button onClick={onStart} icon={Play} className="mx-auto mb-8">
        JUGAR
      </Button>

      {topScores.length > 0 && (
        <div className="mt-8 pt-8 border-t border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center justify-center gap-2">
            <Trophy className="text-yellow-500" />
            Top 5 Jugadores
          </h2>
          <div className="space-y-2">
            {topScores.map((score, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center bg-gray-50 rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-lg text-gray-400">#{idx + 1}</span>
                  <span className="text-gray-800 font-medium">{score.name}</span>
                </div>
                <span className="text-2xl font-bold text-purple-600">{score.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  </div>
);

const GameScreen = ({ problem, userInput, onInputChange, score, timeRemaining, showSuccess }) => {
  const progressPercentage = (timeRemaining / 30) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-teal-500 to-green-500 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <div className="grid grid-cols-2 gap-4 mb-8">
          <StatDisplay icon={Target} label="Puntuación" value={score} color="green" />
          <StatDisplay icon={Clock} label="Tiempo" value={`${timeRemaining}s`} color="red" />
        </div>

        <div className="relative mb-4">
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-1000"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        <div className="text-center mb-8">
          <div className="text-6xl font-black text-gray-800 mb-8">
            {problem.toString()} = ?
          </div>

          <input
            type="number"
            value={userInput}
            onChange={(e) => onInputChange(e.target.value)}
            className="w-full max-w-xs mx-auto text-5xl font-bold text-center border-4 border-purple-300 rounded-xl p-4 focus:outline-none focus:border-purple-500 transition-colors text-gray-900"
            placeholder="?"
            autoFocus
          />
        </div>

        {showSuccess && (
          <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
            <div className="bg-green-500 text-white text-4xl font-bold px-12 py-8 rounded-3xl shadow-2xl animate-bounce -mt-120">
              ✓ ¡Correcto!
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

const GameOverScreen = ({ score, onSaveScore, onReturnToMenu }) => {
  const [playerName, setPlayerName] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (playerName.trim() && !saved) {
      onSaveScore(playerName.trim());
      setSaved(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full text-center">
        <div className="mb-6">
          <Award size={80} className="mx-auto text-yellow-500 mb-4" />
          <h1 className="text-4xl font-black text-gray-800 mb-2">
            ¡Juego Terminado!
          </h1>
        </div>

        <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-xl p-8 mb-8">
          <p className="text-gray-600 text-lg mb-2">Tu Puntuación Final</p>
          <p className="text-7xl font-black text-purple-600">{score}</p>
        </div>

        {!saved ? (
          <div className="mb-8">
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Tu nombre"
              className="w-full max-w-sm mx-auto text-center text-xl border-2 border-gray-300 rounded-lg p-3 mb-4 focus:outline-none focus:border-purple-500 text-gray-900"
              maxLength={20}
            />
            <Button
              onClick={handleSave}
              variant="primary"
              className={`mx-auto ${saved ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Guardar Puntuación
            </Button>
          </div>
        ) : (
          <div className="mb-8 text-green-600 font-bold text-xl">
            ✓ ¡Puntuación guardada!
          </div>
        )}

        <Button onClick={onReturnToMenu} className="mx-auto">
          Volver al Menú
        </Button>
      </Card>
    </div>
  );
};

// ============================================================================
// MAIN APP COMPONENT - Orchestrator
// ============================================================================

const MathGameApp = () => {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);

  // Load scores on mount
  useEffect(() => {
    dispatch({ type: 'LOAD_SCORES' });
  }, []);

  // Save score when playerNameToSave changes (side effect outside reducer)
  useEffect(() => {
    if (state.playerNameToSave) {
      ScoreManager.saveScore(state.playerNameToSave, state.score);
      dispatch({ type: 'LOAD_SCORES' });
    }
  }, [state.playerNameToSave, state.score]);

  // Game timer
  const handleTick = useCallback(() => {
    dispatch({ type: 'TICK' });
  }, []);

  useGameTimer(state.gameState === GAME_STATES.PLAYING, handleTick);

  // Auto validation
  const handleCorrectAnswer = useCallback(() => {
    dispatch({ type: 'CORRECT_ANSWER' });
  }, []);

  useAutoValidation(state.userInput, state.currentProblem, handleCorrectAnswer);

  // Success animation
  const handleHideSuccess = useCallback(() => {
    dispatch({ type: 'HIDE_SUCCESS' });
  }, []);

  useSuccessAnimation(state.showSuccess, handleHideSuccess);

  // Event handlers
  const handleStart = useCallback(() => {
    dispatch({ type: 'START_GAME' });
  }, []);

  const handleInputChange = useCallback((value) => {
    dispatch({ type: 'UPDATE_INPUT', payload: value });
  }, []);

  const handleSaveScore = useCallback((name) => {
    dispatch({ type: 'SAVE_SCORE', payload: name });
  }, []);

  const handleReturnToMenu = useCallback(() => {
    dispatch({ type: 'RETURN_TO_MENU' });
  }, []);

  // Render appropriate screen
  switch (state.gameState) {
    case GAME_STATES.MENU:
      return <MenuScreen onStart={handleStart} topScores={state.topScores} />;

    case GAME_STATES.PLAYING:
      return (
        <GameScreen
          problem={state.currentProblem}
          userInput={state.userInput}
          onInputChange={handleInputChange}
          score={state.score}
          timeRemaining={state.timeRemaining}
          showSuccess={state.showSuccess}
        />
      );

    case GAME_STATES.GAME_OVER:
      return (
        <GameOverScreen
          score={state.score}
          onSaveScore={handleSaveScore}
          onReturnToMenu={handleReturnToMenu}
        />
      );

    default:
      return null;
  }
};

export default MathGameApp;