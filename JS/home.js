// ===================== IMPORT =====================
import { fetchQuestions } from "./api.js";
import { questions, currentIndex, score, nextIndex, increaseScore, resetState, settings } from "./state.js";
import { showLoading, hideLoading } from "./ui.js";
import { loadSettings } from "./state.js";

// ===================== DOM ELEMENTS =====================
const questionsContainer = document.getElementById("questionsContainer");
const startContainer = document.getElementById("startContainer");
const startQuizBtn = document.getElementById("startQuizBtn");
const welcomeMessage = document.getElementById("welcomeMessage");

// ===================== LOAD SETTINGS =====================
loadSettings();

// ===================== INITIALIZE APP =====================
document.addEventListener("DOMContentLoaded", () => {
  // Get current player name and show welcome message
  const currentPlayerName = localStorage.getItem("currentPlayer");
  if (currentPlayerName) {
    welcomeMessage.textContent = `Salom, ${currentPlayerName}!`;
  }

  // Add start button event listener
  startQuizBtn?.addEventListener("click", async () => {
    // Hide start container, show loading
    startContainer.classList.add('hidden');
    document.getElementById('loadingContainer').classList.remove('hidden');

    // Start the quiz
    await fetchQuestions();
    renderQuestion();
  });
});

// ===================== LEADERBOARD =====================
const updateLeaderboard = () => {
  const leaderboardList = document.querySelector(".leaderboard-list");
  if (leaderboardList) {
    // Get players array from localStorage
    const players = JSON.parse(localStorage.getItem("players")) || [];

    // Sort players by score (highest first)
    const sortedPlayers = players.sort((a, b) => b.score - a.score);

    // Take only top 3 players
    const topPlayers = sortedPlayers.slice(0, 3);

    // Generate HTML for leaderboard
    leaderboardList.innerHTML = topPlayers.map((player, index) => `
      <div class="player">
        <span class="rank">${index + 1}</span>
        <span class="name">${player.name}</span>
        <span class="score">${player.score}</span>
      </div>
    `).join('');

    // If fewer than 3 players, show empty slots
    while (leaderboardList.children.length < 3) {
      const emptySlot = document.createElement('div');
      emptySlot.className = 'player';
      emptySlot.innerHTML = `
        <span class="rank">${leaderboardList.children.length + 1}</span>
        <span class="name">—</span>
        <span class="score">0</span>
      `;
      leaderboardList.appendChild(emptySlot);
    }
  }
};

// ===================== RENDER QUESTION =====================
let timerInterval;
let timerTimeout;

const renderQuestion = () => {
  hideLoading(); // Loading ekranini yashirish

  if (questions.length === 0) {
    questionsContainer.innerHTML = '<p class="questions">Savollar yuklanmadi. Qayta urinib ko\'ring.</p>';
    return;
  }

  const item = questions[currentIndex];

  // Javoblarni arrayga yig‘amiz va shuffle qilamiz
  const answersArray = [item.correct_answer, ...item.incorrect_answers];
  answersArray.sort(() => Math.random() - 0.5);

  const timerDuration = settings.timer * 1000; // sekundni millisekundga o‘zgartirish

  // HTML render
  questionsContainer.innerHTML = `
    <p class="questions">
      ${currentIndex + 1} / ${questions.length}. ${item.question}
    </p>
    <div class="timer-container">
      <div class="timer-bar" id="timerBar"></div>
      <div class="timer-text" id="timerText">🕒 ${settings.timer}</div>
    </div>
    <div class="answer-container">
      ${answersArray.map((ans) => `<div class="answer">${ans}</div>`).join("")}
    </div>
    <p class="score">Score: ${score}</p>
  `;

  const answers = document.querySelectorAll(".answer");
  const timerBar = document.getElementById("timerBar");
  const timerText = document.getElementById("timerText");

  // ===================== TIMER =====================
  let timeLeft = settings.timer;
  const updateInterval = 100; // ms
  const decrement = updateInterval / 1000;

  timerInterval = setInterval(() => {
    timeLeft -= decrement;
    const percentage = (timeLeft / settings.timer) * 100;
    timerBar.style.width = `${Math.max(0, percentage)}%`;
    timerText.textContent = `🕒 ${Math.ceil(timeLeft)}`;

    if (timeLeft <= 0) clearInterval(timerInterval);
  }, updateInterval);

  // Timeout handler
  timerTimeout = setTimeout(() => {
    answers.forEach((a) => (a.style.pointerEvents = "none")); // Javoblarni bloklash

    answers.forEach((a) => {
      if (a.textContent === item.correct_answer) a.classList.add("correct");
      else a.classList.add("wrong");
    });

    setTimeout(nextQuestion, 1000); // Keyingi savolga o‘tish
  }, timerDuration);

  // ===================== ANSWER CLICK =====================
  answers.forEach((answer) => {
    answer.addEventListener("click", () => {
      clearInterval(timerInterval);
      clearTimeout(timerTimeout);

      answers.forEach((a) => (a.style.pointerEvents = "none")); // Boshqa clickni bloklash

      if (answer.textContent === item.correct_answer) {
        answer.classList.add("correct");
        increaseScore(); // Ball qo‘shish
      } else {
        answer.classList.add("wrong");
        // To‘g‘ri javobni ko‘rsatish
        answers.forEach((a) => {
          if (a.textContent === item.correct_answer) a.classList.add("correct");
        });
      }

      setTimeout(nextQuestion, 1000); // Keyingi savolga o‘tish
    });
  });
};

// ===================== NEXT QUESTION =====================
const nextQuestion = () => {
  nextIndex();
  if (currentIndex < questions.length) renderQuestion();
  else showResult();
};

// ===================== SHOW RESULT =====================
const showResult = () => {
  // Get current player name
  const currentPlayerName = localStorage.getItem("currentPlayer");

  if (currentPlayerName) {
    // Get players array and update current player's score (keep highest score)
    const players = JSON.parse(localStorage.getItem("players")) || [];
    const playerIndex = players.findIndex(player => player.name === currentPlayerName);

    if (playerIndex !== -1) {
      // Only update if new score is higher than current score
      players[playerIndex].score = Math.max(players[playerIndex].score, score);
      // Save updated players array
      localStorage.setItem("players", JSON.stringify(players));
    }
  }

  questionsContainer.innerHTML = `
    <div class="result-container">
      <h2 class="result-title">🎉 Quiz tugadi!</h2>
      <p class="result-score">Natija: <b>${score} / ${questions.length}</b></p>
      <button id="restartBtn" class="restart-btn">Qayta o'ynash</button>
    </div>
  `;

  document.getElementById("restartBtn").addEventListener("click", () => {
    resetState();        // Quizni reset qilish
    // Hide result, show start container again
    questionsContainer.classList.add('hidden');
    startContainer.classList.remove('hidden');
  });

  updateLeaderboard(); // Leaderboardni yangilash
};

// ===================== INITIAL LEADERBOARD =====================
updateLeaderboard(); // Sahifa yuklanganda leaderboardni render qilish
