// ===================== IMPORT =====================
import {
  questions,
  currentIndex,
  nextIndex,
  increaseScore,
} from "./state.js";

import { renderQuestion, showResult } from "./ui.js";

// ===================== HANDLE ANSWER CLICK =====================
export const handleAnswerClick = (answer) => {
  const item = questions[currentIndex];
  const answers = document.querySelectorAll(".answer");

  answers.forEach(a => (a.style.pointerEvents = "none"));

  // ===================== JAVOB TEKSHIRISH =====================
  if (answer.textContent === item.correct_answer) {
    answer.classList.add("correct");
    increaseScore();
  } else {
    answer.classList.add("wrong");
    answers.forEach(answer => {
      if (answer.textContent === item.correct_answer) {
        answer.classList.add("correct");
      }
    });
  }

  // ===================== KEYINGI SAVOL =====================
  setTimeout(() => {
    nextIndex();
    currentIndex < questions.length ? renderQuestion() : showResult();
  }, 1000); 
};
