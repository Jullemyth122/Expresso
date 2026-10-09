import { useEffect, useRef, useState } from 'react';
import CameraView from '../components/CameraView';
import Icon from '../components/Icon';
import { useTracker } from '../lib/useTracker';
import { O, Segmenter } from '../lib/segmenter';
import { resample } from '../lib/features';
import { classify, loadClassifier } from '../lib/classifier';
import { asCommand } from '../api';

type Guess = { label: string; prob: number; top3: { label: string; prob: number }[]; frames: number };
const saved = (key: string, fallback: number) => { try { const value = Number(localStorage.getItem(key)); return value > 0 ? value : fallback; } catch { return fallback; } };

/** Live recognition with the latest trained model, the same way Autonoma will run it. */
export default function Test() {
  const [labels, setLabels] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const [threshold, setThreshold] = useState(() => saved('expresso.threshold', 0.6));
  const [stillMs, setStillMs] = useState(() => saved('expresso.stillMs', O.stillMs));
  const [guesses, setGuesses] = useState<Guess[]>([]);

  useEffect(() => { loadClassifier().then(setLabels, failure => setError(failure.message)); }, []);
  useEffect(() => { try { localStorage.setItem('expresso.threshold', String(threshold)); localStorage.setItem('expresso.stillMs', String(stillMs)); } catch { /* private mode */ } }, [threshold, stillMs]);

  const segmenter = useRef<Segmenter | null>(null);
  if (!segmenter.current) {
    segmenter.current = new Segmenter(frames => {
      void classify(resample(frames)).then(result => setGuesses(list => [{ ...result, frames: frames.length }, ...list].slice(0, 12))).catch(failure => setError(failure.message));
    }, () => {}, { stillMs });
  }
  useEffect(() => { segmenter.current!.setOptions({ stillMs }); }, [stillMs]);
  const tracker = useTracker((frame, time) => { if (labels) segmenter.current!.push(frame, time); });

  const last = guesses[0];
  const accepted = (guess: Guess) => guess.prob >= threshold && guess.label !== '_none';
  return (
    <div className="record">
      <section className="stage">
        <CameraView tracker={tracker} badge={last && (
          <div className={`gloss ${accepted(last) ? 'ok' : 'low'}`}>{last.label} · {Math.round(last.prob * 100)}%</div>
        )} />
        {error && <section className="card empty-state"><Icon name="train" size={28} /><h3>Let’s get your model ready.</h3><p className="error" role="alert">{error}</p><a className="button primary" href="#train">Go to training <Icon name="arrow" size={15} /></a></section>}
        {!labels && !error && <p className="flash" role="status">Loading your sign model…</p>}
        {labels && (
          <div className="now capture-card">
            <div>
              <span className="kicker">Your expression, understood</span>
              <h2>{!last ? 'Ready for your first sign.' : accepted(last) ? asCommand(last.label) : last.label === '_none' ? 'Just a movement. No command.' : 'Let’s try that once more.'}</h2>
              {!last && <p>Make a sign, then lower your hands or hold still.</p>}
              {last && <p className="muted">{last.top3.map(item => `${item.label} ${Math.round(item.prob * 100)}%`).join(' · ')} · {last.frames} frames</p>}
            </div>
          </div>
        )}
      </section>
      <aside className="signs">
        <div className="signs-head"><div><h2>Fine-tune recognition</h2><p>Find the rhythm that feels right.</p></div></div>
        <hr className="settings-divider" />
        <label className="slider"><span>Confidence needed <b>{Math.round(threshold * 100)}%</b></span>
          <input aria-label="Confidence needed" aria-valuetext={`${Math.round(threshold * 100)} percent`} type="range" min={0.3} max={0.95} step={0.05} value={threshold} onChange={event => setThreshold(+event.target.value)} />
        </label>
        <p className="muted small">Lower accepts more signs but makes more mistakes. 60% is a good start.</p>
        <label className="slider"><span>Hold to finish <b>{stillMs} ms</b></span>
          <input aria-label="Hold to finish" aria-valuetext={`${stillMs} milliseconds`} type="range" min={300} max={1500} step={50} value={stillMs} onChange={event => setStillMs(+event.target.value)} />
        </label>
        <p className="muted small">Dropping your hands always ends a sign straight away.</p>
        <hr className="settings-divider" />
        <div className="section-heading"><h3>Recent expressions</h3><span className="number-badge">{guesses.length}</span></div>
        {guesses.length === 0 && <p className="history-empty">Your signs will show up here.<br />Go ahead, express yourself.</p>}
        <ul className="history">
          {guesses.map((guess, index) => (
            <li key={guesses.length - index} className={accepted(guess) ? 'good' : 'muted'}>{guess.label} <span>{Math.round(guess.prob * 100)}%</span></li>
          ))}
        </ul>
        {labels && <div><p className="muted small">{labels.length} signs in your vocabulary</p><div className="model-labels">{labels.map(label => <span key={label}>{label === '_none' ? 'RANDOM MOVEMENTS' : label}</span>)}</div></div>}
      </aside>
    </div>
  );
}
