const { io } = require('socket.io-client');
const fs = require('fs');

const socket = io('http://localhost:3001');
const questions = JSON.parse(fs.readFileSync('/Users/khoadong/Desktop/Khoa/khoot-Tillo-game/sample_questions.json', 'utf8'));

socket.on('connect', () => {
  socket.emit('create-room', { maxPlayers: 10, questions }, (res) => {
    socket.on('new-question', (qData) => {
      console.log(`[Admin] new-question ${qData.index}: ${JSON.stringify(qData)}`);
    });
    socket.emit('start-game', res.otp);
    
    // Simulate a player
    const pSocket = io('http://localhost:3001');
    pSocket.on('connect', () => {
      pSocket.emit('join-room', { otp: res.otp, nickname: 'TestUser', avatar: '' }, () => {
         pSocket.on('new-question', (qData) => {
             setTimeout(() => pSocket.emit('submit-answer', { otp: res.otp, answerIndex: 1 }), 100);
         });
      });
    });

    setTimeout(() => process.exit(0), 10000);
  });
});
