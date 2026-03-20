const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// In-memory store
const rooms = {};
// User mapping to find room by socket.id immediately
const users = {}; 

const generateOTP = () => {
  let otp;
  do {
    otp = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms[otp]);
  return otp;
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create-room', ({ maxPlayers, questions }, callback) => {
    const otp = generateOTP();
    const adminToken = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    rooms[otp] = {
      id: otp,
      adminId: socket.id,
      adminToken: adminToken,
      maxPlayers: maxPlayers || 50,
      questions: questions, // [{ question: "...", choices: ["A", "B", "C", "D"], correct: 0 }]
      currentQuestionIndex: -1,
      players: [],
      status: 'waiting', // waiting, starting, playing, ended
      timeLeft: 0,
      timerInterval: null
    };
    
    socket.join(otp);
    callback({ success: true, otp, adminToken });
    console.log(`Room created: ${otp} by admin ${socket.id}`);
  });

  socket.on('admin-rejoin', ({ otp, adminToken }, callback) => {
    const room = rooms[otp];
    if (room && room.adminToken === adminToken) {
      room.adminId = socket.id;
      
      const currentQ = room.questions[room.currentQuestionIndex];
      const questionData = currentQ ? {
        index: room.currentQuestionIndex,
        question: currentQ.question,
        image: currentQ.image || null,
        choices: currentQ.choices,
        time: room.timeLeft
      } : null;

      callback({
        success: true,
        room: {
          status: room.status,
          players: room.players,
          countdown: room.status === 'starting' ? 10 : null,
          timeLeft: room.timeLeft,
          questionData,
          leaderboard: room.status === 'leaderboard' ? [...room.players].sort((a,b) => {
            if (b.score !== a.score) return b.score - a.score;
            return (a.totalTime || 0) - (b.totalTime || 0);
          }) : []
        }
      });
      console.log(`Admin rejoined room ${otp}`);
    } else {
      callback({ success: false, message: 'Invalid admin token' });
    }
  });

  socket.on('join-room', ({ otp, nickname, avatar, sessionId }, callback) => {
    const room = rooms[otp];
    if (!room) return callback({ success: false, message: 'Phòng không tồn tại!' });
    
    // Check if player is reconnecting
    const existingBySession = sessionId ? room.players.find(p => p.sessionId === sessionId) : null;
    
    if (existingBySession) {
      existingBySession.socketId = socket.id;
      existingBySession.avatar = avatar; // Update avatar just in case
      existingBySession.nickname = nickname; // Update nickname if changed
      existingBySession.connected = true; // Mark as online
      users[socket.id] = { otp, nickname };
      socket.join(otp);
      
      const currentQ = room.questions[room.currentQuestionIndex];
      const resumeState = {
        status: room.status, // waiting, starting, playing, ended, leaderboard
        timeLeft: room.timeLeft,
        answeredCurrent: existingBySession.answeredCurrent,
        questionData: currentQ ? {
           index: room.currentQuestionIndex,
           question: currentQ.question,
           choices: currentQ.choices,
           time: room.timeLeft 
        } : null
      };

      io.to(room.adminId).emit('player-joined', room.players); // Notify admin of reconnect
      return callback({ success: true, isReconnected: true, resumeState });
    }

    // Prevent duplicate name for new players
    const existingByName = room.players.find(p => p.nickname.toLowerCase() === nickname.toLowerCase());
    if (existingByName) {
      return callback({ success: false, message: 'Tên người chơi này đã có người sử dụng trong phòng! Vui lòng đổi tên khác.' });
    }

    if (room.status !== 'waiting') return callback({ success: false, message: 'Trò chơi đã bắt đầu!' });
    if (room.players.length >= room.maxPlayers) return callback({ success: false, message: 'Phòng đã đầy!' });

    const newPlayer = {
      socketId: socket.id,
      sessionId,
      nickname,
      avatar,
      score: 0,
      answeredCurrent: false,
      currentAnswer: null,
      connected: true
    };

    room.players.push(newPlayer);
    users[socket.id] = { otp, nickname };
    socket.join(otp);

    // Notify admin
    io.to(room.adminId).emit('player-joined', room.players);
    
    callback({ success: true });
    console.log(`${nickname} joined room ${otp}`);
  });

  const nextQuestion = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    // Check answers of the *previous* question and update scores
    if (room.currentQuestionIndex >= 0 && room.currentQuestionIndex < room.questions.length) {
      const q = room.questions[room.currentQuestionIndex];
      room.players.forEach(p => {
        if (p.currentAnswer === q.correct) {
          p.score += 1;
          p.totalTime = (p.totalTime || 0) + (p.answerTime || 0);
        }
        p.answeredCurrent = false;
        p.currentAnswer = null;
        p.answerTime = 0;
      });
      // Send updated leaderboard to admin (optional, Kahoot shows intermediate scores)
      io.to(room.adminId).emit('update-scores', room.players);
    }

    room.currentQuestionIndex++;

    if (room.currentQuestionIndex >= room.questions.length) {
      room.status = 'ended';
      io.to(roomId).emit('game-ended');
      return;
    }

    room.status = 'playing';
    room.timeLeft = 10; // 10s per question
    
    const currentQ = room.questions[room.currentQuestionIndex];
    const questionDataForPlayer = {
      index: room.currentQuestionIndex,
      question: currentQ.question,
      image: currentQ.image || null,
      choices: currentQ.choices,
      time: 10
    };

    io.to(roomId).emit('new-question', questionDataForPlayer);

    clearInterval(room.timerInterval);
    room.timerInterval = setInterval(() => {
      room.timeLeft--;
      if (room.timeLeft <= 0) {
        clearInterval(room.timerInterval);
        io.to(roomId).emit('time-up');
        // Briefly wait then next question
        setTimeout(() => nextQuestion(roomId), 2000); 
      }
    }, 1000);
  };

  socket.on('start-game', (otp) => {
    const room = rooms[otp];
    if (room && room.adminId === socket.id) {
      room.status = 'starting';
      let countdown = 10;
      io.to(otp).emit('game-starting', countdown);
      
      const countInterval = setInterval(() => {
        countdown--;
        io.to(otp).emit('game-starting', countdown);
        if (countdown <= 0) {
          clearInterval(countInterval);
          nextQuestion(otp);
        }
      }, 1000);
    }
  });

  socket.on('submit-answer', ({ otp, answerIndex }) => {
    const room = rooms[otp];
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (player && !player.answeredCurrent) {
      player.answeredCurrent = true;
      player.currentAnswer = answerIndex;
      player.answerTime = 10 - room.timeLeft; // Record time taken
      // Tell admin someone answered
      io.to(room.adminId).emit('player-answered', room.players);
      
      // If all answered, we could skip the remaining time, but requirement says:
      // "Sau mỗi câu hỏi, khi hết 60 giây, câu hỏi tiếp theo tự động xuất hiện mà không cần chờ người chơi."
      // So we just let the timer run, or maybe clear interval if everyone answered to speed up?
      // Kahoot usually skips. Let's stick to simple timer unless all answered.
      const allAnswered = room.players.every(p => p.answeredCurrent);
      if (allAnswered) {
        clearInterval(room.timerInterval);
        room.timeLeft = 0;
        io.to(otp).emit('time-up');
        // Next immediately
        setTimeout(() => nextQuestion(otp), 2000);
      }
    }
  });

  socket.on('show-results', (otp) => {
    const room = rooms[otp];
    if (room && room.adminId === socket.id && room.status === 'ended') {
      const sortedPlayers = [...room.players].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.totalTime || 0) - (b.totalTime || 0);
      });
      io.to(otp).emit('show-leaderboard', sortedPlayers);
      
      // Kill room after game ends to prevent bugs and free memory
      room.players.forEach(p => {
        if (p.socketId && users[p.socketId]) {
          delete users[p.socketId];
        }
      });
      delete rooms[otp];
      console.log(`Room ${otp} explicitly killed after game ended.`);
    }
  });

  socket.on('disconnect', () => {
    const userInfo = users[socket.id];
    if (userInfo) {
      const room = rooms[userInfo.otp];
      if (room) {
        const player = room.players.find(p => p.socketId === socket.id);
        if (player) {
          player.connected = false;
          io.to(room.adminId).emit('player-joined', room.players);
        }
      }
      delete users[socket.id];
    } else {
      // Might be an admin disconnecting
      for (const otp in rooms) {
        if (rooms[otp].adminId === socket.id) {
          // Admin left, end the room
          clearInterval(rooms[otp].timerInterval);
          io.to(otp).emit('room-closed');
          delete rooms[otp];
          break;
        }
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
