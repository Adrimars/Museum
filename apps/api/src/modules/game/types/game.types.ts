export interface ClueOption {
  text: string;
  isCorrect: boolean;
}

export interface ClueQuestion {
  text: string;
  options: ClueOption[];
  hintText: string;
}

export interface Clue {
  clueIndex: number;
  narrativeText: string;
  locationHint: string;
  artifactId: string;
  qrCodeId: string;
  question: ClueQuestion;
}

export interface MuseumLimits {
  maxAnswerAttemptsPerClue: number;
  hintsPerClue: number;
  hintRevealOnAttempt: number;
  gameSessionTimeoutHours: number;
  gameClueTimerSeconds: number;
  timeBonusEnabled: boolean;
  timeBonusMax: number;
  maxFinalCodeAttempts: number;
}

export interface MuseumSettings {
  modules: {
    treasureHuntEnabled: boolean;
    quizEnabled: boolean;
    aiAssistantEnabled: boolean;
  };
  limits: MuseumLimits;
}
