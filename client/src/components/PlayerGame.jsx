import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogOut, CheckCircle, Clock, Loader2, X } from 'lucide-react';
import Confetti from 'react-confetti';
import { socket } from '../socket';
import bg from '../assets/19.jpg';

// Helper component for counting points
function ScoreCounter({ target, lastEarned }) {
  const [current, setCurrent] = useState(target - lastEarned);
  const [showDelta, setShowDelta] = useState(false);
  
  useEffect(() => {
    if (lastEarned > 0) {
      setTimeout(() => setShowDelta(true), 300);
      const start = target - lastEarned;
      const duration = 1200; 
      const startTime = performance.now();
      
      const animate = (time) => {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOutQuad = (t) => t * (2 - t);
        const nextVal = Math.floor(start + (target - start) * easeOutQuad(progress));
        setCurrent(nextVal);
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    } else {
      setCurrent(target);
    }
  }, [target, lastEarned]);

  return (
    <div className="player-score-container">
      <div className="player-total-score">{current} <small>đ</small></div>
      {showDelta && lastEarned > 0 && <div className="player-delta-badge">+{lastEarned}</div>}
    </div>
  );
}

import theme1 from "../audio/theme/Late Night Talk Show Music _ For content creator.mp3";
import theme2 from "../audio/theme/Late Night Talk Show Music _ For content creator.mp3";
import cheerMusicFile from "../audio/cheer/CROWD CHEER SOUND EFFECT.mp3";
import countdownMusicFile from "../audio/theme/countdown.mp3";

export default function PlayerGame() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const [sessionData, setSessionData] = useState(state);
  const [status, setStatus] = useState('waiting');
  const [countdown, setCountdown] = useState(5);
  const [questionData, setQuestionData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [resultData, setResultData] = useState(null);
  const [myResult, setMyResult] = useState(null);
  const [myScore, setMyScore] = useState(0);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const bgMusicRef = useRef(null);
  const winMusicRef = useRef(null);
  const countdownMusicRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (bgMusicRef.current) {
      if (['reading', 'playing', 'time-up'].includes(status)) bgMusicRef.current.play().catch(() => { });
      else { bgMusicRef.current.pause(); bgMusicRef.current.currentTime = 0; }
    }
    if (winMusicRef.current) {
      const isWinner = leaderboard.length > 0 && leaderboard[0].nickname === sessionData?.nickname;
      if (status === 'leaderboard' && isWinner) winMusicRef.current.play().catch(() => { });
      else { winMusicRef.current.pause(); winMusicRef.current.currentTime = 0; }
    }
    // Countdown music removed as requested
  }, [status, leaderboard, sessionData]);

  // Lock back navigation
  useEffect(() => {
    window.history.pushState(null, document.title, window.location.href);
    const h = () => window.history.pushState(null, document.title, window.location.href);
    window.addEventListener('popstate', h);
    return () => window.removeEventListener('popstate', h);
  }, []);

  // Main socket setup
  useEffect(() => {
    let currentSession = state;
    if (!currentSession) {
      const saved = localStorage.getItem('khoot_session');
      if (saved) { currentSession = JSON.parse(saved); setSessionData(currentSession); }
      else { navigate('/join'); return; }
    }

    const connectAndJoin = (session) => {
      if (!socket.connected) {
        socket.connect();
      }
      
      socket.emit('join-room', session, (res) => {
        if (!res.success) {
          alert(res.message);
          localStorage.removeItem('khoot_session');
          navigate('/');
          return;
        }
        if (res.isReconnected && res.resumeState) {
          setStatus(res.resumeState.status);
          setTimeLeft(res.resumeState.timeLeft || 60);
          setQuestionData(res.resumeState.questionData);
          if (res.resumeState.myResult) {
            setMyResult(res.resumeState.myResult);
            setMyScore(res.resumeState.myResult.score);
          }
          if (res.resumeState.leaderboard) setLeaderboard(res.resumeState.leaderboard);
          if (res.resumeState.answeredCurrent) setSelectedAnswer(-1);
        }
        setIsConnected(true);
        setIsReconnecting(false);
      });
    };

    connectAndJoin(currentSession);

    const onConnect = () => {
      console.log('Socket connected');
      setIsConnected(true);
      setIsReconnecting(false);
      // Re-join room on reconnection
      if (currentSession) {
        socket.emit('join-room', currentSession, (res) => {
           if (res.success && res.isReconnected && res.resumeState) {
              setStatus(res.resumeState.status);
              setTimeLeft(res.resumeState.timeLeft || 60);
              setQuestionData(res.resumeState.questionData);
              if (res.resumeState.myResult) {
                setMyResult(res.resumeState.myResult);
                setMyScore(res.resumeState.myResult.score);
              }
              if (res.resumeState.leaderboard) setLeaderboard(res.resumeState.leaderboard);
              if (res.resumeState.answeredCurrent) setSelectedAnswer(-1);
           }
        });
      }
    };

    const onDisconnect = (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
      // Only set reconnecting if it wasn't a deliberate disconnect
      if (reason === 'io server disconnect' || reason === 'io client disconnect') {
         // deliberate
      } else {
         setIsReconnecting(true);
      }
    };

    const onConnectError = (error) => {
      console.error('Connection error:', error);
      setIsConnected(false);
      setIsReconnecting(true);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    const timerInterval = setInterval(() => setTimeLeft(p => p > 0 ? p - 1 : 0), 1000);

    socket.on('game-starting', count => { setStatus('starting'); setCountdown(count); });
    socket.on('question-reading', qData => {
      setStatus('reading');
      setQuestionData(qData);
      setCountdown(3);
      setSelectedAnswer(null);
      setResultData(null);
    });
    socket.on('question-playing', qData => {
      setStatus('playing');
      setQuestionData(prev => ({ ...prev, choices: qData.choices }));
      setTimeLeft(qData.time);
    });
    socket.on('question-result', data => {
      setStatus('result');
      setResultData(data);
      const me = data.players.find(p => p.nickname === currentSession.nickname);
      if (me) {
        setMyResult(me);
        setMyScore(me.score);
      }
    });
    socket.on('intermediate-leaderboard', lb => {
      setStatus('leaderboard-inter');
      setLeaderboard(lb);
      const me = lb.find(p => p.nickname === currentSession.nickname);
      if (me) setMyScore(me.score);
    });
    socket.on('game-ended', () => setStatus('ended'));
    socket.on('show-leaderboard', lb => {
      setStatus('leaderboard');
      setLeaderboard(lb);
      const me = lb.find(p => p.nickname === currentSession.nickname);
      if (me) setMyScore(me.score);
    });
    socket.on('room-closed', () => { localStorage.removeItem('khoot_session'); navigate('/'); });

    return () => {
      clearInterval(timerInterval);
      socket.off('game-starting'); socket.off('question-reading'); socket.off('question-playing');
      socket.off('question-result'); socket.off('intermediate-leaderboard');
      socket.off('game-ended'); socket.off('show-leaderboard'); socket.off('room-closed');
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, [navigate]);

  const handleAnswer = (index) => {
    if (selectedAnswer !== null || timeLeft <= 0 || status !== 'playing') return;
    setSelectedAnswer(index);
    socket.emit('submit-answer', { otp: sessionData.otp, answerIndex: index });
  };

  const handleLeave = () => {
    setShowExitConfirm(true);
  };

  const confirmLeave = () => {
    localStorage.removeItem('khoot_session');
    socket.disconnect();
    navigate('/');
  };

  const defaultAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${sessionData?.nickname || 'Player'}`;
  const avatarToUse = sessionData?.avatar || defaultAvatar;

  const timerColor = timeLeft > 10 ? 'var(--success)' : timeLeft > 5 ? 'var(--warning)' : 'var(--danger)';
  const timerPct = Math.round((timeLeft / 20) * 100);

  const THEMES = [theme1, theme2];
  const seed = (sessionData?.otp || '').toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const currentTheme = THEMES[seed % 2] || theme1;

  const audioNodes = (
    <>
      <div style={{ display: 'none' }}>
        <audio ref={bgMusicRef} src={currentTheme} loop preload="auto" />
        <audio ref={winMusicRef} src={cheerMusicFile} preload="auto" />
        <audio ref={countdownMusicRef} src={countdownMusicFile} preload="auto" />
      </div>
      {status === 'leaderboard' && leaderboard.length > 0 && leaderboard[0].nickname === sessionData?.nickname && (
        <Confetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={800} gravity={0.15} style={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none', zIndex: 9999 }} />
      )}
    </>
  );

  const renderExitConfirm = () => {
    if (!showExitConfirm) return null;
    return (
      <div className="modal-overlay" onClick={() => setShowExitConfirm(false)}>
        <div className="modal-card" onClick={e => e.stopPropagation()}>
          <CheckCircle size={48} style={{ color: 'var(--primary)', marginBottom: '1rem', display: 'none' }} />
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>Rời khỏi trò chơi?</h3>
          <p className="text-muted" style={{ marginBottom: '2rem' }}>Nếu thoát lúc này, bạn sẽ mất hết điểm số và không thể quay lại vòng đấu này!</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <button className="btn btn-ghost" onClick={() => setShowExitConfirm(false)} style={{ border: '1px solid var(--border)' }}>Ở LẠI</button>
            <button className="btn btn-danger" onClick={confirmLeave} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700 }}>THOÁT</button>
          </div>
        </div>
        <style>{`
          .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 99999; animation: fadeIn 0.3s; }
          .modal-card { background: #1a1b26; width: 90%; max-width: 400px; padding: 2.5rem; border-radius: 24px; text-align: center; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 30px 60px rgba(0,0,0,0.5); animation: modalPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
          @keyframes modalPop { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        `}</style>
      </div>
    );
  };

  const renderConnectionOverlay = () => {
    if (isConnected && !isReconnecting) return null;
    
    return (
      <div className="connection-overlay">
        <div className="connection-card">
          <Loader2 size={48} className="spin-slow" style={{ color: 'var(--primary)', marginBottom: '1.5rem' }} />
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>Mất kết nối</h3>
          <p className="text-muted" style={{ marginBottom: '1.5rem' }}>Đang cố gắng kết nối lại để bạn có thể tiếp tục chơi...</p>
          <div className="loading-bar">
            <div className="loading-progress" />
          </div>
        </div>
        <style>{`
          .connection-overlay { position: fixed; inset: 0; background: rgba(10,14,30,0.9); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; z-index: 100000; animation: fadeIn 0.4s ease; }
          .connection-card { background: #1a1b26; width: 90%; max-width: 400px; padding: 3rem 2rem; border-radius: 32px; text-align: center; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 40px 80px rgba(0,0,0,0.6); }
          .spin-slow { animation: spin 2s linear infinite; }
          .loading-bar { height: 6px; width: 100%; background: rgba(255,255,255,0.05); border-radius: 99px; overflow: hidden; }
          .loading-progress { height: 100%; width: 40%; background: var(--primary); border-radius: 99px; animation: loadingSwipe 1.5s infinite ease-in-out; }
          @keyframes loadingSwipe { 0% { transform: translateX(-100%); width: 30%; } 50% { width: 60%; } 100% { transform: translateX(300%); width: 30%; } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        `}</style>
      </div>
    );
  };

  // === Persistent Header ===
  const headerNode = (
    <div className="player-header">
      <div className="player-info">
        <img src={avatarToUse} alt="avatar" className="player-avatar-sm" />
        <span className="player-name">{sessionData?.nickname}</span>
      </div>
      <button onClick={handleLeave} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.5rem' }}>
        <LogOut size={22} />
      </button>
    </div>
  );

  // ── WAITING ──
  if (status === 'waiting') return (
    <>
      {audioNodes}
      {renderConnectionOverlay()}
      {renderExitConfirm()}
      {headerNode}
      <div className="screen-center" style={{ flex: 1, paddingTop: '2rem', backgroundImage: `linear-gradient(rgba(10,14,30,0.70), rgba(10,14,30,0.80)), url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="card" style={{ textAlign: 'center', gap: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Loader2 size={48} style={{ color: 'var(--primary)', animation: 'spin 1.2s linear infinite' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Đã vào phòng!</h2>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>Đang chờ Gamemaster bắt đầu...</p>
          <div style={{ marginTop: '0.5rem' }}>
            <span className="badge badge-warning">CODE: {sessionData?.otp}</span>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );

  // ── STARTING ──
  if (status === 'starting') return (
    <>
      {audioNodes}
      {renderConnectionOverlay()}
      {renderExitConfirm()}
      {headerNode}
      <div className="screen-center" style={{ flex: 1, backgroundImage: `linear-gradient(rgba(10,14,30,0.70), rgba(10,14,30,0.80)), url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Bắt đầu sau</p>
          <div className="countdown-big">{countdown}</div>
        </div>
      </div>
    </>
  );

  // ── READING ──
  if (status === 'reading') return (
    <>
      {audioNodes}
      {renderConnectionOverlay()}
      {renderExitConfirm()}
      {headerNode}
      <div className="screen-center" style={{ flex: 1, backgroundImage: `linear-gradient(rgba(10,14,30,0.70), rgba(10,14,30,0.80)), url(${bg})`, backgroundSize: 'cover' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, opacity: 0.8, marginBottom: '0.5rem' }}>Câu {(questionData?.index ?? 0) + 1}</h2>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '2rem' }}>{questionData?.question}</h1>
          <p className="text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>Chuẩn bị chọn...</p>
        </div>
      </div>
    </>
  );

  // ── PLAYING ──
  if (status === 'playing' || status === 'time-up') return (
    <>
      {audioNodes}
      {renderConnectionOverlay()}
      {renderExitConfirm()}
      {headerNode}
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', flex: 1, backgroundImage: `linear-gradient(rgba(10,14,30,0.70), rgba(10,14,30,0.80)), url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="game-header" style={{ marginTop: '0.5rem' }}>
          <span className="question-number">Câu {(questionData?.index ?? 0) + 1}</span>
          <span className="timer-display" style={{ color: timerColor }}>{timeLeft}s</span>
        </div>

        <div className="timer-bar-wrapper">
          <div style={{
            height: '100%',
            width: `${timerPct}%`,
            background: `linear-gradient(90deg, ${timerColor}, ${timerColor})`,
            borderRadius: 99,
            transition: 'width 1s linear, background 1s'
          }} />
        </div>

        {selectedAnswer !== null ? (
          <div className="answered-view" style={{ flex: 1 }}>
            <Loader2 className="spin" size={64} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Đã ghi nhận!</h3>
            <p className="text-muted">Chờ mọi người trả lời...</p>
          </div>
        ) : (
          <div className="choices-grid" style={{ marginTop: '1rem', flex: 1 }}>
            <button className="choice-btn choice-a notranslate" translate="no" onClick={() => handleAnswer(0)}>A</button>
            <button className="choice-btn choice-b notranslate" translate="no" onClick={() => handleAnswer(1)}>B</button>
            <button className="choice-btn choice-c notranslate" translate="no" onClick={() => handleAnswer(2)}>C</button>
            <button className="choice-btn choice-d notranslate" translate="no" onClick={() => handleAnswer(3)}>D</button>
          </div>
        )}
      </div>
      <style>{`.spin { animation: spin 1.5s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );

  // ── RESULT ──
  if (status === 'result') return (
    <>
      {audioNodes}
      {renderConnectionOverlay()}
      {renderExitConfirm()}
      {headerNode}
      <div className={`screen-center result-screen ${myResult?.isCorrect ? 'correct' : 'incorrect'}`} style={{ flex: 1 }}>
        <div className="result-card">
          <div className="result-icon">
            {myResult?.isCorrect ? <CheckCircle size={80} /> : <X size={80} />}
          </div>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.5rem' }}>
            {myResult?.isCorrect ? 'ĐÚNG!' : 'SAI RỒI!'}
          </h2>
          <div className="player-result-points">
             {myResult?.isCorrect ? (
               <div className="points-added-big">+{myResult.lastEarned} <small>đ</small></div>
             ) : (
               <div className="points-added-big" style={{ opacity: 0.6 }}>0 <small>đ</small></div>
             )}
          </div>
          {myResult?.streak >= 2 && (
             <div className="streak-badge" style={{ marginTop: '1rem' }}>
                🔥 Streak x{myResult.streak}
             </div>
          )}
          <p style={{ opacity: 0.8, marginTop: '1rem' }}>Hãy chuẩn bị cho câu tiếp theo</p>
        </div>
      </div>
      <style>{`
        .result-screen { transition: background 0.5s ease; }
        .result-screen.correct { background: var(--success); color: white; }
        .result-screen.incorrect { background: var(--danger); color: white; }
        .result-card { text-align: center; animation: pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        
        .player-score-container { position: relative; margin-top: 1rem; }
        .points-added-big { font-size: 4rem; font-weight: 950; margin-top: 1rem; animation: pointPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .points-added-big small { font-size: 1.5rem; opacity: 0.7; }
        @keyframes pointPop { 0% { transform: scale(0.5) translateY(20px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
        
        .player-total-score { font-size: 3rem; font-weight: 900; background: rgba(0,0,0,0.15); padding: 0.5rem 2rem; border-radius: 99px; display: inline-block; font-variant-numeric: tabular-nums; }
        .player-total-score small { font-size: 1.2rem; opacity: 0.7; }
        
        .player-delta-badge { 
          position: absolute; right: -20px; top: -30px;
          background: #34d399; color: white;
          padding: 0.4rem 1.2rem; border-radius: 12px;
          font-size: 1.8rem; font-weight: 900;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
          animation: playerFlyUp 2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        
        @keyframes playerFlyUp { 
          0% { transform: translateY(20px) scale(0.5); opacity: 0; }
          15% { transform: translateY(0) scale(1.2); opacity: 1; }
          100% { transform: translateY(-60px) scale(1); opacity: 0; }
        }
        .streak-badge { font-size: 1.2rem; font-weight: 900; background: #fbbf24; color: #000; padding: 0.4rem 1.2rem; border-radius: 99px; display: inline-block; animation: shake 0.5s ease infinite alternate; }
        @keyframes pop { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes shake { from { transform: rotate(-5deg); } to { transform: rotate(5deg); } }
      `}</style>
    </>
  );

  // ── INTERMEDIATE LEADERBOARD ──
  if (status === 'leaderboard-inter') {
    const myRankIndex = leaderboard.findIndex(p => p.nickname === sessionData?.nickname);
    const myData = myRankIndex !== -1 ? leaderboard[myRankIndex] : null;
    return (
      <>
        {audioNodes}
        {renderConnectionOverlay()}
        {renderExitConfirm()}
        {headerNode}
        <div className="screen-center" style={{ flex: 1, backgroundImage: `linear-gradient(rgba(10,14,30,0.8), rgba(10,14,30,0.95)), url(${bg})`, backgroundSize: 'cover' }}>
          <div className="card" style={{ textAlign: 'center', width: '90%', maxWidth: '400px' }}>
             <p className="text-muted" style={{ marginBottom: '1rem', fontWeight: 600 }}>TỔNG ĐIỂM HIỆN TẠI</p>
             <h2 style={{ fontSize: '3.5rem', fontWeight: 900, color: 'var(--primary)', marginBottom: '0.5rem' }}>{myData?.score || 0}</h2>
             {myData?.lastEarned > 0 && <div style={{ color: 'var(--success)', fontWeight: 800, fontSize: '1.2rem', marginBottom: '0.5rem' }}>+{myData.lastEarned} điểm</div>}
             {myData?.streak >= 2 && (
                <div style={{ background: '#fbbf24', color: '#000', fontWeight: 900, padding: '0.2rem 1rem', borderRadius: 99, display: 'inline-block', marginBottom: '1rem' }}>
                   🔥 Streak x{myData.streak}
                </div>
             )}
             <div className="rank-badge">Hạng {myRankIndex !== -1 ? myRankIndex + 1 : '—'}</div>
             <p className="text-muted" style={{ marginTop: '2rem', fontSize: '0.9rem' }}>Chờ quản trò bắt đầu câu tiếp theo...</p>
          </div>
        </div>
        <style>{`
          .rank-badge { display: inline-block; padding: 0.5rem 1.5rem; background: var(--surface-light); border-radius: 99px; font-weight: 700; border: 1px solid var(--border); }
        `}</style>
      </>
    );
  }

  // ── ENDED ──
  if (status === 'ended') return (
    <>
      {audioNodes}
      {renderConnectionOverlay()}
      {renderExitConfirm()}
      {headerNode}
      <div className="screen-center" style={{ flex: 1 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏁</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Trò chơi kết thúc!</h2>
          <p className="text-muted">Gamemaster đang hiển thị kết quả...</p>
        </div>
      </div>
    </>
  );

  // ── LEADERBOARD ──
  if (status === 'leaderboard') {
    const myRankIndex = leaderboard.findIndex(p => p.nickname === sessionData?.nickname);
    const myData = myRankIndex !== -1 ? leaderboard[myRankIndex] : null;
    const medals = ['🥇', '🥈', '🥉'];

    return (
      <>
        {audioNodes}
        {renderConnectionOverlay()}
        {renderExitConfirm()}
        {headerNode}
        <div className="screen" style={{ gap: '1.25rem' }}>
          {/* My result */}
          <div className="card" style={{ textAlign: 'center' }}>
            <p className="text-muted" style={{ marginBottom: '0.5rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kết Quả Của Bạn</p>
            <div style={{ fontSize: '4rem', fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>
              {myRankIndex !== -1 ? (medals[myRankIndex] || `#${myRankIndex + 1}`) : '—'}
            </div>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.5rem' }}>
              {myData ? `${myData.score} điểm` : 'Không có dữ liệu'}
            </p>
            {myData && myData.totalTime > 0 && (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Tốc độ: {myData.totalTime}s
              </p>
            )}
          </div>

          {/* Leaderboard */}
          <div>
            <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
              Bảng Xếp Hạng
            </p>
            <div className="leaderboard">
              {leaderboard.slice(0, 10).map((p, i) => (
                <div key={i} className="leaderboard-row" style={{ background: p.nickname === sessionData?.nickname ? 'rgba(99,102,241,0.12)' : undefined, borderColor: p.nickname === sessionData?.nickname ? 'rgba(99,102,241,0.4)' : undefined }}>
                  <span className="leaderboard-rank">{medals[i] || `${i + 1}`}</span>
                  <img src={p.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.nickname}`} alt="" className="leaderboard-avatar" />
                  <span className="leaderboard-name">{p.nickname}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 'auto' }}>
                    <span className="leaderboard-score" style={{ marginLeft: 0 }}>{p.score}đ</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.totalTime || 0}s</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  return null;
}
