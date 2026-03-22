const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const compression = require('compression');

const app = express();

// ── Gzip all responses ──
app.use(compression({ level: 6 }));

app.use(cors());
app.use(express.json());

// ── Serve Vite build (only when running standalone, not behind Nginx) ──
// Set SERVE_CLIENT=true if you want Express to serve the frontend directly
if (process.env.SERVE_CLIENT === 'true') {
  const distPath = path.join(__dirname, '../client/dist');

  // Hashed assets → 1 year immutable cache
  app.use('/assets', express.static(path.join(distPath, 'assets'), {
    maxAge: '1y',
    immutable: true,
  }));

  // Root static files
  app.use(express.static(distPath, { maxAge: '1d' }));

  // SPA fallback
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  // Socket.IO performance tuning
  pingInterval: 10000,
  pingTimeout: 5000,
  maxHttpBufferSize: 1e7, // 10MB limit
  transports: ['websocket', 'polling'],
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
          countdown: room.status === 'starting' ? 5 : null,
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
      connected: true,
      missedQuestionsCount: 0
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

    room.currentQuestionIndex++;

    if (room.currentQuestionIndex >= room.questions.length) {
      room.status = 'ended';
      io.to(roomId).emit('game-ended');
      return;
    }

    // Step 1: Reading stage (3s)
    room.status = 'reading';
    const currentQ = room.questions[room.currentQuestionIndex];
    const readingData = {
      index: room.currentQuestionIndex,
      question: currentQ.question,
      image: currentQ.image || null,
      totalQuestions: room.questions.length
    };
    io.to(roomId).emit('question-reading', readingData);

    setTimeout(() => {
      if (!rooms[roomId] || rooms[roomId].status !== 'reading') return;
      
      // Step 2: Playing stage (20s)
      room.status = 'playing';
      room.timeLeft = 20;
      io.to(roomId).emit('question-playing', { choices: currentQ.choices, time: 20 });

      clearInterval(room.timerInterval);
      room.timerInterval = setInterval(() => {
        room.timeLeft--;
        if (room.timeLeft <= 0) {
          clearInterval(room.timerInterval);
          showResult(roomId);
        }
      }, 1000);
    }, 3000);
  };

  const showResult = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;

    room.status = 'result';
    const q = room.questions[room.currentQuestionIndex];
    
    // Auto-kick logic: Track missed questions for disconnected players
    room.players.forEach(p => {
      if (!p.answeredCurrent) {
        if (!p.connected) {
          p.missedQuestionsCount = (p.missedQuestionsCount || 0) + 1;
        }
      } else {
        p.missedQuestionsCount = 0;
      }
    });

    const initialCount = room.players.length;
    room.players = room.players.filter(p => p.connected || p.missedQuestionsCount < 3);
    
    if (room.players.length < initialCount) {
      console.log(`Auto-kicked some inactive players in room ${roomId}`);
      io.to(room.adminId).emit('player-joined', room.players); // Refresh admin list
    }
    
    // Update scores
    room.players.forEach(p => {
      p.isCorrect = (p.currentAnswer === q.correct);
      if (p.isCorrect) {
        p.streak = (p.streak || 0) + 1;
        // Simple scoring: 100 base + speed bonus (timeLeft * 10)
        let basePoints = 100 + (p.answerTimeLeft || 0) * 10;
        
        // Streak bonus
        let bonusPct = 0;
        if (p.streak === 2) bonusPct = 0.05;
        else if (p.streak === 3) bonusPct = 0.10;
        else if (p.streak >= 4) bonusPct = 0.15;
        
        const streakBonus = Math.round(basePoints * bonusPct);
        const totalPoints = basePoints + streakBonus;
        
        p.lastEarned = totalPoints;
        p.score += totalPoints;
        p.totalTime = (p.totalTime || 0) + (20 - (p.answerTimeLeft || 0));
      } else {
        p.lastEarned = 0;
        p.streak = 0;
      }
      // Reset for next
      p.answeredCurrent = false;
      p.currentAnswer = null;
      p.answerTimeLeft = 0;
    });

    io.to(roomId).emit('question-result', {
      correctAnswer: q.correct,
      players: room.players
    });

    // Wait 4s then show either intermediate leaderboard or FINAL leaderboard
    setTimeout(() => {
      if (!rooms[roomId] || rooms[roomId].status !== 'result') return;
      const isLastQuestion = room.currentQuestionIndex === (room.questions?.length - 1);
      
      if (isLastQuestion) {
        showFinalLeaderboard(roomId);
      } else {
        showIntermediateLeaderboard(roomId);
      }
    }, 4000);
  };

  const showFinalLeaderboard = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    
    room.status = 'leaderboard';
    const sortedPlayers = [...room.players].sort((a,b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.totalTime || 0) - (b.totalTime || 0);
    });
    
    io.to(roomId).emit('game-ended');
    io.to(roomId).emit('show-leaderboard', sortedPlayers);
  };

  const showIntermediateLeaderboard = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    
    room.status = 'leaderboard-inter';
    const sortedPlayers = [...room.players].sort((a,b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.totalTime || 0) - (b.totalTime || 0);
    });
    
    io.to(roomId).emit('intermediate-leaderboard', sortedPlayers);
  };

  socket.on('next-question', (otp) => {
    const room = rooms[otp];
    if (room && room.adminId === socket.id && room.status === 'leaderboard-inter') {
      nextQuestion(otp);
    }
  });

  socket.on('start-game', (otp) => {
    const room = rooms[otp];
    if (room && room.adminId === socket.id) {
      room.status = 'starting';
      let countdown = 5;
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
      player.answerTimeLeft = room.timeLeft; // Record time left for bonus
      // Tell admin someone answered
      io.to(room.adminId).emit('player-answered', room.players);
      
      const allAnswered = room.players.filter(p => p.connected).every(p => p.answeredCurrent);
      if (allAnswered) {
        clearInterval(room.timerInterval);
        showResult(otp);
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
          
          // If game is playing, check if this disconnection makes everyone answered
          if (room.status === 'playing') {
            const allAnswered = room.players.filter(p => p.connected).every(p => p.answeredCurrent);
            if (allAnswered) {
              clearInterval(room.timerInterval);
              showResult(userInfo.otp);
            }
          }
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

// Health check endpoint for Docker
app.get('/health', (_, res) => res.json({ status: 'ok', rooms: Object.keys(rooms).length }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
