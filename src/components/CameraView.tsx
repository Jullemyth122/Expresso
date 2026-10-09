import type { ReactNode } from 'react';
import type { useTracker } from '../lib/useTracker';
import Icon from './Icon';

type Tracker = ReturnType<typeof useTracker>;
export default function CameraView({ tracker, badge }: { tracker: Tracker; badge?: ReactNode }) {
  const { videoRef, canvasRef, status, error, start, cameras, cameraId, chooseCamera, live } = tracker;
  return <div className="camera-wrap">
    <div className="camera-toolbar"><span><Icon name="record" size={16} /> Motion capture</span><span className={'camera-status ' + (status === 'running' ? 'good' : '')}><i />{status === 'running' ? 'Camera live' : status === 'loading' ? 'Connecting' : 'Camera off'}</span></div>
    <div className={'camera ' + (status === 'running' ? 'is-running' : '')}>
      <div className="mirror"><video ref={videoRef} playsInline muted /><canvas ref={canvasRef} /></div>
      {status !== 'running' && <div className="camera-overlay">
        <div className="gesture-art" aria-hidden="true"><div className="gesture-ring ring-one" /><div className="gesture-ring ring-two" /><div className="gesture-ring ring-three" /><span className="gesture-hand"><Icon name="hand" size={65} /></span><span className="tracking-point point-one" /><span className="tracking-point point-two" /><span className="tracking-point point-three" /></div>
        <h2>{status === 'loading' ? 'Finding your frame…' : 'Every gesture starts here.'}</h2>
        <p>Make room for your head, shoulders, and hands.<br />We’ll take care of the rest.</p>
        <button className="primary camera-start" disabled={status === 'loading'} onClick={() => void start()}><Icon name="record" size={17} />{status === 'loading' ? 'Starting camera…' : status === 'error' ? 'Retry camera' : 'Start camera'}{status !== 'loading' && <Icon name="arrow" size={16} />}</button>
        {error && <p className="error camera-error" role="alert">{error}</p>}
      </div>}
      <div className="viewfinder" aria-hidden="true"><i /><i /><i /><i /></div>
      <span className="camera-corner-label">{status === 'running' ? 'LIVE PREVIEW' : 'YOUR SPACE TO EXPRESS'}</span>
      {status === 'running' && <div className={'live ' + (live.active ? 'on' : '')}><i />{live.active ? 'Hands up' : 'Hands down'}<span>· {live.hands} hand{live.hands === 1 ? '' : 's'} · {live.seen}% tracked · {live.fps} fps</span></div>}
      {badge}
    </div>
    <div className="camera-foot"><span><Icon name="shield" size={13} /> Video stays on your device</span><span><Icon name="signal" size={13} /> Hand & body tracking</span></div>
    {cameras.length > 1 && <label className="camera-pick">Camera<select value={cameraId} onChange={event => chooseCamera(event.target.value)}><option value="">Default</option>{cameras.map(camera => <option key={camera.deviceId} value={camera.deviceId}>{camera.label || camera.deviceId.slice(0, 8)}</option>)}</select></label>}
  </div>;
}

