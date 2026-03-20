import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Users, Play, Trophy, Clock, CheckCircle2, Check, X } from 'lucide-react';
import Confetti from 'react-confetti';
import { socket } from '../socket';
import bg from '../assets/1.jpg';

import theme1 from "../audio/theme/Calvin Harris - Outside (Lyrics) ft. Ellie Goulding.mp3";
import theme2 from "../audio/theme/Cinematic Rock Racing by Infraction [No Copyright Music] _ Riders.mp3";
import lobbyMusicFile from "../audio/online/Cinematic Rock Racing by Infraction [No Copyright Music] _ Riders.mp3";
import cheerMusicFile from "../audio/cheer/CROWD CHEER SOUND EFFECT.mp3";

export default function AdminDashboard() {
  const { otp } = useParams();
  const bgMusicRef = useRef(null);
  const winMusicRef = useRef(null);
  const lobbyMusicRef = useRef(null);
  const [players, setPlayers] = useState([]);
  const [status, setStatus] = useState('waiting');
  const [countdown, setCountdown] = useState(10);
  const [leaderboard, setLeaderboard] = useState([]);
  const [questionData, setQuestionData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const prevPlayersCountRef = useRef(0);

  useEffect(() => {
    if (status === 'waiting') {
      const onlinePlayers = players.filter(p => p.connected !== false).length;
      if (onlinePlayers > prevPlayersCountRef.current) {
        if (lobbyMusicRef.current) {
          lobbyMusicRef.current.currentTime = 0;
          lobbyMusicRef.current.play().catch(() => { });
        }
      }
      prevPlayersCountRef.current = onlinePlayers;
    }
  }, [players, status]);

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

  // Lock back nav
  useEffect(() => {
    window.history.pushState(null, document.title, window.location.href);
    const h = () => window.history.pushState(null, document.title, window.location.href);
    window.addEventListener('popstate', h);
    return () => window.removeEventListener('popstate', h);
  }, []);

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
        }
      });
    }

    socket.on('player-joined', p => setPlayers(p));
    socket.on('game-starting', count => { setStatus('starting'); setCountdown(count); });
    socket.on('new-question', qData => { setStatus('playing'); setQuestionData(qData); setTimeLeft(qData.time || 60); });
    socket.on('player-answered', p => setPlayers([...p]));
    socket.on('update-scores', p => setPlayers([...p]));
    socket.on('game-ended', () => setStatus('ended'));
    socket.on('show-leaderboard', lb => {
      setLeaderboard(lb);
      setStatus('leaderboard');
    });

    return () => {
      socket.off('player-joined'); socket.off('game-starting'); socket.off('new-question');
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
  const maxPlayers = 50;
  const timerColor = timeLeft > 10 ? 'var(--success)' : timeLeft > 5 ? 'var(--warning)' : 'var(--danger)';
  const timerPct = Math.round((timeLeft / 20) * 100);
  const medals = ['🥇', '🥈', '🥉'];
  const choiceColors = ['var(--choice-a)', 'var(--choice-b)', 'var(--choice-c)', 'var(--choice-d)'];
  const choiceLabels = ['A', 'B', 'C', 'D'];

  const THEMES = [theme1, theme2];
  const seed = otp.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const currentTheme = THEMES[seed % 2];

  const audioNodes = (
    <>
      <div style={{ display: 'none' }}>
        <audio ref={lobbyMusicRef} src={lobbyMusicFile} preload="auto" />
        <audio ref={bgMusicRef} src={currentTheme} loop preload="auto" />
        <audio ref={winMusicRef} src={cheerMusicFile} preload="auto" />
      </div>
      {status === 'leaderboard' && <Confetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={800} gravity={0.15} style={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none', zIndex: 9999 }} />}
    </>
  );

  // ── WAITING ──
  if (status === 'waiting') return (
    <>
      {audioNodes}
      <div className="admin-screen" style={{backgroundImage: `linear-gradient(rgba(10,14,30,0.72), rgba(10,14,30,0.82)), url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat'}}>
        <div className="admin-hero" style={{ alignItems: 'center', textAlign: 'center', padding: '2rem 1.25rem' }}>
          <div className="qr-box" style={{ marginBottom: '1.5rem', padding: '1.5rem', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <QRCodeSVG value={joinUrl} size={220} />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Game Code</p>
            <div className="code-display" style={{ fontSize: '4rem', lineHeight: 1 }}>{otp}</div>
            <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
              Truy cập <strong style={{ color: 'var(--text)' }}>{window.location.host}/join</strong>
            </p>
          </div>

          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={20} style={{ color: 'var(--primary)' }} />
              <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{players.length} / {maxPlayers} tham gia</span>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => socket.emit('start-game', otp)}
              disabled={players.length === 0}
              style={{ width: 'auto', padding: '0.75rem 2rem', borderRadius: '99px' }}
            >
              <Play size={20} /> Bắt Đầu
            </button>
          </div>
        </div>

        {players.length > 0 ? (
          <>
            <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
              Danh sách người chơi
            </p>
            <div className="player-grid">
              {players.map((p, i) => (
                <div key={i} className="player-chip">
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img src={p.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.nickname}`} alt="" />
                    <div style={{
                      position: 'absolute', bottom: -2, right: -2,
                      width: 16, height: 16, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: p.connected === false ? 'var(--danger)' : 'var(--success)',
                      border: '2px solid var(--surface)'
                    }}>
                      {p.connected === false ? <X size={10} color="white" strokeWidth={3} /> : <Check size={10} color="white" strokeWidth={3} />}
                    </div>
                  </div>
                  <span>{p.nickname}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', opacity: 0.4, paddingTop: '1rem' }}>
            <Users size={48} />
            <p style={{ fontWeight: 600 }}>Đang chờ người chơi tham gia...</p>
          </div>
        )}
      </div>
    </>
  );

  // ── STARTING ──
  if (status === 'starting') return (
    <>
      {audioNodes}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Bắt đầu sau</p>
        <div className="countdown-big">{countdown}</div>
      </div>
    </>
  );

  // ── PLAYING ──
  if (status === 'playing') return (
    <>
      {audioNodes}
      <div className="admin-screen">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <p className="question-number" style={{ marginBottom: '0.25rem' }}>Câu {(questionData?.index ?? 0) + 1}</p>
            <p style={{ fontWeight: 700, fontSize: '1.15rem', lineHeight: 1.3 }}>{questionData?.question}</p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '1rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: timerColor, lineHeight: 1 }}>{timeLeft}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>giây</div>
          </div>
        </div>

        {/* Timer bar */}
        <div className="timer-bar-wrapper" style={{ marginBottom: '1rem' }}>
          <div style={{ height: '100%', width: `${timerPct}%`, background: timerColor, borderRadius: 99, transition: 'width 1s linear' }} />
        </div>

        {/* Image */}
        {questionData?.image && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <img src={questionData.image} alt="minh hoạ" style={{ maxHeight: '28vh', borderRadius: 16, objectFit: 'contain', border: '3px solid rgba(255,255,255,0.1)' }} />
          </div>
        )}

        {/* Choices */}
        <div className="choices-display" style={{ marginBottom: '1rem' }}>
          {questionData?.choices?.map((ch, i) => (
            <div key={i} className="choice-display-card">
              <div className="choice-label" style={{ background: choiceColors[i] }}>{choiceLabels[i]}</div>
              <span>{ch}</span>
            </div>
          ))}
        </div>

        {/* Player status */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 16, padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>Người Chơi</p>
            <span className="badge badge-success">
              <CheckCircle2 size={13} />
              {players.filter(p => p.answeredCurrent).length}/{players.length} đã trả lời
            </span>
          </div>
          <div className="player-grid">
            {players.map((p, i) => (
              <div key={i} className={`player-chip ${p.answeredCurrent ? 'answered' : ''}`}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={p.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.nickname}`} alt="" />
                  <div style={{
                    position: 'absolute', bottom: -2, right: -2,
                    width: 16, height: 16, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: p.connected === false ? 'var(--danger)' : 'var(--success)',
                    border: '2px solid var(--surface)'
                  }}>
                    {p.connected === false ? <X size={10} color="white" strokeWidth={3} /> : <Check size={10} color="white" strokeWidth={3} />}
                  </div>
                </div>
                <span>{p.nickname}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  // ── ENDED ──
  if (status === 'ended') return (
    <>
      {audioNodes}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🏁</div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '0.75rem' }}>Hoàn tất!</h2>
          <p className="text-muted" style={{ marginBottom: '2rem', fontSize: '1rem' }}>Tất cả câu hỏi đã kết thúc. Sẵn sàng hiển thị bảng xếp hạng?</p>
          <button className="btn btn-secondary" onClick={() => { socket.emit('show-results', otp); }} style={{ maxWidth: 300, margin: '0 auto' }}>
            <Trophy size={22} /> Xem Kết Quả
          </button>
        </div>
      </div>
    </>
  );

  // ── LEADERBOARD ──
  if (status === 'leaderboard') return (
    <>
      {audioNodes}
      <div className="admin-screen">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <Trophy size={40} style={{ color: '#fbbf24', marginBottom: '0.5rem' }} />
          <h2 style={{ fontSize: '1.8rem', fontWeight: 900 }}>Bảng Xếp Hạng</h2>
        </div>
        <div className="leaderboard">
          {leaderboard.map((p, i) => (
            <div key={i} className="leaderboard-row">
              <span className="leaderboard-rank">{medals[i] || `${i + 1}`}</span>
              <img src={p.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.nickname}`} alt="" className="leaderboard-avatar" />
              <span className="leaderboard-name">{p.nickname}</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 'auto' }}>
                <span className="leaderboard-score" style={{ marginLeft: 0 }}>{p.score} đ</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.totalTime || 0}s</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return null;
}
