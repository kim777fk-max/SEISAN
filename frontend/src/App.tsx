import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import MachineListPage from './pages/MachineListPage';
import MachinePage from './pages/MachinePage';
import DashboardPage from './pages/DashboardPage';

function App() {
  return (
    <Router>
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
        <nav style={{
          backgroundColor: '#333',
          color: 'white',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '1rem' }}>
            <Link to="/" style={{ color: 'white', textDecoration: 'none', fontWeight: 'bold' }}>
              機械一覧
            </Link>
            <Link to="/dashboard" style={{ color: 'white', textDecoration: 'none', fontWeight: 'bold' }}>
              ダッシュボード
            </Link>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<MachineListPage />} />
          <Route path="/machine/:machineCode" element={<MachinePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
