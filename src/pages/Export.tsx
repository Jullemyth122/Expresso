import { useEffect, useState } from 'react';
import { api, type Job } from '../api';
import Icon from '../components/Icon';

type ExportState = Job & { target: string; autonoma: boolean; copied?: string[] };

/** Copies the trained model into Autonoma (public/sign), optionally rebuilding the extension. */
export default function Export() {
  const [state, setState] = useState<ExportState | null>(null);
  const [error, setError] = useState('');
  const poll = () => api<ExportState>('/api/export').then(setState).catch(failure => setError(failure.message));
  useEffect(() => { void poll(); }, []);
  useEffect(() => {
    if (!state?.running) return;
    const timer = setInterval(() => void poll(), 1000);
    return () => clearInterval(timer);
  }, [state?.running]);

  async function send(build: boolean) {
    setError('');
    try { setState(await api<ExportState>('/api/export', { build })); } catch (failure) { setError((failure as Error).message); }
  }

  return (
    <div className="page">
      <section className="card">
        <div className="card-title"><span className="stat-icon"><Icon name="export" size={23} /></span><div><h2>Make your signs part of everyday life.</h2><p>A personal connection, powered by your expression.</p></div></div>
        <p className="muted">Your model is trained here. Autonoma puts it to work. Send your learned signs to the extension to fill forms and navigate with a gesture.</p>
        <div className="connection-flow"><div className="connection-node"><Icon name="hand" size={30} /><div><h3>Expresso</h3><p>Your personal sign model</p></div></div><span className="connection-line"><Icon name="arrow" size={26} /></span><div className="connection-node"><Icon name="spark" size={30} /><div><h3>Autonoma</h3><p>Expression becomes action</p></div></div></div>
        {state && <p className={`connection-state ${state.autonoma ? 'good' : 'error'}`}><Icon name={state.autonoma ? 'check' : 'info'} size={16} />{state.autonoma ? 'Autonoma is available on this computer.' : 'Autonoma was not found beside Expresso.'}</p>}
        <div className="controls">
          <button className="primary big" disabled={!state?.autonoma || state.running} onClick={() => void send(true)}><Icon name="export" size={16} />{state?.running ? 'Building Autonoma…' : 'Copy and rebuild Autonoma'}</button>
          <button disabled={!state?.autonoma || state.running} onClick={() => void send(false)}>Copy only</button>
        </div>
        <details className="export-details"><summary>What gets transferred?</summary><p>Your trained model (<code>fsl.onnx</code>), sign names (<code>labels.json</code>), and validation files (<code>report.json</code> and <code>selftest.json</code>) are copied into Autonoma’s <code>public/sign</code> folder. Your recordings stay in Expresso. “Copy and rebuild” also rebuilds the extension; “Copy only” leaves rebuilding to you.</p>{state?.target && <p>Destination: <code>{state.target}</code></p>}</details>
        {error && <p className="error" role="alert">{error}</p>}
        {state?.log && <pre className="log">{state.log}</pre>}
        {!state?.running && state?.code === 0 && <p className="good">Done. Open chrome://extensions and press reload on Autonoma, then turn on Sign mode in its panel.</p>}
      </section>
      <section className="card">
        <h3>One gesture. A meaningful action.</h3>
        <p className="muted">Autonoma reads each sign as a spoken command. Name your expressions for the actions you want to take.</p>
        <div className="command-examples">{['FILL THIS PAGE', 'FILL THIS PHONE NUMBER', 'WHAT IS MISSING', 'NEXT', 'SUBMIT', 'STOP'].map(command => <span key={command}>{command}</span>)}</div>
        <p className="muted small">Submitting always asks for a YES sign first. Random movements (<code>_none</code>) are ignored.</p>
      </section>
    </div>
  );
}
