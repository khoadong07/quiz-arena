import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogOut, CheckCircle, Clock, Loader2 } from 'lucide-react';
import Confetti from 'react-confetti';
import { socket } from '../socket';
import bg from '../assets/19.jpg';

import theme1 from "../audio/theme/Calvin Harris - Outside (Lyrics) ft. Ellie Goulding.mp3";
import theme2 from "../audio/theme/Cinematic Rock Racing by Infraction [No Copyright Music] _ Riders.mp3";
import cheerMusicFile from "../audio/cheer/CROWD CHEER SOUND EFFECT.mp3";

export default function PlayerGame() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const [sessionData, setSessionData] = useState(state);
  const [status, setStatus] = useState('waiting');
  const [countdown, setCountdown] = useState(10);
  const [questionData, setQuestionData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  const bgMusicRef = useRef(null);
  const winMusicRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (bgMusicRef.current) {
      if (['starting', 'playing', 'time-up'].includes(status)) bgMusicRef.current.play().catch(() => { });
      else { bgMusicRef.current.pause(); bgMusicRef.current.currentTime = 0; }
    }
    if (winMusicRef.current) {
      if (status === 'leaderboard') winMusicRef.current.play().catch(() => { });
      else { winMusicRef.current.pause(); winMusicRef.current.currentTime = 0; }
    }
  }, [status]);

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

    socket.connect();
    socket.emit('join-room', currentSession, (res) => {
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
        if (res.resumeState.answeredCurrent) setSelectedAnswer(-1);
      }
    });

    const timerInterval = setInterval(() => setTimeLeft(p => p > 0 ? p - 1 : 0), 1000);

    socket.on('game-starting', count => { setStatus('starting'); setCountdown(count); });
    socket.on('new-question', qData => { setStatus('playing'); setQuestionData(qData); setTimeLeft(qData.time); setSelectedAnswer(null); });
    socket.on('time-up', () => setStatus('time-up'));
    socket.on('game-ended', () => setStatus('ended'));
    socket.on('show-leaderboard', lb => { setStatus('leaderboard'); setLeaderboard(lb); });
    socket.on('room-closed', () => { localStorage.removeItem('khoot_session'); navigate('/'); });

    return () => {
      clearInterval(timerInterval);
      socket.off('game-starting'); socket.off('new-question'); socket.off('time-up');
      socket.off('game-ended'); socket.off('show-leaderboard'); socket.off('room-closed');
    };
  }, [navigate]);

  const handleAnswer = (index) => {
    if (selectedAnswer !== null || timeLeft <= 0 || status !== 'playing') return;
    setSelectedAnswer(index);
    socket.emit('submit-answer', { otp: sessionData.otp, answerIndex: index });
  };

  const handleLeave = () => {
    if (['playing', 'starting', 'waiting'].includes(status)) { setShowExitConfirm(true); }
    else { confirmLeave(); }
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
      </div>
      {status === 'leaderboard' && leaderboard.length > 0 && leaderboard[0].nickname === sessionData?.nickname && (
        <Confetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={800} gravity={0.15} style={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none', zIndex: 9999 }} />
      )}
    </>
  );

  // === ExitConfirm Modal (Bottom Sheet) ===
  const exitModalNode = (
    <div className="modal-overlay" onClick={() => setShowExitConfirm(false)}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <LogOut size={36} style={{ color: 'var(--danger)', marginBottom: '0.75rem' }} />
        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem' }}>Thoát khỏi game?</h3>
        <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.75rem' }}>
          Điểm số sẽ không được tính nếu bạn rời phòng.
        </p>
        <div className="form-stack">
          <button className="btn btn-danger" onClick={confirmLeave}>Thoát</button>
          <button className="btn btn-ghost" onClick={() => setShowExitConfirm(false)}>Ở lại</button>
        </div>
      </div>
    </div>
  );

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
      {showExitConfirm && exitModalNode}
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
      {showExitConfirm && exitModalNode}
      {headerNode}
      <div className="screen-center" style={{ flex: 1, backgroundImage: `linear-gradient(rgba(10,14,30,0.70), rgba(10,14,30,0.80)), url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Bắt đầu sau</p>
          <div className="countdown-big">{countdown}</div>
        </div>
      </div>
    </>
  );

  // ── PLAYING ──
  if (status === 'playing' || status === 'time-up') return (
    <>
      {audioNodes}
      {showExitConfirm && exitModalNode}
      {headerNode}
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', flex: 1, backgroundImage: `linear-gradient(rgba(10,14,30,0.70), rgba(10,14,30,0.80)), url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        {/* Timer + question number row */}
        <div className="game-header" style={{ marginTop: '0.5rem' }}>
          <span className="question-number">Câu {(questionData?.index ?? 0) + 1}</span>
          <span className="timer-display" style={{ color: timerColor }}>{timeLeft}s</span>
        </div>

        {/* Timer bar */}
        <div className="timer-bar-wrapper">
          <div style={{
            height: '100%',
            width: `${timerPct}%`,
            background: `linear-gradient(90deg, ${timerColor}, ${timerColor})`,
            borderRadius: 99,
            transition: 'width 1s linear, background 1s'
          }} />
        </div>

        {/* Answered state */}
        {selectedAnswer !== null ? (
          <div className="answered-view" style={{ flex: 1 }}>
            <CheckCircle size={72} style={{ color: 'var(--success)' }} />
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Đã chọn!</h3>
            <p className="text-muted">Đang chờ câu tiếp theo...</p>
          </div>
        ) : (
          <div className="choices-grid" style={{ marginTop: '1rem', flex: 1 }}>
            <button className="choice-btn choice-a" onClick={() => handleAnswer(0)}>A</button>
            <button className="choice-btn choice-b" onClick={() => handleAnswer(1)}>B</button>
            <button className="choice-btn choice-c" onClick={() => handleAnswer(2)}>C</button>
            <button className="choice-btn choice-d" onClick={() => handleAnswer(3)}>D</button>
          </div>
        )}
      </div>
    </>
  );

  // ── ENDED ──
  if (status === 'ended') return (
    <>
      {audioNodes}
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
