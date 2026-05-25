export interface QuizOption {
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestionRaw {
  id: string;
  questionText: string;
  options: unknown;
  explanation: string | null;
  difficulty: string;
}

export interface QuizSessionCache {
  userId: string;
  museumId: string;
  difficulty: string;
  questionIds: string[];
  currentQuestionIndex: number;
  timerMs: number;
}

export interface QuizClientOption {
  text: string;
}

export interface QuizClientQuestion {
  id: string;
  questionText: string;
  options: QuizClientOption[];
  timerSeconds: number;
  questionNumber: number;
  totalQuestions: number;
}
