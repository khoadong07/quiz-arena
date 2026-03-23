import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import CreateRoom from './components/CreateRoom';
import AdminDashboard from './components/AdminDashboard';
import JoinRoom from './components/JoinRoom';
import PlayerSetup from './components/PlayerSetup';
import PlayerGame from './components/PlayerGame';
import GameConfig from './components/GameConfig';
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin/create" element={<CreateRoom />} />
        <Route path="/admin/room/:otp" element={<AdminDashboard />} />
        <Route path="/join" element={<JoinRoom />} />
        <Route path="/setup" element={<PlayerSetup />} />
        <Route path="/play" element={<PlayerGame />} />
        <Route path="/configuration" element={<GameConfig />} />
      </Routes>
    </Router>
  );
}

export default App;
