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
  macbook: 'Z6NUCWxg1wFjtBDe',
  ipad: 'adKDCNpIJk5GYtF8',
  iphone: 'XtWDyavzoAIcEXmZ',
};

// Exact screen pixel dimensions from Mockuuups templates
const SCREEN_DIMS = {
  xdr: null, // skip crop — already fits
  macbook: { w: 2880, h: 1800 },
  ipad: { w: 1668, h: 2388 },
  iphone: { w: 1125, h: 2436 },
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
  const [deviceCounts, setDeviceCounts] = useState({ xdr: 1, macbook: 1, ipad: 6, iphone: 1 });

  const [currentIndex, setCurrentIndex] = useState(-1);
  const [generatingStep, setGeneratingStep] = useState('');
  const [results, setResults] = useState([]);
  const stopRef = useRef(false);
  const [bundleExporting, setBundleExporting] = useState(false);

  // Crop tool state
  const [cropData, setCropData] = useState(null); // { imageUrl, device, index }

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(data => {
      if (data.mockupIds) setMockupIds(prev => {
        const m = { ...prev };
        Object.entries(data.mockupIds).forEach(([k, v]) => { if (v) m[k] = v; });
        return m;
      });
    }).catch(() => {});
  }, []);

  const handleExtract = useCallback(async () => {
    if (!brief.trim()) return;
    setError('');
    setPhase('planning');
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, brandColors, brandFonts, deviceCounts }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      const data = await res.json();
      setProductName(data.productName || 'Untitled');
      setBrandStyle(data.brandStyle || '');
      setComponents(data.components || []);
      setResults(new Array((data.components || []).length).fill(null));
      setPhase('review');
    } catch (err) { setError(err.message); setPhase('input'); }
  }, [brief, brandColors, brandFonts, deviceCounts]);

  const updateComponent = (i, field, value) => {
    setComponents(prev => { const u = [...prev]; u[i] = { ...u[i], [field]: value }; return u; });
  };
  const removeComponent = (i) => {
    setComponents(prev => prev.filter((_, idx) => idx !== i));
    setResults(prev => prev.filter((_, idx) => idx !== i));
  };

  // Step 1: Generate image only
  const generateImage = useCallback(async (index) => {
    const comp = components[index];
    setCurrentIndex(index);
    setCropData(null);
    setGeneratingStep('image');

    try {
      const imgRes = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: comp.imagePrompt, aspectRatio: DEVICE_META[comp.device]?.aspect || '16:9' }),
      });
      if (!imgRes.ok) {
        let errMsg = 'Image generation failed';
        try { const err = await imgRes.json(); errMsg = err.error || errMsg; } catch(e) {}
        setResults(prev => { const u = [...prev]; u[index] = { ...comp, status: 'error', error: errMsg }; return u; });
        setGeneratingStep('done');
        return;
      }
      const imgData = await imgRes.json();

      // If XDR — skip crop, go straight to Mockuuups
      if (comp.device === 'xdr' || !SCREEN_DIMS[comp.device]) {
        await finishWithMockup(index, comp, imgData.imageUrl);
      } else {
        // Show crop tool
        setCropData({ imageUrl: imgData.imageUrl, device: comp.device, index });
        setGeneratingStep('cropping');
      }
    } catch (err) {
      setResults(prev => { const u = [...prev]; u[index] = { ...comp, status: 'error', error: err.message }; return u; });
      setGeneratingStep('done');
    }
  }, [components, mockupIds]);

  // Step 2: After crop confirmed (or skipped for XDR)
  const finishWithMockup = useCallback(async (index, comp, imageUrl) => {
    setGeneratingStep('mockup');
    let mockupUrl = null;
    try {
      const mockRes = await fetch('/api/render-mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, mockupId: mockupIds[comp.device], size: 1000 }),
      });
      if (mockRes.ok) {
        const mockData = await mockRes.json();
        mockupUrl = mockData.url || null;
      }
    } catch (e) {}

    // BG removal — iPad only
    let noBgUrl = null;
    if (mockupUrl && comp.device === 'ipad') {
      setGeneratingStep('removing-bg');
      try {
        const bgRes = await fetch('/api/remove-bg', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: mockupUrl }),
        });
        if (bgRes.ok) { const bgData = await bgRes.json(); noBgUrl = bgData.imageUrl || null; }
      } catch (e) {}
    }

    setResults(prev => {
      const u = [...prev];
      u[index] = { ...comp, status: mockupUrl ? 'success' : 'partial', rawImageUrl: imageUrl, mockupUrl, noBgUrl, error: mockupUrl ? null : 'Mockup render failed' };
      return u;
    });
    setCropData(null);
    setGeneratingStep('done');
  }, [mockupIds]);

  // Handle crop confirmation
  const handleCropConfirm = useCallback(async (base64) => {
    if (!cropData) return;
    setGeneratingStep('uploading');

    try {
      // Upload cropped image to Vercel Blob
      const uploadRes = await fetch('/api/upload-cropped', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, filename: `crop-${Date.now()}.png` }),
      });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const { url } = await uploadRes.json();

      // Continue pipeline with cropped URL
      await finishWithMockup(cropData.index, components[cropData.index], url);
    } catch (err) {
      setError('Crop upload failed: ' + err.message);
      setGeneratingStep('done');
    }
  }, [cropData, components, finishWithMockup]);

  // Skip crop — use original image as-is
  const handleCropSkip = useCallback(async () => {
    if (!cropData) return;
    await finishWithMockup(cropData.index, components[cropData.index], cropData.imageUrl);
  }, [cropData, components, finishWithMockup]);

  const startFrom = useCallback((startIndex) => {
    stopRef.current = false;
    setPhase('generating');
    generateImage(startIndex);
  }, [generateImage]);

  const proceedNext = useCallback(() => {
    const next = currentIndex + 1;
    if (next >= components.length || stopRef.current) { setPhase('done'); return; }
    generateImage(next);
  }, [currentIndex, components, generateImage]);

  const regenerateCurrent = useCallback(() => { generateImage(currentIndex); }, [currentIndex, generateImage]);

  const handleStop = () => { stopRef.current = true; setCropData(null); setPhase('done'); };

  const handleReset = () => {
    setBrief(''); setComponents(null); setProductName(''); setBrandStyle('');
    setPhase('input'); setError(''); setResults([]); setCurrentIndex(-1);
    setGeneratingStep(''); setCropData(null); stopRef.current = false;
  };

  const downloadAllZip = useCallback(async () => {
    setBundleExporting(true);
    try {
      if (!window.JSZip) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
          s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
        });
      }
      const zip = new window.JSZip();
      const folder = zip.folder(productName.replace(/\s+/g, '-'));
      for (const r of results) {
        if (!r) continue;
        const urls = [];
        if (r.noBgUrl) urls.push({ url: r.noBgUrl, suffix: 'no-bg' });
        if (r.mockupUrl) urls.push({ url: r.mockupUrl, suffix: 'mockup' });
        if (r.rawImageUrl) urls.push({ url: r.rawImageUrl, suffix: 'raw' });
        for (const { url, suffix } of urls) {
          try {
            const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
            if (!res.ok) continue;
            const blob = await res.blob();
            folder.file(`${r.name.replace(/\s+/g, '-')}-${suffix}.png`, blob);
          } catch (e) {}
        }
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.download = `${productName.replace(/\s+/g, '-')}-all-mockups.zip`;
      link.href = URL.createObjectURL(content);
      link.click(); URL.revokeObjectURL(link.href);
    } catch (err) { setError('ZIP failed: ' + err.message); }
    setBundleExporting(false);
  }, [results, productName]);

  const s = { bg:'#0a0a0f', card:'#12121e', border:'#2a2a3e', muted:'#6b6b7b', text:'#e8e6e3', accent:'#6c5ce7', accentLight:'#a29bfe' };

  return (
    <>
      <style jsx global>{`
        *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'DM Sans',sans-serif;background:${s.bg};color:${s.text};min-height:100vh;-webkit-font-smoothing:antialiased}
        ::selection{background:${s.accent};color:white}
        textarea:focus,input:focus{border-color:${s.accent}!important;outline:none}
      `}</style>

      <div style={{ maxWidth:960, margin:'0 auto', padding:'40px 20px' }}>
        <header style={{ marginBottom:40, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <h1 style={{ fontSize:28, fontWeight:700, background:`linear-gradient(135deg,${s.accentLight},${s.accent})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>MockupForge</h1>
            <p style={{ color:s.muted, marginTop:4, fontSize:13 }}>Paste brief → position images → get mockups</p>
          </div>
          <button onClick={() => setShowSettings(!showSettings)} style={{ background:showSettings?s.accent:s.card, border:`1px solid ${s.border}`, color:s.text, padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontFamily:'inherit' }}>⚙ Settings</button>
        </header>

        {showSettings && (
          <div style={{ background:s.card, border:`1px solid ${s.border}`, borderRadius:12, padding:24, marginBottom:24 }}>
            <h3 style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>Device Mockup IDs</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {Object.entries(DEVICE_META).map(([key, meta]) => (
                <div key={key}>
                  <label style={{ fontSize:12, color:s.muted, display:'block', marginBottom:3 }}>{meta.icon} {meta.label}</label>
                  <input type="text" value={mockupIds[key]} onChange={e => setMockupIds(p => ({...p,[key]:e.target.value}))} style={{ width:'100%', background:s.bg, border:`1px solid ${s.border}`, color:s.text, padding:'7px 10px', borderRadius:6, fontFamily:'JetBrains Mono', fontSize:12 }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div style={{ background:'#1e0a0a', border:'1px solid #4a1515', borderRadius:8, padding:'10px 14px', marginBottom:20, color:'#f87171', fontSize:13 }}>{error}</div>}

        {/* INPUT */}
        {phase === 'input' && (
          <div>
            <textarea value={brief} onChange={e => setBrief(e.target.value)} placeholder="Paste your full product description here..." style={{ width:'100%', minHeight:200, background:s.card, border:`1px solid ${s.border}`, color:s.text, padding:18, borderRadius:12, fontSize:14, fontFamily:'inherit', lineHeight:1.7, resize:'vertical' }} />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12 }}>
              <div>
                <label style={{ fontSize:12, color:s.muted, display:'block', marginBottom:4 }}>Brand Colors (optional)</label>
                <input type="text" value={brandColors} onChange={e => setBrandColors(e.target.value)} placeholder="e.g. deep emerald #0d3b2e, gold #c9a84c" style={{ width:'100%', background:s.card, border:`1px solid ${s.border}`, color:s.text, padding:'9px 12px', borderRadius:8, fontSize:13, fontFamily:'inherit' }} />
              </div>
              <div>
                <label style={{ fontSize:12, color:s.muted, display:'block', marginBottom:4 }}>Typography Style (optional)</label>
                <input type="text" value={brandFonts} onChange={e => setBrandFonts(e.target.value)} placeholder="e.g. elegant gold serif titles" style={{ width:'100%', background:s.card, border:`1px solid ${s.border}`, color:s.text, padding:'9px 12px', borderRadius:8, fontSize:13, fontFamily:'inherit' }} />
              </div>
            </div>
            <div style={{ marginTop:12, background:s.card, border:`1px solid ${s.border}`, borderRadius:10, padding:14 }}>
              <label style={{ fontSize:12, color:s.muted, display:'block', marginBottom:10 }}>Devices to generate</label>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                {Object.entries(DEVICE_META).map(([key, meta]) => (
                  <div key={key} style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:13, color:s.text }}>{meta.icon} {meta.label}</span>
                    <div style={{ display:'flex', alignItems:'center', gap:2 }}>
                      <button onClick={() => setDeviceCounts(p => ({...p,[key]:Math.max(0,p[key]-1)}))} style={{ width:24, height:24, background:s.bg, border:`1px solid ${s.border}`, borderRadius:4, color:s.text, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit' }}>−</button>
                      <span style={{ width:24, textAlign:'center', fontSize:14, fontWeight:600, color:s.accentLight }}>{deviceCounts[key]}</span>
                      <button onClick={() => setDeviceCounts(p => ({...p,[key]:Math.min(key==='ipad'?12:2,p[key]+1)}))} style={{ width:24, height:24, background:s.bg, border:`1px solid ${s.border}`, borderRadius:4, color:s.text, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit' }}>+</button>
                    </div>
                  </div>
                ))}
                <span style={{ fontSize:12, color:s.muted, alignSelf:'center', marginLeft:8 }}>Total: {Object.values(deviceCounts).reduce((a,b)=>a+b,0)}</span>
              </div>
            </div>
            <button onClick={handleExtract} disabled={!brief.trim()} style={{ marginTop:16, width:'100%', padding:'13px 24px', background:brief.trim()?`linear-gradient(135deg,${s.accent},${s.accentLight})`:s.card, border:'none', borderRadius:10, color:brief.trim()?'white':'#4b4b5b', fontSize:15, fontWeight:600, fontFamily:'inherit', cursor:brief.trim()?'pointer':'default' }}>Analyze Product Brief →</button>
          </div>
        )}

        {/* PLANNING */}
        {phase === 'planning' && <div style={{ textAlign:'center', padding:'60px 0' }}><Spinner /><p style={{ color:s.muted, fontSize:14, marginTop:16 }}>Analyzing brief...</p></div>}

        {/* REVIEW */}
        {phase === 'review' && components && (
          <div>
            <div style={{ marginBottom:20 }}>
              <h2 style={{ fontSize:20, fontWeight:600 }}>{productName}</h2>
              {brandStyle && <p style={{ color:s.muted, fontSize:13, marginTop:4, lineHeight:1.5 }}>{brandStyle}</p>}
              <p style={{ color:s.muted, fontSize:13, marginTop:4 }}>{components.length} components. Edit prompts, then generate.</p>
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
                    <button onClick={() => removeComponent(i)} style={{ background:'none', border:'none', color:'#4b4b5b', cursor:'pointer', fontSize:16 }}>×</button>
                  </div>
                  <div style={{ display:'flex', gap:5, marginBottom:10 }}>
                    {Object.entries(DEVICE_META).map(([key, meta]) => (
                      <button key={key} onClick={() => updateComponent(i,'device',key)} style={{ padding:'4px 9px', borderRadius:5, border:'1px solid', borderColor:comp.device===key?s.accent:s.border, background:comp.device===key?`${s.accent}20`:'transparent', color:comp.device===key?s.accentLight:s.muted, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>{meta.icon} {meta.label}</button>
                    ))}
                  </div>
                  <textarea value={comp.imagePrompt} onChange={e => updateComponent(i,'imagePrompt',e.target.value)} style={{ width:'100%', minHeight:70, background:s.bg, border:'1px solid #1a1a2e', color:'#c8c6c3', padding:10, borderRadius:7, fontSize:12, fontFamily:'inherit', lineHeight:1.5, resize:'vertical' }} />
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={handleReset} style={{ padding:'11px 20px', background:s.card, border:`1px solid ${s.border}`, borderRadius:10, color:s.muted, fontSize:13, fontFamily:'inherit', cursor:'pointer' }}>← Back</button>
              <button onClick={() => startFrom(0)} style={{ flex:1, padding:'13px 24px', background:`linear-gradient(135deg,${s.accent},${s.accentLight})`, border:'none', borderRadius:10, color:'white', fontSize:15, fontWeight:600, fontFamily:'inherit', cursor:'pointer' }}>Start Generating →</button>
            </div>
          </div>
        )}

        {/* GENERATING / DONE */}
        {(phase === 'generating' || phase === 'done') && (
          <div>
            <div style={{ marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <h2 style={{ fontSize:20, fontWeight:600 }}>{productName}</h2>
                <p style={{ color:s.muted, fontSize:13, marginTop:4 }}>{results.filter(r => r && r.status === 'success').length} of {components.length} complete</p>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {phase === 'done' && (
                  <>
                    <button onClick={handleReset} style={{ padding:'8px 16px', background:s.card, border:`1px solid ${s.border}`, borderRadius:8, color:s.muted, fontSize:12, fontFamily:'inherit', cursor:'pointer' }}>New Product</button>
                    <button onClick={downloadAllZip} disabled={bundleExporting} style={{ padding:'8px 16px', background:`linear-gradient(135deg,${s.accent},${s.accentLight})`, border:'none', borderRadius:8, color:'white', fontSize:12, fontWeight:600, fontFamily:'inherit', cursor:'pointer' }}>{bundleExporting ? 'Zipping...' : 'Download All ZIP'}</button>
                  </>
                )}
              </div>
            </div>

            {/* Active generation panel */}
            {phase === 'generating' && currentIndex >= 0 && currentIndex < components.length && (
              <div style={{ background:s.card, border:`2px solid ${s.accent}`, borderRadius:12, padding:20, marginBottom:20 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <span style={{ fontSize:12, color:s.accent, fontWeight:600 }}>
                    {currentIndex + 1} / {components.length} — {DEVICE_META[components[currentIndex].device]?.icon} {components[currentIndex].name}
                  </span>
                  {generatingStep !== 'done' && generatingStep !== 'cropping' && (
                    <button onClick={handleStop} style={{ padding:'6px 14px', background:'#4a1515', border:'1px solid #6a2525', borderRadius:6, color:'#f87171', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Stop</button>
                  )}
                </div>

                {/* Loading states */}
                {generatingStep && !['done','cropping'].includes(generatingStep) && (
                  <div style={{ textAlign:'center', padding:'30px 0' }}>
                    <Spinner />
                    <p style={{ color:s.muted, fontSize:13, marginTop:12 }}>
                      {generatingStep === 'image' ? 'Generating image...' : generatingStep === 'mockup' ? 'Rendering mockup...' : generatingStep === 'uploading' ? 'Uploading cropped image...' : 'Removing background...'}
                    </p>
                  </div>
                )}

                {/* CROP TOOL */}
                {generatingStep === 'cropping' && cropData && (
                  <CropTool
                    imageUrl={cropData.imageUrl}
                    targetW={SCREEN_DIMS[cropData.device].w}
                    targetH={SCREEN_DIMS[cropData.device].h}
                    deviceLabel={DEVICE_META[cropData.device]?.label}
                    onConfirm={handleCropConfirm}
                    onSkip={handleCropSkip}
                    s={s}
                  />
                )}

                {/* Result preview */}
                {generatingStep === 'done' && results[currentIndex] && (
                  <div>
                    <div style={{ display:'grid', gridTemplateColumns: results[currentIndex].noBgUrl ? '1fr 1fr 1fr' : results[currentIndex].mockupUrl ? '1fr 1fr' : '1fr', gap:12, marginBottom:16 }}>
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
                      {results[currentIndex].noBgUrl && (
                        <div>
                          <p style={{ fontSize:11, color:s.muted, marginBottom:6 }}>No Background</p>
                          <img src={results[currentIndex].noBgUrl} alt="no-bg" style={{ width:'100%', borderRadius:8, border:`1px solid ${s.border}`, background:'repeating-conic-gradient(#1a1a2e 0% 25%, #12121e 0% 50%) 50%/16px 16px' }} />
                        </div>
                      )}
                      {results[currentIndex].status === 'error' && (
                        <div style={{ color:'#f87171', fontSize:13, padding:20 }}>{results[currentIndex].error}</div>
                      )}
                    </div>

                    <details style={{ marginBottom:12 }}>
                      <summary style={{ fontSize:12, color:s.muted, cursor:'pointer' }}>Edit prompt & regenerate</summary>
                      <textarea value={components[currentIndex].imagePrompt} onChange={e => updateComponent(currentIndex,'imagePrompt',e.target.value)} style={{ width:'100%', minHeight:70, background:s.bg, border:'1px solid #1a1a2e', color:'#c8c6c3', padding:10, borderRadius:7, fontSize:12, fontFamily:'inherit', lineHeight:1.5, resize:'vertical', marginTop:8 }} />
                    </details>

                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={regenerateCurrent} style={{ padding:'9px 18px', background:s.card, border:`1px solid ${s.border}`, borderRadius:8, color:s.text, fontSize:13, fontFamily:'inherit', cursor:'pointer' }}>Regenerate</button>
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
                  <div key={i} style={{ background:s.card, border:`1px solid ${r.status==='success'?s.border:'#4a1515'}`, borderRadius:10, overflow:'hidden' }}>
                    <div style={{ aspectRatio:'16/10', background:s.bg }}>
                      {(r.noBgUrl || r.mockupUrl) ? (
                        <img src={r.noBgUrl || r.mockupUrl} alt={r.name} style={{ width:'100%', height:'100%', objectFit:'contain' }} />
                      ) : r.rawImageUrl ? (
                        <img src={r.rawImageUrl} alt={r.name} style={{ width:'100%', height:'100%', objectFit:'contain', opacity:0.6 }} />
                      ) : (
                        <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#4b4b5b', fontSize:12 }}>Failed</div>
                      )}
                    </div>
                    <div style={{ padding:10 }}>
                      <div style={{ fontSize:13, fontWeight:500 }}>{r.name}</div>
                      <div style={{ fontSize:11, color:s.muted, marginTop:2 }}>{DEVICE_META[r.device]?.icon} {DEVICE_META[r.device]?.label}</div>
                      {r.mockupUrl && <a href={r.mockupUrl} target="_blank" rel="noopener" style={{ display:'inline-block', marginTop:8, padding:'5px 10px', background:s.accent, borderRadius:5, color:'white', fontSize:11, fontWeight:500, textDecoration:'none' }}>Download</a>}
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

// === CROP TOOL COMPONENT ===
function CropTool({ imageUrl, targetW, targetH, deviceLabel, onConfirm, onSkip, s }) {
  const containerRef = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  const previewW = 460;
  const previewH = previewW * (targetH / targetW);

  useEffect(() => {
    setLoading(true);
    const img = new Image();
    img.onload = () => {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const containerAspect = previewW / previewH;
      let dw, dh;
      if (imgAspect > containerAspect) {
        dh = previewH;
        dw = previewH * imgAspect;
      } else {
        dw = previewW;
        dh = previewW / imgAspect;
      }
      setImgSize({ w: dw, h: dh });
      setPos({ x: -(dw - previewW) / 2, y: -(dh - previewH) / 2 });
      setLoading(false);
    };
    img.src = imageUrl;
  }, [imageUrl, previewW, previewH]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y };
  };

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const newX = Math.min(0, Math.max(-(imgSize.w - previewW), dragStart.current.posX + dx));
    const newY = Math.min(0, Math.max(-(imgSize.h - previewH), dragStart.current.posY + dy));
    setPos({ x: newX, y: newY });
  }, [dragging, imgSize, previewW, previewH]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
      });

      const scaleX = img.naturalWidth / imgSize.w;
      const scaleY = img.naturalHeight / imgSize.h;
      const sx = -pos.x * scaleX;
      const sy = -pos.y * scaleY;
      const sw = previewW * scaleX;
      const sh = previewH * scaleY;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

      const base64 = canvas.toDataURL('image/png').split(',')[1];
      await onConfirm(base64);
    } catch (err) {
      console.error('Crop failed:', err);
    }
    setConfirming(false);
  };

  if (loading) return <div style={{ textAlign:'center', padding:'40px 0' }}><Spinner /><p style={{ color:s.muted, fontSize:13, marginTop:12 }}>Loading image for positioning...</p></div>;

  return (
    <div>
      <p style={{ fontSize:13, color:s.muted, marginBottom:12 }}>
        Drag the image to position it within the <strong style={{ color:s.text }}>{deviceLabel}</strong> screen. The visible area is what goes into the mockup.
      </p>

      <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          style={{
            width: previewW,
            height: previewH,
            overflow: 'hidden',
            position: 'relative',
            cursor: dragging ? 'grabbing' : 'grab',
            borderRadius: 8,
            border: `2px solid ${s.accent}`,
            background: s.bg,
          }}
        >
          <img
            src={imageUrl}
            alt="crop preview"
            draggable={false}
            style={{
              position: 'absolute',
              left: pos.x,
              top: pos.y,
              width: imgSize.w,
              height: imgSize.h,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          />
          {/* Corner labels */}
          <div style={{ position:'absolute', top:6, left:8, fontSize:10, color:s.accentLight, opacity:0.7 }}>{targetW}×{targetH}</div>
        </div>
      </div>

      <div style={{ display:'flex', gap:8 }}>
        <button onClick={onSkip} style={{ padding:'9px 18px', background:s.card, border:`1px solid ${s.border}`, borderRadius:8, color:s.muted, fontSize:13, fontFamily:'inherit', cursor:'pointer' }}>Skip (use original)</button>
        <button onClick={handleConfirm} disabled={confirming} style={{ flex:1, padding:'9px 18px', background:`linear-gradient(135deg,${s.accent},${s.accentLight})`, border:'none', borderRadius:8, color:'white', fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:confirming?'default':'pointer' }}>
          {confirming ? 'Cropping & uploading...' : 'Confirm Position →'}
        </button>
      </div>
    </div>
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
