import { useEffect, useRef, useState } from 'react';
import CameraView from '../components/CameraView';
import Icon from '../components/Icon';
import { useTracker } from '../lib/useTracker';
import { Segmenter } from '../lib/segmenter';
import { api, asCommand, MIN_TO_TRAIN, NONE_TARGET, RECORD_TARGET } from '../api';

const MIN_FRAMES = 15;
const RECORD_SEGMENTER = { stillMs: Infinity, gapMs: 500, maxFrames: 240 };
const saved = (key: string, fallback: string) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const target = (sign: string) => sign === '_none' ? NONE_TARGET : RECORD_TARGET;
const displaySign = (sign: string) => sign === '_none' ? 'Random movements' : sign.toLowerCase().replace(/^./, letter => letter.toUpperCase());

export default function Record() {
  const [person, setPerson] = useState(() => saved('expresso.person', ''));
  const [signs, setSigns] = useState<string[]>([]);
  const [sign, setSign] = useState('');
  const [armed, setArmed] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [flash, setFlash] = useState('');
  const [newSign, setNewSign] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const state = useRef({ person, sign, armed });
  state.current = { person, sign, armed };

  const refresh = () => api<Record<string, number>>('/api/samples').then(setCounts).catch(error => setFlash(error.message));
  useEffect(() => {
    void api<string[]>('/api/signs').then(list => { setSigns(list); setSign(current => current || list[0] || ''); }).catch(error => setFlash(error.message));
    void refresh();
  }, []);
  useEffect(() => { try { localStorage.setItem('expresso.person', person); } catch { /* private mode */ } }, [person]);

  const segmenter = useRef<Segmenter | null>(null);
  if (!segmenter.current) {
    segmenter.current = new Segmenter(async frames => {
      const { person, sign, armed } = state.current;
      if (!armed || !sign) return;
      if (!person.trim()) return setFlash('Enter your name before recording.');
      if (frames.length < MIN_FRAMES) return setFlash('That take was too short. Complete the sign, then lower your hands.');
      try {
        const { count } = await api<{ count: number }>('/api/samples', { person: person.trim(), label: sign, frames: frames.map(frame => Array.from(frame)) });
        setFlash('Saved ' + displaySign(sign) + ' · Take ' + count + ' · ' + frames.length + ' frames');
        setCounts(all => ({ ...all, [sign]: count }));
      } catch (error) { setFlash('Could not save: ' + (error as Error).message); }
    }, () => {}, RECORD_SEGMENTER);
  }
  const [capturing, setCapturing] = useState(false);
  const capturingRef = useRef(false);
  const tracker = useTracker((frame, time) => {
    if (!state.current.armed) return;
    segmenter.current!.push(frame, time);
    if (segmenter.current!.recording !== capturingRef.current) { capturingRef.current = segmenter.current!.recording; setCapturing(capturingRef.current); }
  });
  useEffect(() => {
    segmenter.current!.reset();
    capturingRef.current = false;
    setCapturing(false);
  }, [armed, sign, person]);

  const canRecord = tracker.status === 'running' && !!person.trim() && !!sign && !busy;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '/' && !(event.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) { event.preventDefault(); searchRef.current?.focus(); return; }
      if (event.code !== 'Space' || event.repeat || (event.target as HTMLElement).closest('input, textarea, select, button, a, summary, [contenteditable]')) return;
      if (!canRecord) return;
      event.preventDefault(); setArmed(on => !on);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [canRecord]);

  async function addSign() {
    setBusy(true);
    try {
      const name = newSign.toUpperCase().replace(/[^A-Z0-9' ]/g, '').replace(/\s+/g, ' ').trim();
      const list = await api<string[]>('/api/signs', { name: newSign });
      setSigns(list); setSign(list.includes(name) ? name : list[0] || ''); setArmed(false); setNewSign(''); setSearch(''); void refresh();
    } catch (error) { setFlash((error as Error).message); }
    finally { setBusy(false); }
  }
  async function removeSign(name: string) {
    if (!confirm('Remove "' + name + '" from the list? Its recordings stay saved.')) return;
    try {
      const list = await api<string[]>('/api/signs/remove', { name }); setSigns(list);
      if (name === sign) { setSign(list[0] || ''); setArmed(false); }
    } catch (error) { setFlash((error as Error).message); }
  }
  async function undo() {
    try { const { count } = await api<{ count: number }>('/api/samples/undo', { label: sign }); setCounts(all => ({ ...all, [sign]: count })); setFlash('Removed the last ' + displaySign(sign) + ' recording.'); }
    catch (error) { setFlash((error as Error).message); }
  }
  async function clear() {
    if (!confirm('Delete all ' + (counts[sign] ?? 0) + ' recordings of "' + sign + '"?')) return;
    try { await api('/api/samples/clear', { label: sign }); setCounts(all => ({ ...all, [sign]: 0 })); setFlash('Recordings cleared for ' + displaySign(sign) + '.'); }
    catch (error) { setFlash((error as Error).message); }
  }

  const done = signs.filter(item => (counts[item] ?? 0) >= target(item)).length;
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const visible = signs.filter(item => displaySign(item).toLowerCase().includes(search.toLowerCase()) || item.toLowerCase().includes(search.toLowerCase()));
  const count = counts[sign] ?? 0;
  return <>
    <div className="stats-strip">
      <div className="stat"><span className="stat-icon"><Icon name="hand" size={20} /></span><div><span className="stat-label">Your vocabulary</span><strong>{signs.length}<small>signs</small></strong></div><span className="stat-note">Made personal</span></div>
      <div className="stat"><span className="stat-icon secondary"><Icon name="record" size={20} /></span><div><span className="stat-label">Captured moments</span><strong>{total}<small>recordings</small></strong></div><span className="stat-note">Every take counts</span></div>
      <div className="stat"><span className="stat-icon success"><Icon name="check" size={20} /></span><div><span className="stat-label">Recording goals</span><strong>{done}<small>/ {signs.length} complete</small></strong></div><span className="stat-note">{done === signs.length && signs.length > 0 ? 'Looking good' : 'Keep expressing'}</span></div>
    </div>
    <div className="record">
      <section className="stage">
        <CameraView tracker={tracker} badge={tracker.status === 'running' && <div className={'rec ' + (armed ? 'armed ' : '') + (capturing ? 'capturing' : '')}><Icon name={armed ? 'circle' : 'pause'} size={13} />{!armed ? 'Paused · ready when you are' : capturing ? 'Capturing · lower your hands to save' : 'Ready · express your sign'}</div>} />
        <section className="capture-card">
          <div className="now">
            <div><span className="kicker">Selected expression</span><h2>{sign ? displaySign(sign) : 'Choose your first sign'}</h2><p>{sign === '_none' ? 'Wave, stretch, or reach for something, then lower your hands. Teach the model which movements to ignore.' : <>Autonoma understands {asCommand(sign)}.<br />Complete your sign, then <b>lower your hands</b> to save.</>}</p></div>
            <div className="count"><span className="take-label">RECORDINGS</span><div><b>{count.toString().padStart(2, '0')}</b><span>/ {target(sign)}</span></div><span className="bar"><i style={{ width: Math.min(100, count / target(sign) * 100) + '%' }} /></span></div>
          </div>
          <div className="recording-identity"><label className="person"><Icon name="user" size={15} /><span>Recording as</span><input aria-label="Your name" value={person} placeholder="Enter your name" maxLength={40} onChange={event => setPerson(event.target.value)} /></label><span className="shortcut"><kbd>Space</kbd> to record / pause</span></div>
          <div className="controls capture-controls">
            <button className={armed ? 'danger big' : 'primary big'} disabled={!canRecord && !armed} onClick={() => setArmed(on => !on)}><Icon name={armed ? 'pause' : 'circle'} size={16} />{armed ? 'Pause recording' : 'Record sign'}</button>
            <button className="quiet-button" onClick={() => void undo()} disabled={!count || armed}><Icon name="undo" size={15} />Undo last</button>
            <button className="icon-button delete-button" aria-label="Delete all recordings of this sign" title="Delete all recordings of this sign" onClick={() => void clear()} disabled={!count || armed}><Icon name="trash" size={16} /></button>
          </div>
          {!canRecord && !armed && <p className="record-hint">{!person.trim() ? 'Enter your name and start the camera to begin.' : tracker.status !== 'running' ? 'Start the camera when you’re ready to record.' : 'Select a sign to begin.'}</p>}
        </section>
        {flash && <p className="flash" role="status"><Icon name="info" size={16} />{flash}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setFlash('')}><Icon name="close" size={14} /></button></p>}
        <div className="tip-card"><Icon name="spark" size={19} /><div><b>A little variety goes a long way.</b><p>Try different speeds and positions. Aim for {RECORD_TARGET} recordings per sign to help your model learn you.</p></div><a href="#train" aria-label="Continue to train model"><Icon name="arrow" size={18} /></a></div>
      </section>
      <aside className="signs library">
        <div className="signs-head"><div><h2>Sign library <span className="number-badge">{signs.length}</span></h2><p>Your gestures, with purpose.</p></div><Icon name="hand" size={19} /></div>
        <label className="search-field"><Icon name="search" size={15} /><input ref={searchRef} aria-label="Search signs" value={search} placeholder="Find an expression…" onChange={event => setSearch(event.target.value)} /><kbd>/</kbd></label>
        <div className="library-label"><span>EXPRESSION</span><span>TAKES</span></div>
        <ul className="sign-list">
          {visible.map(item => {
            const n = counts[item] ?? 0, goal = target(item);
            return <li key={item} className={item === sign ? 'on' : ''}>
              <button className="sign" aria-pressed={item === sign} disabled={armed} onClick={() => setSign(item)}>
                <span className="sign-symbol">{n >= goal ? <Icon name="check" size={13} /> : <Icon name={item === '_none' ? 'signal' : 'hand'} size={14} />}</span>
                <span className="sign-content"><span className="name">{displaySign(item)}</span><span className="bar"><i style={{ width: Math.min(100, n / goal * 100) + '%' }} /></span></span>
                <span className={'n ' + (n >= goal ? 'good' : n >= MIN_TO_TRAIN ? 'meh' : '')}>{n}<small>/{goal}</small></span>
              </button>
              {item !== '_none' && <button className="x" disabled={armed} aria-label={'Remove ' + item} title={'Remove ' + item} onClick={() => void removeSign(item)}><Icon name="close" size={12} /></button>}
            </li>;
          })}
        </ul>
        {visible.length === 0 && <p className="empty-list">No expressions found. Try another search.</p>}
        <form className="add" onSubmit={event => { event.preventDefault(); void addSign(); }}>
          <label htmlFor="new-sign">Make it your own</label><div><input id="new-sign" value={newSign} maxLength={48} placeholder="New command, e.g. OPEN HELP" onChange={event => setNewSign(event.target.value)} /><button className="add-button" aria-label="Add sign" disabled={!newSign.trim() || busy || armed}><Icon name="plus" size={17} /></button></div>
        </form>
        <div className="library-foot"><Icon name="info" size={15} /><p>Name signs like spoken commands.<br /><b>{MIN_TO_TRAIN}+ takes</b> to train. <b>{RECORD_TARGET}</b> to go further.</p></div>
      </aside>
    </div>
  </>;
}

