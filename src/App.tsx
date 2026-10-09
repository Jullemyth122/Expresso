import { useEffect, useState } from 'react';

import Record from './pages/Record';
import Train from './pages/Train';
import Test from './pages/Test';
import Export from './pages/Export';
import Icon, { type IconName } from './components/Icon';
import ThemePicker from './components/ThemePicker';


const TABS = {
  record: { label: 'Record signs', short: 'Record', description: 'Capture your expression', title: 'Your movement. Your voice.', subtitle: 'Teach Autonoma the way you express yourself. One sign at a time.', Page: Record },
  train: { label: 'Train model', short: 'Train', description: 'Make it understand you', title: 'Movement becomes meaning.', subtitle: 'Turn your recordings into a model that understands your signs.', Page: Train },
  test: { label: 'Test live', short: 'Test', description: 'See your signs in action', title: 'Let your hands do the talking.', subtitle: 'Try your signs in real time, exactly as Autonoma will understand them.', Page: Test },
  export: { label: 'Connect Autonoma', short: 'Export', description: 'Bring your signs to life', title: 'Your expression, in action.', subtitle: 'Bring your personal sign model into Autonoma and make things happen.', Page: Export },
} as const;
type Tab = keyof typeof TABS;
const fromHash = (): Tab => Object.hasOwn(TABS, location.hash.slice(1)) ? location.hash.slice(1) as Tab : 'record';

export default function App() {
  const [tab, setTab] = useState<Tab>(fromHash);
  const [guide, setGuide] = useState(false);
  useEffect(() => { const onHash = () => setTab(fromHash()); addEventListener('hashchange', onHash); return () => removeEventListener('hashchange', onHash); }, []);
  useEffect(() => { document.title = TABS[tab].short + ' · Expresso — Express through action'; window.scrollTo(0, 0); }, [tab]);
  const { Page, title, subtitle } = TABS[tab];
  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
      <aside className="sidebar">
        <a className="brand" href="#record" aria-label="Expresso home">
          <span className="brand-mark"><Icon name="hand" size={24} /></span>
          <span className="wordmark">expresso<span>EXPRESS THROUGH ACTION</span></span>
        </a>
        <div className="workspace-label"><span className="status-dot" /> Personal sign studio <span className="version">01</span></div>
        <p className="eyebrow nav-label">Your workflow</p>
        <nav className="nav-items" aria-label="Studio workflow">
          {(Object.keys(TABS) as Tab[]).map((key, index) => <a key={key} href={'#' + key} aria-current={key === tab ? 'page' : undefined}>
            <Icon name={key as IconName} size={19} /><span>{TABS[key].label}<small>{TABS[key].description}</small></span><span className="nav-number">0{index + 1}</span>
          </a>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="expression-note"><span className="mini-orbit"><Icon name="spark" size={20} /></span><h3>Expression has no limits.</h3><p>A gesture. A meaning.<br />A world of possibilities.</p></div>
          <ThemePicker />
          <div className="local-note"><Icon name="shield" size={16} /><span>Private by design<small>Your recordings stay on this device.</small></span></div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb"><span>Studio</span><Icon name="chevron" size={12} /><b>{TABS[tab].short}</b></div>
          <div className="topbar-actions"><span className="local-badge"><span className="status-dot" /> Local workspace</span><button className="guide-button" onClick={() => setGuide(open => !open)} aria-expanded={guide} aria-controls="studio-guide"><Icon name="book" size={16} /> Quick guide</button></div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <section className="page-heading">
            <div><div className="eyebrow heading-kicker"><span /> THE EXPRESSO STUDIO</div><h1>{title}</h1><p>{subtitle}</p></div>
            <span className="step-indicator">STEP <b>0{Object.keys(TABS).indexOf(tab) + 1}</b><span>/ 04</span></span>
          </section>
          {guide && <section id="studio-guide" className="guide card">
            <div className="section-heading"><h2>Your first signs, in four steps</h2><button className="icon-button" aria-label="Close quick guide" onClick={() => setGuide(false)}><Icon name="close" /></button></div>
            <ol><li><b>Record</b><span>Enter your name, start the camera, and choose a sign. Press Record, sign, then lower your hands. Aim for 15 takes per sign and 25 for random movements.</span></li><li><b>Train</b><span>Record at least two signs with 8 takes each, then train your model on this computer.</span></li><li><b>Test</b><span>Try your signs live. Adjust confidence and hold time to find what works for you.</span></li><li><b>Connect</b><span>Export to Autonoma, reload the extension, and turn on Sign mode.</span></li></ol>
          </section>}
          {/* Leaving a workflow page stops its camera. Theme changes do not remount it. */}
          <Page key={tab} />
          <footer className="footer"><span><Icon name="hand" size={14} /> Built for the way you express.</span><details><summary>Technology & credits</summary><p>Feature pipeline adapted from Kamay, built with FSL-105 by Tupal, I. J. &amp; Cabatuan, M. K. Mendeley Data V2 · doi:10.17632/48y2y99mb9.2 · CC BY 4.0. Expresso learns from your own recordings.</p></details><span className="footer-autonoma">PART OF AUTONOMA <Icon name="spark" size={13} /></span></footer>
        </main>
      </div>
    </div>
  );
}



