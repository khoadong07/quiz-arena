// ===================== QUIZ STATE =====================
export let questions = [];
export let currentIndex = 0;
export let score = 0;
export let unansweredQuestions = [];

// ===================== DEFAULT SETTINGS =====================
const defaultSettings = {
  amount: 10,
  category: 21,
  difficulty: 'easy',
  timer: 10
};

// ===================== SETTINGS MANAGEMENT =====================
export let settings = { ...defaultSettings };

export const loadSettings = () => {
  const saved = localStorage.getItem('khootSettings');
  if (saved) {
    settings = { ...defaultSettings, ...JSON.parse(saved) };
  }
};


export const saveSettings = (newSettings) => {
  settings = { ...settings, ...newSettings };
  localStorage.setItem('khootSettings', JSON.stringify(settings));
};

export const getSettings = () => {
  return { ...settings };
};

// ===================== QUESTIONS MANAGEMENT =====================
export const setQuestions = (data) => {
  questions = data;
};

// ===================== QUIZ PROGRESS =====================
export const nextIndex = () => {
  currentIndex++;
};

export const increaseScore = () => {
  score++;
};

// ===================== RESET =====================
// Quizni qayta boshlash uchun state ni tozalash
export const resetState = () => {
  questions = [];
  currentIndex = 0;
  score = 0;
  unansweredQuestions = [];
};
