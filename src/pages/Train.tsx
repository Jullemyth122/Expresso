import { useEffect, useRef, useState } from 'react';
import { api, MIN_TO_TRAIN, type Job, type Report } from '../api';
import Icon from '../components/Icon';

const pct = (value: number | null | undefined) => value == null ? '–' : `${Math.round(value * 100)}%`;

export default function Train() {
  const [job, setJob] = useState<Job & { report: Report | null }>({ running: false, code: null, log: '', report: null });
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const logRef = useRef<HTMLPreElement>(null);

  const poll = () => api<Job & { report: Report | null }>('/api/train').then(setJob).catch(failure => setError(failure.message));
  useEffect(() => {
    void poll(); void api<Record<string, number>>('/api/samples').then(setCounts).catch(failure => setError(failure.message));
  }, []);
  useEffect(() => {
    if (!job.running) return;
    const timer = setInterval(() => void poll(), 1000);
    return () => clearInterval(timer);
  }, [job.running]);
  useEffect(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight); }, [job.log]);

  async function start() {
    setError('');
    try { setJob({ ...(await api<Job>('/api/train', {})), report: job.report }); } catch (failure) { setError((failure as Error).message); }
  }

  const ready = Object.entries(counts).filter(([, n]) => n >= MIN_TO_TRAIN);
  const thin = Object.entries(counts).filter(([, n]) => n > 0 && n < MIN_TO_TRAIN);
  const report = job.report;
  const progress = [...job.log.matchAll(/epoch\s+(\d+)\s*\/\s*(\d+)/gi)].at(-1);
  return (
    <div className="page">
      <section className="card">
        <div className="card-title"><span className="stat-icon"><Icon name="train" size={23} /></span><div><h2>A model that learns you</h2><p>Your gestures. Your own understanding.</p></div></div>
        <p className="muted">Transform your recordings into a personal sign model. Training happens on this computer and usually takes about a minute for a dozen signs. Every fifth recording is set aside to check how well it learns.</p>
        <div className="facts">
          <span><b>{ready.length}</b> signs ready ({MIN_TO_TRAIN}+ recordings)</span>
          <span><b>{Object.values(counts).reduce((a, b) => a + b, 0)}</b> recordings</span>
          <span className={`background-status ${counts._none >= MIN_TO_TRAIN ? 'good' : 'warn'}`}><b>{counts._none >= MIN_TO_TRAIN ? 'Background movements ready' : 'Add background movements'}</b>{counts._none >= MIN_TO_TRAIN ? 'Your model can learn what to ignore.' : 'Record random movements so they are not mistaken for commands.'}</span>
        </div>
        {thin.length > 0 && <p className="warn small">Skipped (fewer than {MIN_TO_TRAIN}): {thin.map(([sign, n]) => `${sign} (${n})`).join(', ')}</p>}
        <div className="controls">
          <button className="primary big" disabled={job.running || ready.length < 2} onClick={() => void start()}>
            <Icon name="train" size={17} />{job.running ? `Training… ${progress ? `epoch ${progress[1]}/${progress[2]}` : ''}` : 'Train my model'}
          </button>
          {ready.length < 2 && <a className="small" href="#record">Record at least two signs to get started →</a>}
          {!job.running && job.code === 0 && <a href="#test">Model ready. Test your signs →</a>}
          {!job.running && job.code != null && job.code !== 0 && <span className="error">Training failed (exit {job.code}). See the log below.</span>}
        </div>
        {progress && job.running && <div className="bar wide"><i style={{ width: `${(+progress[1] / +progress[2]) * 100}%` }} /></div>}
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {report && (
        <section className="card">
          <div className="report-head">
            <h3>Last model</h3>
            <span className="big-number">{pct(report.accuracy)}</span>
            <span className="muted">held-out accuracy · {new Date(report.trained_at).toLocaleString()} · {report.epochs} epochs · {Math.round(report.seconds)} s</span>
          </div>
          <div className="table-scroll"><table>
            <thead><tr><th>Sign</th><th>Recordings</th><th>Held-out</th><th>Accuracy</th></tr></thead>
            <tbody>
              {Object.entries(report.signs).map(([sign, row]) => (
                <tr key={sign}>
                  <td>{sign}</td><td>{row.recordings}</td><td>{row.correct}/{row.held_out}</td>
                  <td className={row.accuracy == null ? '' : row.accuracy >= 0.8 ? 'good' : row.accuracy >= 0.5 ? 'meh' : 'error'}>{pct(row.accuracy)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          {report.confusions.length > 0 && (
            <>
              <h4>Mix-ups</h4>
              <ul className="confusions">
                {report.confusions.slice(0, 8).map(item => <li key={item.sign + item.read_as}><b>{item.sign}</b> read as <b>{item.read_as}</b> ×{item.times}</li>)}
              </ul>
              <p className="muted small">Fix mix-ups by recording more of both signs, or by making them look more different (other hand shape, place or movement).</p>
            </>
          )}
          <p className="muted small">This is accuracy on your own held-out recordings, from one signer and one camera. Real use with other lighting or other people is usually lower.</p>
        </section>
      )}

      {!report && !job.running && <section className="card empty-state"><Icon name="signal" size={30} /><h3>Your progress will appear here.</h3><p>Once you train, see how well your model understands each sign and which expressions need a few more takes.</p></section>}
      {job.log && <section className="card"><h3>Training activity</h3><pre ref={logRef} className="log">{job.log}</pre></section>}
    </div>
  );
}
