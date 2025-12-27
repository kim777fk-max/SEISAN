import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface MachineStatus {
  machineCode: string;
  machineName: string;
  date: string;
  status: string;
  sessionId?: string;
  lastEvent?: {
    eventType: string;
    eventTime: string;
    reasonCode?: string;
  };
}

const REASON_CODES = [
  { value: 'SETUP', label: '段取り' },
  { value: 'FAILURE', label: '故障' },
  { value: 'MATERIAL', label: '材料待ち' },
  { value: 'QC', label: '品質検査' },
  { value: 'OTHER', label: 'その他' },
];

function MachinePage() {
  const { machineCode } = useParams<{ machineCode: string }>();
  const [status, setStatus] = useState<MachineStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Input fields
  const [reasonCode, setReasonCode] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [memo, setMemo] = useState('');
  const [qty, setQty] = useState('');

  // Aggregation
  const [aggregation, setAggregation] = useState<{
    runningMinutes: number;
    stoppedMinutes: number;
  } | null>(null);

  useEffect(() => {
    if (machineCode) {
      fetchStatus();
      fetchAggregation();
    }
  }, [machineCode, date]);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/machines/${machineCode}/status?date=${date}`);
      if (!response.ok) throw new Error('Failed to fetch status');
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAggregation = async () => {
    try {
      const response = await fetch(`/api/dashboard/today?date=${date}`);
      if (!response.ok) throw new Error('Failed to fetch aggregation');
      const data = await response.json();
      const machineData = data.machines.find((m: any) => m.machineCode === machineCode);
      if (machineData) {
        setAggregation({
          runningMinutes: machineData.runningMinutes,
          stoppedMinutes: machineData.stoppedMinutes,
        });
      }
    } catch (err: any) {
      console.error('Failed to fetch aggregation:', err);
    }
  };

  const handleEvent = async (eventType: string) => {
    try {
      // Validate: STOP requires reason_code
      if (eventType === 'STOP' && !reasonCode) {
        alert('停止理由を選択してください');
        return;
      }

      const payload: any = {
        machine_code: machineCode,
        date,
        event_type: eventType,
      };

      if (eventType === 'STOP') {
        payload.reason_code = reasonCode;
      }

      if (operatorName) payload.operator_name = operatorName;
      if (memo) payload.memo = memo;
      if (qty) payload.qty = parseInt(qty);

      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to create event');
      }

      // Clear inputs
      setMemo('');
      setQty('');

      // Refresh status and aggregation
      await fetchStatus();
      await fetchAggregation();
    } catch (err: any) {
      alert(`エラー: ${err.message}`);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>読み込み中...</div>;
  }

  if (error || !status) {
    return <div style={{ padding: '2rem', color: 'red' }}>エラー: {error}</div>;
  }

  const isRunning = status.status === 'RUNNING';
  const isStopped = status.status === 'STOPPED';
  const isEnded = status.status === 'ENDED';
  const noSession = status.status === 'NO_SESSION';

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '1rem'
      }}>
        <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>{status.machineName}</h1>
        <div style={{ fontSize: '1rem', color: '#666' }}>機械コード: {status.machineCode}</div>
        <div style={{ marginTop: '1rem' }}>
          <label style={{ marginRight: '0.5rem' }}>日付:</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ padding: '0.5rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
      </div>

      {/* Status */}
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '1rem'
      }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>現在の状態</h2>
        <div style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          padding: '1rem',
          borderRadius: '8px',
          textAlign: 'center',
          backgroundColor: isRunning ? '#4CAF50' : isStopped ? '#FF9800' : isEnded ? '#666' : '#ddd',
          color: 'white'
        }}>
          {isRunning && '稼働中'}
          {isStopped && '停止中'}
          {isEnded && '終了'}
          {noSession && '未開始'}
        </div>

        {aggregation && (
          <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ padding: '1rem', backgroundColor: '#e8f5e9', borderRadius: '4px' }}>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>稼働時間</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4CAF50' }}>
                {aggregation.runningMinutes} 分
              </div>
            </div>
            <div style={{ padding: '1rem', backgroundColor: '#fff3e0', borderRadius: '4px' }}>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>停止時間</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#FF9800' }}>
                {aggregation.stoppedMinutes} 分
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input fields */}
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '1rem'
      }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>任意入力</h3>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.3rem' }}>作業者名</label>
          <input
            type="text"
            value={operatorName}
            onChange={(e) => setOperatorName(e.target.value)}
            placeholder="作業者名を入力"
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1rem',
              borderRadius: '4px',
              border: '1px solid #ccc'
            }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.3rem' }}>メモ</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="任意のメモを入力"
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1rem',
              borderRadius: '4px',
              border: '1px solid #ccc',
              minHeight: '60px'
            }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.3rem' }}>数量</label>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="生産数量など"
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1rem',
              borderRadius: '4px',
              border: '1px solid #ccc'
            }}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>操作</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {/* Start/Resume button */}
          {(noSession || isStopped) && (
            <button
              onClick={() => handleEvent(noSession ? 'START_RUN' : 'RESUME')}
              disabled={isEnded}
              style={{
                padding: '1.5rem',
                fontSize: '1.3rem',
                fontWeight: 'bold',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                gridColumn: 'span 2'
              }}
            >
              ▶ {noSession ? '開始' : '再開'}
            </button>
          )}

          {/* Stop button */}
          {isRunning && (
            <>
              <div style={{ gridColumn: 'span 2', marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 'bold', color: '#d32f2f' }}>
                  停止理由（必須）
                </label>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '1rem',
                    borderRadius: '4px',
                    border: reasonCode ? '1px solid #ccc' : '2px solid #d32f2f'
                  }}
                >
                  <option value="">-- 停止理由を選択してください --</option>
                  {REASON_CODES.map((rc) => (
                    <option key={rc.value} value={rc.value}>
                      {rc.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => handleEvent('STOP')}
                style={{
                  padding: '1.5rem',
                  fontSize: '1.3rem',
                  fontWeight: 'bold',
                  backgroundColor: '#FF9800',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  gridColumn: 'span 2'
                }}
              >
                ⏸ 停止
              </button>
            </>
          )}

          {/* End button */}
          {(isRunning || isStopped) && (
            <button
              onClick={() => handleEvent('END')}
              style={{
                padding: '1.5rem',
                fontSize: '1.3rem',
                fontWeight: 'bold',
                backgroundColor: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                gridColumn: 'span 2'
              }}
            >
              ■ 終了
            </button>
          )}
        </div>

        {isEnded && (
          <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f0f0f0', borderRadius: '4px', textAlign: 'center' }}>
            このセッションは終了しました。新しい日付を選択するか、明日のセッションを開始してください。
          </div>
        )}
      </div>
    </div>
  );
}

export default MachinePage;
