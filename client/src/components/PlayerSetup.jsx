import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Camera, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { socket } from '../socket';

export default function PlayerSetup() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('');
  const [joining, setJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [sessionId] = useState(() => {
    let id = localStorage.getItem('khoot_sessionId');
    if (!id) {
       id = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
       localStorage.setItem('khoot_sessionId', id);
    }
    return id;
  });

  const presetAvatars = [
    'https://api.dicebear.com/7.x/bottts/svg?seed=Felix',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Gizmo',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Buster',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Coco',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Loki'
  ];

  useEffect(() => {
    const savedSession = localStorage.getItem('khoot_session');
    if (!state?.otp && savedSession) {
      navigate('/play', { state: JSON.parse(savedSession) });
    } else if (!state?.otp) {
      navigate('/join');
    }
  }, [state, navigate]);

  if (!state?.otp) return null;

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { setErrorMessage('Ảnh quá lớn! Vui lòng chọn ảnh dưới 5MB.'); return; }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 400; // 400x400 max
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
          } else {
            if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG 0.7 quality
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setAvatar(compressedBase64);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (nickname.trim().length < 2) { setErrorMessage('Tên phải có ít nhất 2 ký tự!'); return; }
    setJoining(true);
    socket.connect();
    socket.emit('join-room', { otp: state.otp, nickname, avatar, sessionId }, (res) => {
      setJoining(false);
      if (res.success) {
        const sessionData = { otp: state.otp, nickname, avatar, sessionId };
        localStorage.setItem('khoot_session', JSON.stringify(sessionData));
        navigate('/play', { state: sessionData });
      } else {
        setErrorMessage(res.message);
      }
    });
  };

  const defaultAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${nickname || 'Player'}`;

  const errorModalNode = errorMessage && (
    <div className="modal-overlay" onClick={() => setErrorMessage('')}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <AlertCircle size={40} style={{color: 'var(--danger)', marginBottom: '0.75rem'}} />
        <h3 style={{fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.75rem'}}>Không thể tham gia</h3>
        <p className="text-muted" style={{fontSize: '0.95rem', marginBottom: '1.75rem'}}>
          {errorMessage}
        </p>
        <div className="form-stack">
          <button className="btn btn-primary" onClick={() => setErrorMessage('')}>Đã hiểu</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="screen-center">
      {errorModalNode}
      <div className="card" style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
        <button
          onClick={() => navigate('/join')}
          style={{background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.9rem', padding: 0}}
        >
          <ArrowLeft size={18} /> Quay lại
        </button>

        {/* Avatar */}
        <div style={{textAlign: 'center'}}>
          <div style={{position: 'relative', display: 'inline-block'}}>
            <img src={avatar || defaultAvatar} alt="Avatar" className="avatar-preview" />
            <label
              htmlFor="avatar-upload"
              style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 30, height: 30, borderRadius: '50%',
                background: 'var(--primary)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', border: '2px solid var(--background)'
              }}
            >
              <Camera size={14} color="white" />
            </label>
            <input type="file" accept="image/*" id="avatar-upload" style={{display: 'none'}} onChange={handleAvatarUpload} />
          </div>
          
          {/* Preset Avatars */}
          <div style={{display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.25rem'}}>
            {presetAvatars.map((src, i) => (
              <img 
                 key={i} src={src} 
                 onClick={() => setAvatar(src)}
                 style={{
                   width: 45, height: 45, borderRadius: '50%', objectFit: 'cover',
                   border: avatar === src ? '2px solid var(--primary)' : '2px solid transparent', 
                   cursor: 'pointer', background: 'rgba(255,255,255,0.05)',
                   transition: 'transform 0.1s'
                 }}
                 onMouseOver={(e) => e.target.style.transform = 'scale(1.1)'}
                 onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
              />
            ))}
          </div>
          <p style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem'}}>Chọn Avatar hoặc nhấn vào hình để tải lên</p>
        </div>

        <form onSubmit={handleJoin} className="form-stack">
          <div>
            <label style={{fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.375rem', display: 'block'}}>
              Tên Hiển Thị
            </label>
            <input
              className="input-field"
              placeholder="Nhập tên của bạn..."
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={15}
              required
            />
            <p style={{fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem'}}>2–15 ký tự</p>
          </div>

          <button className="btn btn-primary" type="submit" disabled={joining}>
            <ArrowRight size={20} />
            {joining ? 'Đang vào phòng...' : 'Vào Phòng'}
          </button>
        </form>
      </div>
    </div>
  );
}
