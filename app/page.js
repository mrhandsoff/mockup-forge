'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

const DEVICE_META = {
  xdr: { label: 'Apple XDR', icon: '🖥️', aspect: '16:9' },
  macbook: { label: 'MacBook Pro', icon: '💻', aspect: '3:2' },
  ipad: { label: 'iPad Pro', icon: '📱', aspect: '3:4' },
  iphone: { label: 'iPhone 17', icon: '📲', aspect: '9:16' },
};

const DEFAULT_MOCKUP_IDS = {
  xdr: 'X7PbdxQKSQEqm43S',
  macbook: 'ZiJJi8TfiAFX5Foa',
  ipad: 'ZvL81KPA3wFkHMzO',
  iphone: 'aMfKiv4O0AF5oGLE',
};

export default function Home() {
  const [brief, setBrief] = useState('');
  const [brandColors, setBrandColors] = useState('');
  const [brandFonts, setBrandFonts] = useState('');
  const [components, setComponents] = useState(null);
  const [productName, setProductName] = useState('');
  const [brandStyle, setBrandStyle] = useState('');
  const [phase, setPhase] = useState('input');
  const [error, setError] = useState('');
  const [mockupIds, setMockupIds] = useState(DEFAULT_MOCKUP_IDS);
  const [showSettings, setShowSettings] = useState(false);

  // Generation state
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [generatingStep, setGeneratingStep] = useState(''); // 'image' | 'mockup' | 'done' | ''
  const [results, setResults] = useState([]);
  const stopRef = useRef(false);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data) => {
        if (data.mockupIds) {
          setMockupIds((prev) => {
            const merged = { ...prev };
            Object.entries(data.mockupIds).forEach(([k, v]) => {
              if (v) merged[k] = v;
            });
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);

  // Extract components
  const handleExtract = useCallback(async () => {
    if (!brief.trim()) return;
    setError('');
    setPhase('planning');
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, brandColors, brandFonts }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Extraction failed');
      }
      const data = await res.json();
      setProductName(data.productName || 'Untitled');
      setBrandStyle(data.brandStyle || '');
      setComponents(data.components || []);
      setResults(new Array((data.components || []).length).fill(null));
      setPhase('review');
    } catch (err) {
      setError(err.message);
      setPhase('input');
    }
  }, [brief, brandColors, brandFonts]);

  const updateComponent = (i, field, value) => {
    setComponents((prev) => {
      const u = [...prev];
      u[i] = { ...u[i], [field]: value };
      return u;
    });
  };

  const removeComponent = (i) => {
    setComponents((prev) => prev.filter((_, idx) => idx !== i));
    setResults((prev) => prev.filter((_, idx) => idx !== i));
  };

  // Generate a single component (image + mockup)
  const generateOne = useCallback(async (index) => {
    const comp = components[index];
    setCurrentIndex(index);

    // Step 1: Generate image
    setGeneratingStep('image');
    try {
      const imgRes = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: comp.imagePrompt,
          aspectRatio: DEVICE_META[comp.device]?.aspect || '16:9',
        }),
      });
      if (!imgRes.ok) {
        const err = await imgRes.json();
        setResults((prev) => {
          const u = [...prev];
          u[index] = { ...comp, status: 'error', error: `Image: ${err.error}` };
          return u;
        });
        setGeneratingStep('done');
        return;
      }
      const imgData = await imgRes.json();

      // Step 2: Render mockup
      setGeneratingStep('mockup');
      const mockRes = await fetch('/api/render-mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: imgData.imageUrl,
          mockupId: mockupIds[comp.device],
          size: 1000,
        }),
      });
      if (!mockRes.ok) {
        const err = await mockRes.json();
        setResults((prev) => {
          const u = [...prev];
          u[index] = { ...comp, status: 'partial', rawImageUrl: imgData.imageUrl, error: `Mockup: ${err.error}` };
          return u;
        });
      } else {
        const mockData = await mockRes.json();
        setResults((prev) => {
          const u = [...prev];
          u[index] = {
            ...comp,
            status: mockData.url ? 'success' : 'partial',
            rawImageUrl: imgData.imageUrl,
            mockupUrl: mockData.url || null,
            error: mockData.url ? null : 'No mockup URL',
          };
          return u;
        });
      }
    } catch (err) {
      setResults((prev) => {
        const u = [...prev];
        u[index] = { ...comp, status: 'error', error: err.message };
        return u;
      });
    }
    setGeneratingStep('done');
  }, [components, mockupIds]);

  // Start generating from a given index
  const startFrom = useCallback((startIndex) => {
    stopRef.current = false;
    setPhase('generating');
    generateOne(startIndex);
  }, [generateOne]);

  // Proceed to next
  const proceedNext = useCallback(() => {
    const next = currentIndex + 1;
    if (next >= components.length || stopRef.current) {
      setPhase('done');
      return;
    }
    generateOne(next);
  }, [currentIndex, components, generateOne]);

  // Regenerate current
  const regenerateCurrent = useCallback(() => {
    generateOne(currentIndex);
  }, [currentIndex, generateOne]);

  // Stop
  const handleStop = () => {
    stopRef.current = true;
    setPhase('done');
  };

  // Reset
  const handleReset = () => {
    setBrief('');
    setComponents(null);
    setProductName('');
    setBrandStyle('');
    setPhase('input');
    setError('');
    setResults([]);
    setCurrentIndex(-1);
    setGeneratingStep('');
    stopRef.current = false;
  };

  const s = {
    bg: '#0a0a0f',
    card: '#12121e',
    border: '#2a2a3e',
    muted: '#6b6b7b',
    text: '#e8e6e3',
    accent: '#6c5ce7',
    accentLight: '#a29bfe',
  };

  return (
    <>
      <style jsx global>{`
        *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'DM Sans',sans-serif; background:${s.bg}; color:${s.text}; min-height:100vh; -webkit-font-smoothing:antialiased; }
        ::selection { background:${s.accent}; color:white; }
        textarea:focus, input:focus { border-color:${s.accent} !important; outline:none; }
      `}</style>

      <div style={{ maxWidth:960, margin:'0 auto', padding:'40px 20px' }}>
        {/* Header */}
        <header style={{ marginBottom:40, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <h1 style={{ fontSize:28, fontWeight:700, background:`linear-gradient(135deg,${s.accentLight},${s.accent})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>MockupForge</h1>
            <p style={{ color:s.muted, marginTop:4, fontSize:13 }}>Paste brief → review each mockup → download</p>
          </div>
          <button onClick={() => setShowSettings(!showSettings)} style={{ background:showSettings ? s.accent : s.card, border:`1px solid ${s.border}`, color:s.text, padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontFamily:'inherit' }}>⚙ Settings</button>
        </header>

        {/* Settings */}
        {showSettings && (
          <div style={{ background:s.card, border:`1px solid ${s.border}`, borderRadius:12, padding:24, marginBottom:24 }}>
            <h3 style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>Device Mockup IDs</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {Object.entries(DEVICE_META).map(([key, meta]) => (
                <div key={key}>
                  <label style={{ fontSize:12, color:s.muted, display:'block', marginBottom:3 }}>{meta.icon} {meta.label}</label>
                  <input type="text" value={mockupIds[key]} onChange={(e) => setMockupIds(p => ({ ...p, [key]: e.target.value }))} style={{ width:'100%', background:s.bg, border:`1px solid ${s.border}`, color:s.text, padding:'7px 10px', borderRadius:6, fontFamily:'JetBrains Mono', fontSize:12 }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{ background:'#1e0a0a', border:'1px solid #4a1515', borderRadius:8, padding:'10px 14px', marginBottom:20, color:'#f87171', fontSize:13 }}>{error}</div>
        )}

        {/* PHASE: INPUT */}
        {phase === 'input' && (
          <div>
            <textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Paste your full product description here..." style={{ width:'100%', minHeight:200, background:s.card, border:`1px solid ${s.border}`, color:s.text, padding:18, borderRadius:12, fontSize:14, fontFamily:'inherit', lineHeight:1.7, resize:'vertical' }} />

            {/* Brand Controls */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12 }}>
              <div>
                <label style={{ fontSize:12, color:s.muted, display:'block', marginBottom:4 }}>Brand Colors (optional)</label>
                <input type="text" value={brandColors} onChange={(e) => setBrandColors(e.target.value)} placeholder="e.g. deep emerald #0d3b2e, gold #c9a84c, cream #f5f0e8" style={{ width:'100%', background:s.card, border:`1px solid ${s.border}`, color:s.text, padding:'9px 12px', borderRadius:8, fontSize:13, fontFamily:'inherit' }} />
              </div>
              <div>
                <label style={{ fontSize:12, color:s.muted, display:'block', marginBottom:4 }}>Typography Style (optional)</label>
                <input type="text" value={brandFonts} onChange={(e) => setBrandFonts(e.target.value)} placeholder="e.g. elegant gold serif titles, clean white sans-serif body" style={{ width:'100%', background:s.card, border:`1px solid ${s.border}`, color:s.text, padding:'9px 12px', borderRadius:8, fontSize:13, fontFamily:'inherit' }} />
              </div>
            </div>

            <button onClick={handleExtract} disabled={!brief.trim()} style={{ marginTop:16, width:'100%', padding:'13px 24px', background:brief.trim() ? `linear-gradient(135deg,${s.accent},${s.accentLight})` : s.card, border:'none', borderRadius:10, color:brief.trim() ? 'white' : '#4b4b5b', fontSize:15, fontWeight:600, fontFamily:'inherit', cursor:brief.trim() ? 'pointer' : 'default' }}>
              Analyze Product Brief →
            </button>
          </div>
        )}

        {/* PHASE: PLANNING */}
        {phase === 'planning' && (
          <div style={{ textAlign:'center', padding:'60px 0' }}>
            <Spinner />
            <p style={{ color:s.muted, fontSize:14, marginTop:16 }}>Analyzing brief and writing image prompts...</p>
          </div>
        )}

        {/* PHASE: REVIEW */}
        {phase === 'review' && components && (
          <div>
            <div style={{ marginBottom:20 }}>
              <h2 style={{ fontSize:20, fontWeight:600 }}>{productName}</h2>
              {brandStyle && <p style={{ color:s.muted, fontSize:13, marginTop:4, lineHeight:1.5 }}>{brandStyle}</p>}
              <p style={{ color:s.muted, fontSize:13, marginTop:4 }}>{components.length} components. Edit prompts or device assignments, then generate one at a time.</p>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {components.map((comp, i) => (
                <div key={i} style={{ background:s.card, border:`1px solid ${s.border}`, borderRadius:10, padding:16 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                    <div>
                      <span style={{ fontSize:11, color:s.accent, fontWeight:600 }}>{DEVICE_META[comp.device]?.icon} {DEVICE_META[comp.device]?.label}</span>
                      <div style={{ fontSize:15, fontWeight:600, marginTop:2 }}>{comp.name}</div>
                      <div style={{ fontSize:12, color:s.muted, marginTop:2 }}>{comp.description}</div>
                    </div>
                    <button onClick={() => removeComponent(i)} style={{ background:'none', border:'none', color:'#4b4b5b', cursor:'pointer', fontSize:16, padding:'0 4px' }}>×</button>
                  </div>
                  <div style={{ display:'flex', gap:5, marginBottom:10 }}>
                    {Object.entries(DEVICE_META).map(([key, meta]) => (
                      <button key={key} onClick={() => updateComponent(i, 'device', key)} style={{ padding:'4px 9px', borderRadius:5, border:'1px solid', borderColor:comp.device === key ? s.accent : s.border, background:comp.device === key ? `${s.accent}20` : 'transparent', color:comp.device === key ? s.accentLight : s.muted, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
                        {meta.icon} {meta.label}
                      </button>
                    ))}
                  </div>
                  <textarea value={comp.imagePrompt} onChange={(e) => updateComponent(i, 'imagePrompt', e.target.value)} style={{ width:'100%', minHeight:70, background:s.bg, border:`1px solid #1a1a2e`, color:'#c8c6c3', padding:10, borderRadius:7, fontSize:12, fontFamily:'inherit', lineHeight:1.5, resize:'vertical' }} />
                </div>
              ))}
            </div>

            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={handleReset} style={{ padding:'11px 20px', background:s.card, border:`1px solid ${s.border}`, borderRadius:10, color:s.muted, fontSize:13, fontFamily:'inherit', cursor:'pointer' }}>← Back</button>
              <button onClick={() => startFrom(0)} style={{ flex:1, padding:'13px 24px', background:`linear-gradient(135deg,${s.accent},${s.accentLight})`, border:'none', borderRadius:10, color:'white', fontSize:15, fontWeight:600, fontFamily:'inherit', cursor:'pointer' }}>
                Start Generating (1 at a time) →
              </button>
            </div>
          </div>
        )}

        {/* PHASE: GENERATING */}
        {(phase === 'generating' || phase === 'done') && (
          <div>
            <div style={{ marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <h2 style={{ fontSize:20, fontWeight:600 }}>{productName}</h2>
                <p style={{ color:s.muted, fontSize:13, marginTop:4 }}>
                  {results.filter(r => r && r.status === 'success').length} of {components.length} complete
                </p>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {phase === 'done' && (
                  <button onClick={handleReset} style={{ padding:'8px 16px', background:s.card, border:`1px solid ${s.border}`, borderRadius:8, color:s.muted, fontSize:12, fontFamily:'inherit', cursor:'pointer' }}>New Product</button>
                )}
              </div>
            </div>

            {/* Current generation */}
            {phase === 'generating' && currentIndex >= 0 && currentIndex < components.length && (
              <div style={{ background:s.card, border:`2px solid ${s.accent}`, borderRadius:12, padding:20, marginBottom:20 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <div>
                    <span style={{ fontSize:12, color:s.accent, fontWeight:600 }}>
                      {currentIndex + 1} / {components.length} — {DEVICE_META[components[currentIndex].device]?.icon} {components[currentIndex].name}
                    </span>
                  </div>
                  {generatingStep !== 'done' && (
                    <button onClick={handleStop} style={{ padding:'6px 14px', background:'#4a1515', border:'1px solid #6a2525', borderRadius:6, color:'#f87171', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Stop</button>
                  )}
                </div>

                {/* Loading state */}
                {generatingStep && generatingStep !== 'done' && (
                  <div style={{ textAlign:'center', padding:'30px 0' }}>
                    <Spinner />
                    <p style={{ color:s.muted, fontSize:13, marginTop:12 }}>
                      {generatingStep === 'image' ? 'Generating image with Nano Banana...' : 'Rendering device mockup...'}
                    </p>
                  </div>
                )}

                {/* Result preview */}
                {generatingStep === 'done' && results[currentIndex] && (
                  <div>
                    <div style={{ display:'grid', gridTemplateColumns: results[currentIndex].mockupUrl ? '1fr 1fr' : '1fr', gap:12, marginBottom:16 }}>
                      {results[currentIndex].rawImageUrl && (
                        <div>
                          <p style={{ fontSize:11, color:s.muted, marginBottom:6 }}>Raw Image</p>
                          <img src={results[currentIndex].rawImageUrl} alt="raw" style={{ width:'100%', borderRadius:8, border:`1px solid ${s.border}` }} />
                        </div>
                      )}
                      {results[currentIndex].mockupUrl && (
                        <div>
                          <p style={{ fontSize:11, color:s.muted, marginBottom:6 }}>Device Mockup</p>
                          <img src={results[currentIndex].mockupUrl} alt="mockup" style={{ width:'100%', borderRadius:8, border:`1px solid ${s.border}` }} />
                        </div>
                      )}
                      {results[currentIndex].status === 'error' && (
                        <div style={{ color:'#f87171', fontSize:13, padding:20 }}>{results[currentIndex].error}</div>
                      )}
                    </div>

                    {/* Edit prompt inline */}
                    <details style={{ marginBottom:12 }}>
                      <summary style={{ fontSize:12, color:s.muted, cursor:'pointer' }}>Edit prompt & regenerate</summary>
                      <textarea value={components[currentIndex].imagePrompt} onChange={(e) => updateComponent(currentIndex, 'imagePrompt', e.target.value)} style={{ width:'100%', minHeight:70, background:s.bg, border:`1px solid #1a1a2e`, color:'#c8c6c3', padding:10, borderRadius:7, fontSize:12, fontFamily:'inherit', lineHeight:1.5, resize:'vertical', marginTop:8 }} />
                    </details>

                    {/* Action buttons */}
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={regenerateCurrent} style={{ padding:'9px 18px', background:s.card, border:`1px solid ${s.border}`, borderRadius:8, color:s.text, fontSize:13, fontFamily:'inherit', cursor:'pointer' }}>
                        Regenerate
                      </button>
                      <button onClick={proceedNext} style={{ flex:1, padding:'9px 18px', background:`linear-gradient(135deg,${s.accent},${s.accentLight})`, border:'none', borderRadius:8, color:'white', fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer' }}>
                        {currentIndex + 1 < components.length ? `Approve & Next (${currentIndex + 2}/${components.length}) →` : 'Approve & Finish →'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Results grid */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:12 }}>
              {results.map((r, i) => {
                if (!r) return (
                  <div key={i} style={{ background:s.card, border:`1px solid ${s.border}`, borderRadius:10, padding:16, opacity:0.4 }}>
                    <div style={{ fontSize:13, fontWeight:500 }}>{components[i]?.name}</div>
                    <div style={{ fontSize:11, color:s.muted, marginTop:2 }}>{DEVICE_META[components[i]?.device]?.icon} Pending</div>
                  </div>
                );
                return (
                  <div key={i} style={{ background:s.card, border:`1px solid ${r.status === 'success' ? s.border : '#4a1515'}`, borderRadius:10, overflow:'hidden' }}>
                    <div style={{ aspectRatio:'16/10', background:s.bg }}>
                      {r.mockupUrl ? (
                        <img src={r.mockupUrl} alt={r.name} style={{ width:'100%', height:'100%', objectFit:'contain' }} />
                      ) : r.rawImageUrl ? (
                        <img src={r.rawImageUrl} alt={r.name} style={{ width:'100%', height:'100%', objectFit:'contain', opacity:0.6 }} />
                      ) : (
                        <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#4b4b5b', fontSize:12 }}>Failed</div>
                      )}
                    </div>
                    <div style={{ padding:10 }}>
                      <div style={{ fontSize:13, fontWeight:500 }}>{r.name}</div>
                      <div style={{ fontSize:11, color:s.muted, marginTop:2 }}>{DEVICE_META[r.device]?.icon} {DEVICE_META[r.device]?.label}</div>
                      {r.mockupUrl && (
                        <a href={r.mockupUrl} target="_blank" rel="noopener" style={{ display:'inline-block', marginTop:8, padding:'5px 10px', background:s.accent, borderRadius:5, color:'white', fontSize:11, fontWeight:500, textDecoration:'none' }}>Download</a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Spinner() {
  return (
    <>
      <div style={{ width:32, height:32, border:'3px solid #2a2a3e', borderTopColor:'#6c5ce7', borderRadius:'50%', margin:'0 auto', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  );
}
