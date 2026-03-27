import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Users, Play, Trophy, Clock, CheckCircle2, Check, X, LogOut, TrendingUp, AlertCircle } from 'lucide-react';
import Confetti from 'react-confetti';
import { socket } from '../socket';
import bg from '../assets/1.jpg';
import { imageCache } from '../utils/imageCache';
import { audioCache } from '../utils/audioCache';

// Helper component for counting points
function ScoreCounter({ target, lastEarned }) {
  const [current, setCurrent] = useState(target - lastEarned);
  const [showDelta, setShowDelta] = useState(false);

  useEffect(() => {
    if (lastEarned > 0) {
      setTimeout(() => setShowDelta(true), 500);
      const start = target - lastEarned;
      const duration = 1500;
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
    <div className="points-info-v2">
      <span className="current-points-v2">{current} <small>đ</small></span>
      {showDelta && lastEarned > 0 && <div className="super-delta-badge">+{lastEarned}</div>}
    </div>
  );
}

import theme1 from "../audio/theme/Late Night Talk Show Music _ For content creator.mp3";
import theme2 from "../audio/theme/Cinematic Rock Racing by Infraction [No Copyright Music] _ Riders.mp3";
import lobbyMusicFile from "../audio/online/Cinematic Rock Racing by Infraction [No Copyright Music] _ Riders.mp3";
import cheerMusicFile from "../audio/cheer/CROWD CHEER SOUND EFFECT.mp3";
import countdownMusicFile from "../audio/theme/countdown.mp3";
import calvinHarrisFile from "../audio/theme/Calvin Harris - Outside (Lyrics) ft. Ellie Goulding.mp3";

export default function AdminDashboard() {
  const { otp } = useParams();
  const navigate = useNavigate();
  const bgMusicRef = useRef(null);
  const winMusicRef = useRef(null);
  const lobbyMusicRef = useRef(null);
  const countdownMusicRef = useRef(null);
  const waitingMusicRef = useRef(null);
  const [players, setPlayers] = useState([]);
  const [status, setStatus] = useState('waiting');
  const [countdown, setCountdown] = useState(5);
  const [leaderboard, setLeaderboard] = useState([]);
  const [questionData, setQuestionData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [prevRanks, setPrevRanks] = useState({});
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const prevPlayersCountRef = useRef(0);

  useEffect(() => {
    // Preload ALL music files once otp is available
    if (otp) {
      audioCache.preload([
        theme1, 
        theme2, 
        lobbyMusicFile, 
        cheerMusicFile, 
        countdownMusicFile
      ]);
    }
  }, [otp]);

  useEffect(() => {
    if (status === 'waiting') {
      // Play Calvin Harris on the QR lobby screen
      if (waitingMusicRef.current && waitingMusicRef.current.paused) {
        waitingMusicRef.current.play().catch(err => console.warn('[Audio] Waiting music blocked:', err));
      }
      const onlinePlayers = players.filter(p => p.connected !== false).length;
      if (onlinePlayers > prevPlayersCountRef.current) {
        if (lobbyMusicRef.current) {
          lobbyMusicRef.current.currentTime = 0;
          lobbyMusicRef.current.play().catch(err => console.warn('[Audio] Failed to play join sound:', err));
        }
      }
      prevPlayersCountRef.current = onlinePlayers;
    } else {
      // Stop waiting music when game starts
      if (waitingMusicRef.current) {
        waitingMusicRef.current.pause();
        waitingMusicRef.current.currentTime = 0;
      }
    }
  }, [players, status]);

  useEffect(() => {
    if (bgMusicRef.current) {
      // Background music flows from starting through reading until playing
      if (['starting', 'reading', 'playing'].includes(status)) {
        if (bgMusicRef.current.paused) {
          bgMusicRef.current.currentTime = 0;
          bgMusicRef.current.play().catch(err => console.warn('[Audio] Play blocked by browser:', err));
        }
      } else { 
        bgMusicRef.current.pause(); 
        bgMusicRef.current.currentTime = 0; 
      }
    }
    if (winMusicRef.current) {
      if (status === 'leaderboard') winMusicRef.current.play().catch(() => { });
      else { winMusicRef.current.pause(); winMusicRef.current.currentTime = 0; }
    }
    // Countdown music removed as requested
  }, [status]);

  // Lock back nav
  useEffect(() => {
    window.history.pushState(null, document.title, window.location.href);
    const h = () => window.history.pushState(null, document.title, window.location.href);
    window.addEventListener('popstate', h);
    return () => window.removeEventListener('popstate', h);
  }, []);

  // ── Space → Next question (prevent scroll) ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault(); // chặn scroll trang
        if (status === 'leaderboard-inter') {
          socket.emit('next-question', otp);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, otp]);

  useEffect(() => {
    socket.connect();

    // Attempt to rejoin as Admin and recover state
    const adminToken = localStorage.getItem(`khoot_admin_${otp}`);
    if (adminToken) {
      socket.emit('admin-rejoin', { otp, adminToken }, (res) => {
        if (res.success) {
          const r = res.room;
          setStatus(r.status);
          setPlayers(r.players);
          if (r.timeLeft !== undefined) setTimeLeft(r.timeLeft);
          if (r.questionData) setQuestionData(r.questionData);
          if (r.status === 'leaderboard') setLeaderboard(r.leaderboard);
          if (r.status === 'starting' && r.countdown) setCountdown(r.countdown);
          
          // Preload images if we have questions
          if (res.allImages) {
            imageCache.preload(res.allImages);
          }
        }
      });
    }

    socket.on('player-joined', p => setPlayers(p));
    socket.on('game-starting', count => { setStatus('starting'); setCountdown(count); });
    socket.on('question-reading', qData => {
      setStatus('reading');
      setQuestionData(qData);
      setCountdown(3);
      // Pre-emptively ensure this question's image is cached
      if (qData.image) imageCache.preload([qData.image]);
    });
    socket.on('question-playing', qData => {
      setStatus('playing');
      setQuestionData(prev => ({ ...prev, choices: qData.choices }));
      setTimeLeft(qData.time || 60);
    });
    socket.on('question-result', data => {
      setStatus('result');
      setLeaderboardData(data);
    });
    socket.on('intermediate-leaderboard', lb => {
      setPrevRanks(prev => {
        const newPrev = {};
        lb.forEach((p, i) => {
          // We want to store the rank of each nickname from the *current* state 
          // before it gets updated by the *new* state.
          // But lb IS the new state. 
          // Wait, I should store the ranks of the *existing* leaderboard state.
        });
        return prev;
      });

      setLeaderboard(currentLb => {
        const ranks = {};
        currentLb.forEach((p, i) => { ranks[p.nickname] = i; });
        setPrevRanks(ranks);
        return lb;
      });
      setStatus('leaderboard-inter');
    });
    socket.on('player-answered', p => setPlayers([...p]));
    socket.on('update-scores', p => setPlayers([...p]));
    socket.on('game-ended', () => setStatus('ended'));
    socket.on('show-leaderboard', lb => {
      setLeaderboard(lb);
      setStatus('leaderboard');
    });

    return () => {
      socket.off('player-joined'); socket.off('game-starting'); socket.off('question-reading');
      socket.off('question-playing'); socket.off('question-result'); socket.off('intermediate-leaderboard');
      socket.off('player-answered'); socket.off('update-scores'); socket.off('game-ended'); socket.off('show-leaderboard');
    };
  }, []);

  useEffect(() => {
    let t;
    if (status === 'playing') {
      t = setInterval(() => setTimeLeft(p => p > 0 ? p - 1 : 0), 1000);
    }
    return () => clearInterval(t);
  }, [status, questionData]);

  useEffect(() => {
    // Reset scroll when new question arrives so header is not hidden
    const el = document.querySelector('.admin-screen');
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
  }, [questionData?.index]);

  const joinUrl = `${window.location.protocol}//${window.location.host}/join?otp=${otp}`;
  const maxPlayers = 100;
  const timerColor = timeLeft > 10 ? 'var(--success)' : timeLeft > 5 ? 'var(--warning)' : 'var(--danger)';
  const timerPct = Math.round((timeLeft / 20) * 100);
  const medals = ['🥇', '🥈', '🥉'];
  const choiceColors = ['var(--choice-a)', 'var(--choice-b)', 'var(--choice-c)', 'var(--choice-d)'];
  const choiceLabels = ['A', 'B', 'C', 'D'];

  const currentTheme = theme1; // Cố định: Late Night Talk Show Music

  const audioNodes = (
    <>
      <div style={{ display: 'none' }}>
        <audio ref={waitingMusicRef} src={calvinHarrisFile} loop preload="auto" />
        <audio ref={lobbyMusicRef} src={lobbyMusicFile} preload="auto" />
        <audio ref={bgMusicRef} src={currentTheme} loop preload="auto" />
        <audio ref={winMusicRef} src={cheerMusicFile} preload="auto" />
        <audio ref={countdownMusicRef} src={countdownMusicFile} preload="auto" />
      </div>
      {status === 'leaderboard' && <Confetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={800} gravity={0.15} style={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none', zIndex: 9999 }} />}
    </>
  );

  // ── WAITING ──
  if (status === 'waiting') return (
    <>
      {audioNodes}
      <div style={{
        width: '100vw', height: '100vh', display: 'grid',
        gridTemplateColumns: '400px 1fr',
        backgroundImage: `linear-gradient(rgba(10,14,30,0.75), rgba(10,14,30,0.85)), url(${bg})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        overflow: 'hidden'
      }}>

        {/* ── LEFT COLUMN: QR + Code + Controls ── */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '2rem 1.5rem', borderRight: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(10px)', gap: '1.5rem'
        }}>
          {/* QR Code */}
          <div style={{ background: 'white', borderRadius: '20px', padding: '1rem', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}>
            <QRCodeSVG value={joinUrl} size={200} />
          </div>

          {/* Game Code */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>Game Code</p>
            <div style={{ fontSize: '3.5rem', fontWeight: 900, letterSpacing: '0.15em', color: 'white', lineHeight: 1, textShadow: '0 0 30px rgba(99,102,241,0.5)' }}>{otp}</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.6rem' }}>
              {window.location.host}/join
            </p>
          </div>

          {/* Music indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99,102,241,0.1)', padding: '0.4rem 1rem', borderRadius: '99px', border: '1px solid rgba(99,102,241,0.2)' }}>
            <span style={{ fontSize: '1rem' }}>🎵</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-light)' }}>Calvin Harris – Outside</span>
          </div>

          {/* Player count + Start button */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
              <Users size={18} style={{ color: 'var(--primary)' }} />
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>{players.length} / {maxPlayers} người chơi</span>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => socket.emit('start-game', otp)}
              disabled={players.length === 0}
              style={{ borderRadius: '14px', padding: '0.85rem', fontSize: '1.1rem', fontWeight: 800 }}
            >
              <Play size={20} /> Bắt Đầu
            </button>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Player Grid ── */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '2rem 2.5rem', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '1rem', fontWeight: 800, color: 'white', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Danh sách người chơi</p>
            <span style={{ fontSize: '0.85rem', background: 'rgba(99,102,241,0.15)', color: 'var(--primary-light)', padding: '0.3rem 0.9rem', borderRadius: '99px', fontWeight: 700, border: '1px solid rgba(99,102,241,0.25)' }}>
              {players.length} tham gia
            </span>
          </div>

          {players.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', alignContent: 'start' }}>
              {players.map((p, i) => (
                <div key={i} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '16px', padding: '1rem 0.5rem',
                  transition: 'all 0.3s', animation: 'playerPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both'
                }}>
                  <div style={{ position: 'relative' }}>
                    <img
                      src={p.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.nickname}`}
                      alt=""
                      style={{ width: '56px', height: '56px', borderRadius: '14px', border: `2px solid ${p.connected === false ? 'var(--danger)' : 'var(--success)'}` }}
                    />
                    <div style={{
                      position: 'absolute', bottom: -4, right: -4,
                      width: 18, height: 18, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: p.connected === false ? 'var(--danger)' : 'var(--success)',
                      border: '2px solid #0a0e1e'
                    }}>
                      {p.connected === false ? <X size={10} color="white" strokeWidth={3} /> : <Check size={10} color="white" strokeWidth={3} />}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white', textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 0.25rem' }}>{p.nickname}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', opacity: 0.3 }}>
              <Users size={64} />
              <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>Đang chờ người chơi tham gia...</p>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes playerPop { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes pulse { from { opacity: 0.5; } to { opacity: 1; } }
      `}</style>
    </>
  );

  // ── STARTING ──
  if (status === 'starting') return (
    <>
      {audioNodes}
      <div className="admin-screen" style={{ backgroundImage: `linear-gradient(rgba(10,14,30,0.8), rgba(10,14,30,0.9)), url(${bg})`, backgroundSize: 'cover' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
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
      <div className="admin-screen reading-stage" style={{ backgroundImage: `linear-gradient(rgba(10,14,30,0.4), rgba(10,14,30,0.6)), url(${bg})`, backgroundSize: 'cover' }}>
        <div style={{ textAlign: 'center', maxWidth: '800px', width: '100%' }}>
          <p className="question-index-badge">Câu {(questionData?.index ?? 0) + 1}</p>
          <h1 className="reading-title">{questionData?.question}</h1>
          {questionData?.image && (
            <img src={questionData.image} alt="" className="reading-image" />
          )}
          <div className="reading-preparation">Chuẩn bị sẵn sàng...</div>
        </div>
      </div>
      <style>{`
        .reading-stage { display: flex; align-items: center; justify-content: center; height: 100vh; animation: fadeIn 0.5s ease; }
        .question-index-badge { display: inline-block; padding: 0.5rem 2rem; background: var(--primary); color: white; border-radius: 99px; font-weight: 800; font-size: 1.2rem; margin-bottom: 2rem; }
        .reading-title { font-size: 3.5rem; fontWeight: 900; line-height: 1.2; text-shadow: 0 4px 20px rgba(0,0,0,0.4); margin-bottom: 3rem; }
        .reading-image { max-height: 40vh; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); object-fit: contain; margin-bottom: 2rem; }
        .reading-preparation { font-size: 1.5rem; font-weight: 700; opacity: 0.8; letter-spacing: 0.2rem; text-transform: uppercase; animation: pulse 1s infinite alternate; }
        @keyframes pulse { from { opacity: 0.4; } to { opacity: 0.9; } }
      `}</style>
    </>
  );

  // ── PLAYING ──
  if (status === 'playing') return (
    <>
      {audioNodes}
      <div className="admin-screen playing-stage" style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '1.5rem 3rem', justifyContent: 'space-between', gap: '1rem' }}>
        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '0.5rem 1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
             <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.1rem' }}>Câu hỏi</p>
             <p style={{ fontSize: '1.8rem', fontWeight: 900, color: 'white', lineHeight: 1 }}>{(questionData?.index ?? 0) + 1}</p>
          </div>

          <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.75rem 2rem', borderRadius: '20px', border: '2px solid ' + timerColor, minWidth: '120px' }}>
            <div style={{ fontSize: '2.8rem', fontWeight: 950, color: timerColor, lineHeight: 1 }}>{timeLeft}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>giây còn lại</div>
          </div>

          <div style={{ background: 'rgba(16,185,129,0.1)', padding: '0.5rem 1.5rem', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.3)', textAlign: 'right' }}>
             <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.1rem' }}>Câu trả lời</p>
             <p style={{ fontSize: '1.8rem', fontWeight: 900, color: 'white', lineHeight: 1 }}>{players.filter(p => p.answeredCurrent).length} / {players.length}</p>
          </div>
        </div>

        {/* Main Game Layout: 2 Columns */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: '4rem', flex: 1, minHeight: 0, padding: '1rem 0' }}>
          
          {/* Left Column: Image Section */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
            {questionData?.image ? (
              <img src={questionData.image} alt="minh hoạ" style={{ maxHeight: '60vh', maxWidth: '95%', borderRadius: '16px', objectFit: 'contain', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} />
            ) : (
               <div style={{ opacity: 0.1 }}><Users size={160} /></div>
            )}
          </div>

          {/* Right Column: Question + Choices */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '2.5rem', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
              <h1 style={{ fontWeight: 850, fontSize: '2.4rem', lineHeight: 1.3, color: 'white', margin: '0' }}>
                {questionData?.question}
              </h1>
              <div className="timer-bar-wrapper" style={{ height: '8px', width: '100%', background: 'rgba(255,255,255,0.05)', marginTop: '2rem' }}>
                <div style={{ height: '100%', width: `${timerPct}%`, background: timerColor, borderRadius: 99, transition: 'width 1s linear' }} />
              </div>
            </div>

            <div className="choices-display" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem', width: '100%', margin: '0' }}>
              {questionData?.choices?.map((ch, i) => (
                <div key={i} className="choice-display-card" style={{ padding: '1.25rem 1.75rem', fontSize: '1.6rem', borderRadius: '20px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', transition: '0.3s' }}>
                  <div className="choice-label notranslate" translate="no" style={{ background: choiceColors[i], width: '50px', height: '50px', fontSize: '1.6rem', borderRadius: '14px', fontWeight: 900 }}>{choiceLabels[i]}</div>
                  <span style={{ fontWeight: 700, color: 'white' }}>{ch}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );

  // ── RESULT ──
  if (status === 'result') return (
    <>
      {audioNodes}
      <div className="admin-screen result-stage" style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '2rem 4rem', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ flex: 1 }}>
            <p className="question-number" style={{ marginBottom: '0.4rem', fontSize: '1rem', background: 'rgba(255,255,255,0.1)', display: 'inline-block', padding: '0.3rem 1rem', borderRadius: '99px' }}>Kết Quả Câu {(questionData?.index ?? 0) + 1}</p>
            <h1 style={{ fontWeight: 800, fontSize: '1.5rem', lineHeight: 1.4, color: 'white', background: 'rgba(255,255,255,0.03)', padding: '1rem 1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>{questionData?.question}</h1>
          </div>
          <div className="badge badge-success" style={{ fontSize: '1rem', padding: '0.75rem 1.5rem', borderRadius: '14px', fontWeight: 800, marginLeft: '2rem' }}>
             CÂU HỎI HOÀN TẤT
          </div>
        </div>

        <div className="choices-display" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', width: '100%', margin: '0' }}>
          {questionData?.choices?.map((ch, i) => {
            const isCorrect = i === leaderboardData?.correctAnswer;
            return (
              <div
                key={i}
                className={`choice-display-card result-choice ${isCorrect ? 'correct-highlight' : 'wrong-fade'}`}
                style={{ height: 'auto', padding: '2rem', borderRadius: '28px', border: isCorrect ? '4px solid var(--success)' : '2px solid rgba(255,255,255,0.05)' }}
              >
                <div className="choice-label notranslate" translate="no" style={{ background: isCorrect ? 'var(--success)' : choiceColors[i], width: '50px', height: '50px', borderRadius: '12px', fontSize: '1.5rem' }}>
                  {isCorrect ? <Check size={30} strokeWidth={4} /> : choiceLabels[i]}
                </div>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>{ch}</span>
              </div>
            );
          })}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(25px)', border: '1px solid var(--border)', borderRadius: '32px', padding: '2rem', marginTop: '1.5rem', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <p style={{ fontWeight: 950, fontSize: '1.4rem', color: 'var(--primary-light)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Thống kê người chơi</p>
            <div style={{ display: 'flex', gap: '1rem' }}>
               <div style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)', padding: '0.4rem 1rem', borderRadius: '10px', fontWeight: 800, fontSize: '1rem', border: '1px solid rgba(16,185,129,0.3)' }}>✅ {leaderboardData?.players?.filter(p => p.isCorrect).length} Đúng</div>
               <div style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', padding: '0.4rem 1rem', borderRadius: '10px', fontWeight: 800, fontSize: '1rem', border: '1px solid rgba(239,68,68,0.3)' }}>❌ {leaderboardData?.players?.filter(p => !p.isCorrect).length} Sai</div>
            </div>
          </div>
          
          <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem', marginTop: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '2rem 1rem', justifyItems: 'center' }}>
              {leaderboardData?.players?.map((p, i) => {
                // Truncate to 8 chars
                const displayName = p.nickname.length > 8 ? p.nickname.substring(0, 8) + '...' : p.nickname;
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100px' }}>
                    <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                      <img 
                        src={p.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.nickname}`} 
                        alt="" 
                        style={{ 
                          width: '72px', height: '72px', borderRadius: '20px', 
                          border: p.isCorrect ? '4px solid var(--success)' : '2px solid rgba(255,255,255,0.08)',
                          boxShadow: p.isCorrect ? '0 0 20px rgba(16,185,129,0.5)' : 'none',
                          filter: p.isCorrect ? 'none' : 'grayscale(0.5) contrast(0.8)',
                          opacity: p.isCorrect ? 1 : 0.5,
                          transition: '0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                        }} 
                      />
                      {p.isCorrect && (
                         <div style={{ position: 'absolute', top: '-6px', right: '-6px', width: '26px', height: '26px', borderRadius: '50%', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', border: '2px solid #1e293b', boxShadow: '0 4px 10px rgba(0,0,0,0.4)' }}>
                            <Check size={16} strokeWidth={4} />
                         </div>
                      )}
                    </div>
                    <span style={{ 
                      fontWeight: 800, fontSize: '0.85rem', color: p.isCorrect ? '#fff' : 'rgba(255,255,255,0.4)', 
                      textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      textShadow: p.isCorrect ? '0 0 10px rgba(16,185,129,0.3)' : 'none'
                    }}>
                      {displayName}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <style>{`
         .correct-highlight { border: 4px solid var(--success) !important; background: rgba(16,185,129,0.1) !important; transform: scale(1.02); z-index: 10; boxShadow: 0 0 30px rgba(16,185,129,0.3); }
         .wrong-fade { opacity: 0.4; }
         .player-chip.correct { border: 2px solid var(--success-light); background: rgba(16,185,129,0.1); }
         .player-chip.incorrect { border: 2px solid var(--danger); background: rgba(239,68,68,0.1); }
         .status-dot { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-left: 0.5rem; }
         .correct .status-dot { background: var(--success); color: white; }
         .incorrect .status-dot { background: var(--danger); color: white; }
      `}</style>
    </>
  );

  // ── INTERMEDIATE LEADERBOARD ──
  if (status === 'leaderboard-inter') return (
    <>
      {audioNodes}
      <div className="admin-screen fullscreen-leaderboard" style={{ backgroundImage: `linear-gradient(rgba(10,14,30,0.85), rgba(10,14,30,0.95)), url(${bg})`, backgroundSize: 'cover' }}>
        <div className="leaderboard-container">
          <div className="leaderboard-header">
            <Trophy size={48} className="trophy-icon" />
            <h1 className="leaderboard-title">BẢNG XẾP HẠNG TẠM THỜI</h1>
          </div>

          <div className="leaderboard-table-wrapper" style={{ height: `${Math.min(leaderboard.length * 80, 600)}px` }}>
            <div className="leaderboard-table">
              {leaderboard.slice(0, 10).map((p, i) => {
                const prevRank = prevRanks[p.nickname];
                const rankChanged = prevRank !== undefined && prevRank !== i;
                const movedUp = prevRank !== undefined && i < prevRank;
                const movedDown = prevRank !== undefined && i > prevRank;

                const playerStatus = players.find(player => player.nickname === p.nickname);
                const isConnected = playerStatus ? playerStatus.connected !== false : true;

                return (
                  <div
                    key={p.nickname}
                    className={`leaderboard-row-new ${movedUp ? 'glow-up' : ''} ${!isConnected ? 'player-offline-row' : ''}`}
                    style={{
                      transform: `translateY(${i * 80}px)`,
                      zIndex: 10 - i,
                      transition: 'transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s, box-shadow 0.3s',
                      opacity: isConnected ? 1 : 0.6
                    }}
                  >
                    <div className="rank-col" style={{ position: 'relative' }}>
                      <span className={`rank-circle rank-${i + 1}`}>{i + 1}</span>
                      {movedUp && <div className="rank-indicator up">▲</div>}
                      {movedDown && <div className="rank-indicator down">▼</div>}
                      {!isConnected && (
                         <div style={{ position: 'absolute', top: -5, right: -5, background: 'var(--danger)', width: 12, height: 12, borderRadius: '50%', border: '2px solid white', animation: 'pulsate 1s infinite' }} title="Mất kết nối" />
                      )}
                    </div>
                    <div className="avatar-col">
                      <img src={p.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.nickname}`} alt="" className="player-avatar-lg" />
                    </div>
                    <div className="name-col">
                      <span className="player-nickname">{p.nickname}</span>
                      {p.streak >= 2 && <span className="admin-streak-badge">🔥 x{p.streak}</span>}
                    </div>
                    <div className="score-col">
                      <div className="score-details-row">
                        <div className="points-container">
                          <ScoreCounter target={p.score} lastEarned={p.lastEarned} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="admin-footer-controls" style={{ flexDirection: 'column', gap: '1rem' }}>
            {players.filter(p => !p.connected).length > 0 && (
              <div style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 800, fontSize: '0.92rem', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', gap: '0.75rem', animation: 'fadeIn 0.4s' }}>
                <AlertCircle size={20} />
                <span>Có {players.filter(p => !p.connected).length} người chơi mất kết nối. Game Master có thể đợi hoặc nhấn TIẾP TỤC.</span>
              </div>
            )}
            <button className="btn btn-primary next-btn-large" onClick={() => socket.emit('next-question', otp)}>
              TIẾP TỤC <Play size={24} fill="currentColor" />
              <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(255,255,255,0.2)', padding: '0.2rem 0.6rem', borderRadius: '6px', letterSpacing: '0.05em' }}>SPACE</span>
            </button>
          </div>
        </div>
      </div>
      <style>{`
        .fullscreen-leaderboard { height: 100vh; width: 100vw; overflow: hidden; display: flex; align-items: center; justify-content: center; padding: 2rem; }
        .leaderboard-container { width: 100%; max-width: 1000px; animation: slideUp 0.6s cubic-bezier(0.23, 1, 0.32, 1); }
        .leaderboard-header { text-align: center; margin-bottom: 3rem; }
        .player-offline-row { background: rgba(239,68,68,0.1) !important; border-color: rgba(239,68,68,0.2) !important; }
        @keyframes pulsate { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
        .trophy-icon { color: #fbbf24; filter: drop-shadow(0 0 20px rgba(251,191,36,0.5)); margin-bottom: 1rem; }
        .leaderboard-title { font-size: 3rem; font-weight: 900; color: white; letter-spacing: 0.1rem; text-shadow: 0 4px 10px rgba(0,0,0,0.5); }
        
        .leaderboard-table-wrapper { position: relative; width: 100%; }
        .leaderboard-table { width: 100%; height: 100%; }
        
        .leaderboard-row-new { 
          position: absolute; top: 0; left: 0; right: 0; height: 70px;
          display: flex; align-items: center; 
          background: rgba(255,255,255,0.06); backdrop-filter: blur(12px); 
          padding: 0 2rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);
          transition: transform 1s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        
        .rank-col { width: 60px; }
        .rank-circle { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: 900; font-size: 1.2rem; background: rgba(255,255,255,0.1); }
        .rank-1 { background: #fbbf24; color: #000; box-shadow: 0 0 20px rgba(251,191,36,0.4); }
        .rank-2 { background: #cbd5e1; color: #000; }
        .rank-3 { background: #b45309; color: #fff; }
        
        .avatar-col { margin: 0 1.5rem; }
        .player-avatar-lg { width: 50px; height: 50px; border-radius: 12px; border: 2px solid rgba(255,255,255,0.2); }
        
        .name-col { flex: 1; }
        .player-nickname { font-size: 1.6rem; font-weight: 700; color: white; }
        .admin-streak-badge { background: #fbbf24; color: #000; font-size: 0.8rem; font-weight: 900; padding: 0.1rem 0.5rem; border-radius: 4px; margin-left: 0.75rem; vertical-align: middle; }
        
        .score-col { text-align: right; min-width: 140px; }
        .points-info-v2 { position: relative; display: flex; flex-direction: column; align-items: flex-end; }
        .current-points-v2 { font-size: 2.5rem; font-weight: 950; color: #818cf8; font-variant-numeric: tabular-nums; line-height: 1; text-shadow: 0 0 20px rgba(129,140,248,0.3); }
        .current-points-v2 small { font-size: 1.2rem; opacity: 0.7; }
        
        .super-delta-badge { 
          position: absolute; right: 0; bottom: 40px;
          background: #10b981; color: white;
          padding: 0.5rem 1.2rem; border-radius: 14px;
          font-size: 1.5rem; font-weight: 900;
          box-shadow: 0 10px 25px rgba(16,185,129,0.5);
          animation: flyUpAndFade 2.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          z-index: 100;
        }
        
        @keyframes flyUpAndFade { 
          0% { transform: translateY(20px) scale(0.5); opacity: 0; }
          10% { transform: translateY(0) scale(1.2); opacity: 1; }
          20% { transform: translateY(0) scale(1); opacity: 1; }
          80% { transform: translateY(-20px) scale(1); opacity: 1; }
          100% { transform: translateY(-50px) scale(0.8); opacity: 0; }
        }
        
        .admin-footer-controls { margin-top: 4rem; display: flex; justify-content: center; }
        .next-btn-large { padding: 1.2rem 4rem; font-size: 1.4rem; font-weight: 800; border-radius: 60px; box-shadow: 0 15px 35px rgba(99,102,241,0.4); }
        
        @keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes bounceIn { 0% { opacity: 0; transform: scale(.3); } 50% { opacity: 1; transform: scale(1.05); } 100% { transform: scale(1); } }
      `}</style>
    </>
  );

  // ── ENDED ──
  if (status === 'ended') return (
    <>
      {audioNodes}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🏁</div>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.75rem' }}>Hoàn tất!</h2>
          <p className="text-muted" style={{ marginBottom: '2rem', fontSize: '1.1rem' }}>Tất cả câu hỏi đã kết thúc. Sẵn sàng xem vinh danh?</p>
          <button className="btn btn-primary" onClick={() => { socket.emit('show-results', otp); }} style={{ padding: '1rem 3rem' }}>
            <Trophy size={22} style={{ marginRight: '0.5rem' }} /> XEM KẾT QUẢ CUỐI CÙNG
          </button>
        </div>
      </div>
    </>
  );

  // ── FINAL LEADERBOARD ──
  if (status === 'leaderboard') return (
    <>
      {audioNodes}
      {windowSize.width > 0 && <Confetti width={windowSize.width} height={windowSize.height} recycle={true} numberOfPieces={200} />}
      <div className="admin-screen fullscreen-leaderboard final-stage" style={{ backgroundImage: `linear-gradient(rgba(10,14,30,0.8), rgba(10,14,30,0.9)), url(${bg})`, backgroundSize: 'cover' }}>
        <div className="final-layout">
          {/* Left Column: Podium */}
          <div className="final-podium-side">
            <div className="leaderboard-header-final">
              <div className="congrats-text">CHÚC MỪNG CHIẾN THẮNG!</div>
              <h1 className="leaderboard-title-final">VINH DANH QUÁN QUÂN</h1>
            </div>

            <div className="podium-section">
              {leaderboard.length >= 2 && (
                <div className="podium-spot rank-2-spot">
                  <img src={leaderboard[1].avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${leaderboard[1].nickname}`} alt="" className="podium-avatar" />
                  <div className="podium-name">{leaderboard[1].nickname}</div>
                  <div className="podium-base rank-2-base">
                    <span className="base-rank">2</span>
                    <div className="base-score">{leaderboard[1].score} đ</div>
                  </div>
                </div>
              )}
              {leaderboard.length >= 1 && (
                <div className="podium-spot rank-1-spot">
                  <Trophy className="winner-crown" size={48} />
                  <img src={leaderboard[0].avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${leaderboard[0].nickname}`} alt="" className="podium-avatar winner-avatar" />
                  <div className="podium-name winner-name">{leaderboard[0].nickname}</div>
                  <div className="podium-base rank-1-base">
                    <span className="base-rank">1</span>
                    <div className="base-score">{leaderboard[0].score} đ</div>
                  </div>
                </div>
              )}
              {leaderboard.length >= 3 && (
                <div className="podium-spot rank-3-spot">
                  <img src={leaderboard[2].avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${leaderboard[2].nickname}`} alt="" className="podium-avatar" />
                  <div className="podium-name">{leaderboard[2].nickname}</div>
                  <div className="podium-base rank-3-base">
                    <span className="base-rank">3</span>
                    <div className="base-score">{leaderboard[2].score} đ</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Full List */}
          <div className="final-list-side">
            <div className="full-list-card">
              <div className="full-list-header">
                <TrendingUp size={24} style={{ marginRight: '0.75rem', color: '#fbbf24' }} /> BẢNG THỨ HẠNG TỔNG
              </div>
              <div className="full-list-scrollable">
                {leaderboard.map((p, i) => (
                  <div key={p.nickname} className={`full-rank-row ${i < 3 ? 'best-rank' : ''}`}>
                    <span className="full-rank-num">{i + 1}</span>
                    <img src={p.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.nickname}`} alt="" className="full-rank-avatar" />
                    <span className="full-rank-name">{p.nickname}</span>
                    <span className="full-rank-score">{p.score} <small>đ</small></span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button onClick={() => navigate('/')} className="top-right-exit" title="Thoát">
            <X size={32} />
          </button>
        </div>
      </div>
      <style>{`
        .final-stage { animation: fadeIn 1.2s ease; width: 100vw; height: 100vh; overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .final-layout { width: 95%; max-width: 1400px; display: grid; grid-template-columns: 1fr 450px; gap: 4rem; height: 85vh; align-items: center; position: relative; }
        
        .leaderboard-header-final { text-align: center; margin-bottom: 3rem; }
        .congrats-text { font-size: 1.2rem; font-weight: 800; color: #fbbf24; letter-spacing: 0.4rem; margin-bottom: 0.5rem; }
        .leaderboard-title-final { font-size: 3rem; font-weight: 950; color: white; text-shadow: 0 0 30px rgba(129,140,248,0.3); }

        .final-podium-side { display: flex; flex-direction: column; align-items: center; }
        
        .final-list-side { height: 100%; display: flex; flex-direction: column; overflow: hidden; }
        .full-list-card { background: rgba(255,255,255,0.06); backdrop-filter: blur(30px); border: 1px solid rgba(255,255,255,0.1); border-radius: 32px; display: flex; flex-direction: column; height: 100%; box-shadow: 0 25px 60px rgba(0,0,0,0.4); }
        .full-list-header { padding: 2rem; font-weight: 900; font-size: 1.3rem; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; color: white; letter-spacing: 0.1rem; }
        .full-list-scrollable { flex: 1; overflow-y: auto; padding: 1.5rem; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.2) transparent; }
        
        .full-rank-row { display: flex; align-items: center; padding: 1rem 1.25rem; border-radius: 16px; margin-bottom: 0.75rem; background: rgba(255,255,255,0.03); border: 1px solid transparent; transition: 0.2s; }
        .full-rank-row.best-rank { background: rgba(251,191,36,0.08); border-color: rgba(251,191,36,0.15); }
        .full-rank-num { width: 40px; font-weight: 900; color: rgba(255,255,255,0.3); font-size: 1.2rem; }
        .best-rank .full-rank-num { color: #fbbf24; }
        .full-rank-avatar { width: 36px; height: 36px; border-radius: 10px; margin: 0 1.25rem; border: 1px solid rgba(255,255,255,0.1); }
        .full-rank-name { flex: 1; font-weight: 700; font-size: 1.1rem; color: white; }
        .full-rank-score { font-weight: 900; font-size: 1.2rem; color: #818cf8; }
        
        .top-right-exit { position: fixed; top: 2rem; right: 2rem; background: rgba(0,0,0,0.2); border: none; color: white; cursor: pointer; padding: 0.5rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.3s, transform 0.2s; z-index: 1000; }
        .top-right-exit:hover { background: rgba(239, 68, 68, 0.4); transform: scale(1.1); }

        .podium-section { display: flex; align-items: flex-end; justify-content: center; gap: 1.5rem; margin-top: 1rem; }
        .podium-spot { display: flex; flex-direction: column; align-items: center; width: 180px; transition: all 0.5s ease; animation: slideUpPodium 1s cubic-bezier(0.23, 1, 0.32, 1) both; }
        .podium-avatar { width: 85px; height: 85px; border-radius: 50%; border: 4px solid rgba(255,255,255,0.1); margin-bottom: 1.25rem; box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
        .podium-name { font-size: 1.2rem; font-weight: 800; color: white; margin-bottom: 0.75rem; text-align: center; }
        
        .podium-base { width: 100%; border-radius: 20px 20px 8px 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 15px 35px rgba(0,0,0,0.3); }
        .rank-2-base { height: 130px; background: linear-gradient(135deg, #cbd5e1, #64748b); animation-delay: 0.2s; }
        .rank-1-base { height: 200px; background: linear-gradient(135deg, #fbbf24, #d97706); animation-delay: 0.5s; }
        .rank-3-base { height: 90px; background: linear-gradient(135deg, #b45309, #78350f); animation-delay: 0.8s; }
        
        .rank-1-spot { transform: scale(1.2); z-index: 10; margin-bottom: 30px; }
        .winner-crown { color: #fbbf24; filter: drop-shadow(0 0 15px rgba(251,191,36,0.6)); margin-bottom: -15px; z-index: 11; }
        .winner-avatar { border-color: #fbbf24; box-shadow: 0 0 40px rgba(251,191,36,0.3); width: 100px; height: 100px; }
        
        .base-rank { font-size: 3.5rem; font-weight: 950; color: rgba(255,255,255,0.3); line-height: 1; }
        .base-score { font-size: 1.1rem; font-weight: 900; color: white; background: rgba(0,0,0,0.3); padding: 0.3rem 1.1rem; border-radius: 99px; margin-top: 0.5rem; }

        @keyframes slideUpPodium { from { transform: translateY(100px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </>
  );

  return null;
}
