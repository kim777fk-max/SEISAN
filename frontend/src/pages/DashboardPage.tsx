import { useEffect, useState } from 'react';

interface MachineData {
  machineCode: string;
  machineName: string;
  status: string;
  runningMinutes: number;
  stoppedMinutes: number;
  stopReasonBreakdown: Record<string, number>;
  shift?: string | null;
  productCode?: string | null;
  process?: string | null;
  latestOperator?: string | null;
}

interface DashboardData {
  date: string;
  machines: MachineData[];
  totals: {
    totalRunningMinutes: number;
    totalStoppedMinutes: number;
    stopReasonBreakdown: Record<string, number>;
  };
}

const REASON_LABELS: Record<string, string> = {
  SETUP: '段取り',
  FAILURE: '故障',
  MATERIAL: '材料待ち',
  QC: '品質検査',
  OTHER: 'その他',
};

function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchDashboard();
  }, [date]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dashboard/today?date=${date}`);
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      const dashboardData = await response.json();
      setData(dashboardData);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>読み込み中...</div>;
  }

  if (error || !data) {
    return <div style={{ padding: '2rem', color: 'red' }}>エラー: {error}</div>;
  }

  const sortedReasons = Object.entries(data.totals.stopReasonBreakdown).sort(
    ([, a], [, b]) => b - a
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '1rem'
      }}>
        <h1 style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>ダッシュボード</h1>
        <div>
          <label style={{ marginRight: '0.5rem' }}>日付:</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ padding: '0.5rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
      </div>

      {/* Totals */}
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '1rem'
      }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>合計</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '1rem', backgroundColor: '#e8f5e9', borderRadius: '4px' }}>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>総稼働時間</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#4CAF50' }}>
              {data.totals.totalRunningMinutes} 分
            </div>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>
              {Math.floor(data.totals.totalRunningMinutes / 60)}時間{data.totals.totalRunningMinutes % 60}分
            </div>
          </div>
          <div style={{ padding: '1rem', backgroundColor: '#fff3e0', borderRadius: '4px' }}>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>総停止時間</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#FF9800' }}>
              {data.totals.totalStoppedMinutes} 分
            </div>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>
              {Math.floor(data.totals.totalStoppedMinutes / 60)}時間{data.totals.totalStoppedMinutes % 60}分
            </div>
          </div>
        </div>
      </div>

      {/* Stop reason ranking */}
      {sortedReasons.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginBottom: '1rem'
        }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>停止理由ランキング</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sortedReasons.map(([reason, minutes], index) => (
              <div
                key={reason}
                style={{
                  padding: '0.8rem',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <span style={{ fontWeight: 'bold', marginRight: '0.5rem' }}>#{index + 1}</span>
                  <span>{REASON_LABELS[reason] || reason}</span>
                </div>
                <div style={{ fontWeight: 'bold', color: '#FF9800' }}>
                  {minutes} 分
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Machine list */}
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>機械別</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: '0.8rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>機械</th>
                <th style={{ padding: '0.8rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>状態</th>
                <th style={{ padding: '0.8rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>作業者</th>
                <th style={{ padding: '0.8rem', textAlign: 'right', borderBottom: '2px solid #ddd' }}>稼働時間</th>
                <th style={{ padding: '0.8rem', textAlign: 'right', borderBottom: '2px solid #ddd' }}>停止時間</th>
              </tr>
            </thead>
            <tbody>
              {data.machines.map((machine) => (
                <tr key={machine.machineCode} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.8rem' }}>
                    <div style={{ fontWeight: 'bold' }}>{machine.machineName}</div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>{machine.machineCode}</div>
                  </td>
                  <td style={{ padding: '0.8rem' }}>
                    <span style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                      backgroundColor:
                        machine.status === 'RUNNING' ? '#e8f5e9' :
                        machine.status === 'STOPPED' ? '#fff3e0' :
                        machine.status === 'ENDED' ? '#f5f5f5' : '#f0f0f0',
                      color:
                        machine.status === 'RUNNING' ? '#4CAF50' :
                        machine.status === 'STOPPED' ? '#FF9800' :
                        machine.status === 'ENDED' ? '#666' : '#999'
                    }}>
                      {machine.status === 'RUNNING' && '稼働中'}
                      {machine.status === 'STOPPED' && '停止中'}
                      {machine.status === 'ENDED' && '終了'}
                      {machine.status === 'NO_SESSION' && '未開始'}
                    </span>
                  </td>
                  <td style={{ padding: '0.8rem' }}>
                    {machine.latestOperator || '-'}
                  </td>
                  <td style={{ padding: '0.8rem', textAlign: 'right', color: '#4CAF50', fontWeight: 'bold' }}>
                    {machine.runningMinutes} 分
                  </td>
                  <td style={{ padding: '0.8rem', textAlign: 'right', color: '#FF9800', fontWeight: 'bold' }}>
                    {machine.stoppedMinutes} 分
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
