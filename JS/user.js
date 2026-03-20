// ===================== ELEMENTLARNI TANLAB OLISH =====================
const userForm = document.getElementById("userForm");
const leaderboardList = document.querySelector(".leaderboard-list");

// ===================== USER FORM SUBMIT HANDLER =====================
userForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const userName = document.getElementById("nameInput").value;
  if (userName) {
    // Get existing players array or create empty array
    const players = JSON.parse(localStorage.getItem("players")) || [];

    // Check if player already exists
    const existingPlayerIndex = players.findIndex(player => player.name === userName);

    if (existingPlayerIndex === -1) {
      // Add new player with score 0
      players.push({ name: userName, score: 0 });
    }

    // Save updated players array
    localStorage.setItem("players", JSON.stringify(players));
    // Also set current player name for quiz reference
    localStorage.setItem("currentPlayer", userName);

    setTimeout(() => {
      window.location.href = "home.html";
    }, 1000);
  } else {
    alert("Iltimos, ismingizni kiriting!");
  }
});

// ===================== LEADERBOARD UPDATE =====================
const updateLeaderboard = () => {
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
    while (topPlayers.length < 3) {
      topPlayers.push({ name: "—", score: 0 });
      leaderboardList.innerHTML += `
        <div class="player">
          <span class="rank">${topPlayers.length}</span>
          <span class="name">—</span>
          <span class="score">0</span>
        </div>
      `;
    }
  }
};

// Update leaderboard on page load
updateLeaderboard();
