const { io } = require('socket.io-client');

// USAGE: node simulate.js <ROOM_OTP> <NUM_PLAYERS> <SERVER_URL>
// Example: node simulate.js 123456 50 http://localhost:3001

const OTP = process.argv[2];
const NUM_PLAYERS = parseInt(process.argv[3]) || 50;
const SERVER_URL = process.argv[4] || 'http://localhost:3001';

if (!OTP) {
    console.error('Error: Please provide a 6-digit ROOM OTP.');
    console.log('Usage: node simulate.js <OTP> [NUM_PLAYERS] [SERVER_URL]');
    process.exit(1);
}

console.log(`🚀 Starting load test...`);
console.log(`📍 Server: ${SERVER_URL}`);
console.log(`🏠 Room: ${OTP}`);
console.log(`👥 Players: ${NUM_PLAYERS}\n`);

const connections = [];

function createPlayer(id) {
    const socket = io(SERVER_URL, {
        transports: ['websocket'], // Use websocket for better performance
        forceNew: true
    });

    const nickname = `Bot_${id}_${Math.random().toString(36).substring(2, 5)}`;
    const sessionId = `sim_${id}_${Date.now()}`;

    socket.on('connect', () => {
        // console.log(`[${nickname}] Connected.`);
        socket.emit('join-room', { 
            otp: OTP, 
            nickname, 
            avatar: '', 
            sessionId 
        }, (res) => {
            if (res.success) {
                console.log(`✅ [${nickname}] Joined room.`);
            } else {
                console.error(`❌ [${nickname}] Failed to join: ${res.message}`);
                socket.disconnect();
            }
        });
    });

    socket.on('new-question', (data) => {
        // console.log(`[${nickname}] New question index ${data.index}. Thinking...`);
        
        // Random delay simulation (human speed)
        const delay = 1000 + Math.random() * 7000; 
        
        setTimeout(() => {
            const answerIndex = Math.floor(Math.random() * 4);
            socket.emit('submit-answer', { otp: OTP, answerIndex });
            // console.log(`[${nickname}] Submitted answer ${answerIndex} after ${Math.round(delay)}ms`);
        }, delay);
    });

    socket.on('game-ended', () => {
        console.log(`🏁 [${nickname}] Game ended.`);
    });

    socket.on('disconnect', () => {
        // console.log(`[${nickname}] Disconnected.`);
    });

    return socket;
}

for (let i = 1; i <= NUM_PLAYERS; i++) {
    // Stagger connections slightly (100ms)
    setTimeout(() => {
        connections.push(createPlayer(i));
    }, i * 100);
}

console.log('⚡ All bot connection timers started.');

// Keep process alive
process.on('SIGINT', () => {
    console.log('\nStopping simulation...');
    connections.forEach(s => s.disconnect());
    process.exit();
});
