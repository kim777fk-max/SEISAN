import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface Machine {
  id: string;
  machineCode: string;
  name: string;
  isActive: boolean;
}

function MachineListPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMachines();
  }, []);

  const fetchMachines = async () => {
    try {
      const response = await fetch('/api/machines');
      if (!response.ok) throw new Error('Failed to fetch machines');
      const data = await response.json();
      setMachines(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>読み込み中...</div>;
  }

  if (error) {
    return <div style={{ padding: '2rem', color: 'red' }}>エラー: {error}</div>;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      <h1 style={{ marginBottom: '1.5rem', fontSize: '1.8rem' }}>機械一覧</h1>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '1rem'
      }}>
        {machines.map((machine) => (
          <Link
            key={machine.id}
            to={`/machine/${machine.machineCode}`}
            style={{
              textDecoration: 'none',
              padding: '1.5rem',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            }}
          >
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#333', marginBottom: '0.5rem' }}>
              {machine.name}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>
              機械コード: {machine.machineCode}
            </div>
          </Link>
        ))}
      </div>

      {machines.length === 0 && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          機械が登録されていません
        </div>
      )}
    </div>
  );
}

export default MachineListPage;
