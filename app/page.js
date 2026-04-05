'use client';

import { useState, useCallback, useEffect } from 'react';

const DEVICE_META = {
  xdr: { label: 'Apple XDR', icon: '🖥️', aspect: '16:9' },
  macbook: { label: 'MacBook Pro', icon: '💻', aspect: '16:9' },
  ipad: { label: 'iPad Pro', icon: '📱', aspect: '4:3' },
  iphone: { label: 'iPhone 17', icon: '📲', aspect: '9:16' },
};

const DEFAULT_MOCKUP_IDS = {
  xdr: 'X7PbdxQKSQEqm43S',
  macbook: 'XtWDyavzoAIcEXk2',
  ipad: 'adJ1edpIJk5GYceN',
  iphone: 'aMfKiv4O0AF5oGLE',
};

export default function Home() {
  // State
  const [brief, setBrief] = useState('');
  const [components, setComponents] = useState(null);
  const [productName, setProductName] = useState('');
  const [phase, setPhase] = useState('input'); // input | planning | review | generating | done
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0, step: '' });
  const [mockupIds, setMockupIds] = useState(DEFAULT_MOCKUP_IDS);
  const [showSettings, setShowSettings] = useState(false);
  const [results, setResults] = useState([]);

  // Load mockup IDs from env vars on mount
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

  // Step 1: Extract components from brief
  const handleExtract = useCallback(async () => {
    if (!brief.trim()) return;
    setError('');
    setPhase('planning');

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Extraction failed');
      }

      const data = await res.json();
      setProductName(data.productName || 'Untitled Product');
      setComponents(data.components || []);
      setPhase('review');
    } catch (err) {
      setError(err.message);
      setPhase('input');
    }
  }, [brief]);

  // Update a component
  const updateComponent = (index, field, value) => {
    setComponents((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Remove a component
  const removeComponent = (index) => {
    setComponents((prev) => prev.filter((_, i) => i !== index));
  };

  // Step 2+3: Generate images and render mockups
  const handleGenerate = useCallback(async () => {
    // Check if mockup IDs are configured
    const devicesUsed = [...new Set(components.map((c) => c.device))];
    const missingIds = devicesUsed.filter((d) => !mockupIds[d]);
    if (missingIds.length > 0) {
      setError(
        `Missing Mockuuups IDs for: ${missingIds.map((d) => DEVICE_META[d].label).join(', ')}. Open Settings to configure.`
      );
      return;
    }

    setError('');
    setPhase('generating');
    setResults([]);
    const total = components.length;
    const newResults = [];

    for (let i = 0; i < total; i++) {
      const comp = components[i];

      // Generate image
      setProgress({ current: i + 1, total, step: `Generating image: ${comp.name}` });

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
          const errData = await imgRes.json();
          newResults.push({
            ...comp,
            status: 'error',
            error: `Image gen failed: ${errData.error}`,
          });
          setResults([...newResults]);
          continue;
        }

        const imgData = await imgRes.json();
        const imageUrl = imgData.imageUrl;

        // Render mockup
        setProgress({ current: i + 1, total, step: `Rendering mockup: ${comp.name}` });

        const mockRes = await fetch('/api/render-mockup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl,
            mockupId: mockupIds[comp.device],
            size: 1000,
          }),
        });

        if (!mockRes.ok) {
          const errData = await mockRes.json();
          newResults.push({
            ...comp,
            status: 'partial',
            rawImageUrl: imageUrl,
            error: `Mockup render failed: ${errData.error}`,
          });
          setResults([...newResults]);
          continue;
        }

        const mockData = await mockRes.json();
        newResults.push({
          ...comp,
          status: mockData.url ? 'success' : 'partial',
          rawImageUrl: imageUrl,
          mockupUrl: mockData.url || null,
          error: mockData.url ? null : (mockData.error || 'No mockup URL returned'),
          mockupData: mockData,
        });
        setResults([...newResults]);
      } catch (err) {
        newResults.push({ ...comp, status: 'error', error: err.message });
        setResults([...newResults]);
      }
    }

    setPhase('done');
  }, [components, mockupIds]);

  // Reset
  const handleReset = () => {
    setBrief('');
    setComponents(null);
    setProductName('');
    setPhase('input');
    setError('');
    setResults([]);
    setProgress({ current: 0, total: 0, step: '' });
  };

  return (
    <>
      <style jsx global>{`
        *,
        *::before,
        *::after {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'DM Sans', sans-serif;
          background: #0a0a0f;
          color: #e8e6e3;
          min-height: 100vh;
          -webkit-font-smoothing: antialiased;
        }
        ::selection {
          background: #6c5ce7;
          color: white;
        }
      `}</style>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px' }}>
        {/* Header */}
        <header style={{ marginBottom: 48, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                background: 'linear-gradient(135deg, #a29bfe, #6c5ce7)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              MockupForge
            </h1>
            <p style={{ color: '#6b6b7b', marginTop: 4, fontSize: 14 }}>
              Paste a product brief → get professional device mockups
            </p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              background: showSettings ? '#6c5ce7' : '#1a1a2e',
              border: '1px solid #2a2a3e',
              color: '#e8e6e3',
              padding: '8px 16px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          >
            ⚙ Settings
          </button>
        </header>

        {/* Settings Panel */}
        {showSettings && (
          <div
            style={{
              background: '#12121e',
              border: '1px solid #2a2a3e',
              borderRadius: 12,
              padding: 24,
              marginBottom: 32,
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
              Mockuuups Studio — Device Mockup IDs
            </h3>
            <p style={{ fontSize: 13, color: '#6b6b7b', marginBottom: 16, lineHeight: 1.6 }}>
              Browse{' '}
              <a href="https://mockuuups.studio/mockup-generator/" target="_blank" rel="noopener" style={{ color: '#a29bfe' }}>
                mockuuups.studio/mockup-generator
              </a>{' '}
              to find mockup scenes you like. Click any mockup to open it. The mockup ID is the short code in the URL
              (e.g., from <code style={{ fontFamily: 'JetBrains Mono', fontSize: 12, background: '#1a1a2e', padding: '2px 6px', borderRadius: 4 }}>
                /create/YXpoZdyRLAKQHgQA
              </code> the ID is <code style={{ fontFamily: 'JetBrains Mono', fontSize: 12, background: '#1a1a2e', padding: '2px 6px', borderRadius: 4 }}>YXpoZdyRLAKQHgQA</code>).
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {Object.entries(DEVICE_META).map(([key, meta]) => (
                <div key={key}>
                  <label style={{ fontSize: 13, color: '#8b8b9b', display: 'block', marginBottom: 4 }}>
                    {meta.icon} {meta.label} Mockup ID
                  </label>
                  <input
                    type="text"
                    value={mockupIds[key]}
                    onChange={(e) => setMockupIds((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder="e.g. YXpoZdyRLAKQHgQA"
                    style={{
                      width: '100%',
                      background: '#0a0a0f',
                      border: '1px solid #2a2a3e',
                      color: '#e8e6e3',
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontFamily: 'JetBrains Mono',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: '#4b4b5b', marginTop: 12 }}>
              Tip: Use the category links — Phone, Tablet, Laptop, Desktop — to find the right scene per device type.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              background: '#1e0a0a',
              border: '1px solid #4a1515',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 24,
              color: '#f87171',
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {/* Phase: Input */}
        {phase === 'input' && (
          <div>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder={`Paste your full product description here...\n\nExample:\nThe AI Hifz Method is a comprehensive Quran memorization system. The main product is a 9-module course with video lessons and interactive exercises. Bonuses include:\n- The AI Tajweed Mastery Guide (PDF)\n- The AI Quran Study Companion (workbook)\n- The AI Hifz Accelerator Program (advanced training)\n- The AI Hifz Review Vault (review schedule system)`}
              style={{
                width: '100%',
                minHeight: 240,
                background: '#12121e',
                border: '1px solid #2a2a3e',
                color: '#e8e6e3',
                padding: 20,
                borderRadius: 12,
                fontSize: 15,
                fontFamily: 'inherit',
                lineHeight: 1.7,
                resize: 'vertical',
                outline: 'none',
              }}
            />
            <button
              onClick={handleExtract}
              disabled={!brief.trim()}
              style={{
                marginTop: 16,
                width: '100%',
                padding: '14px 24px',
                background: brief.trim() ? 'linear-gradient(135deg, #6c5ce7, #a29bfe)' : '#1a1a2e',
                border: 'none',
                borderRadius: 10,
                color: brief.trim() ? 'white' : '#4b4b5b',
                fontSize: 16,
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: brief.trim() ? 'pointer' : 'default',
                letterSpacing: '-0.01em',
              }}
            >
              Analyze Product Brief →
            </button>
          </div>
        )}

        {/* Phase: Planning (loading) */}
        {phase === 'planning' && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div
              style={{
                width: 40,
                height: 40,
                border: '3px solid #2a2a3e',
                borderTopColor: '#6c5ce7',
                borderRadius: '50%',
                margin: '0 auto 20px',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <p style={{ color: '#8b8b9b', fontSize: 15 }}>Analyzing your product brief with Claude...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* Phase: Review */}
        {phase === 'review' && components && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 600 }}>{productName}</h2>
              <p style={{ color: '#6b6b7b', fontSize: 14, marginTop: 4 }}>
                {components.length} components identified. Edit prompts or device assignments, then generate.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {components.map((comp, i) => (
                <div
                  key={i}
                  style={{
                    background: '#12121e',
                    border: '1px solid #2a2a3e',
                    borderRadius: 12,
                    padding: 20,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{comp.name}</div>
                      <div style={{ fontSize: 13, color: '#6b6b7b', marginTop: 2 }}>
                        {comp.role?.replace(/_/g, ' ')} · {comp.description}
                      </div>
                    </div>
                    <button
                      onClick={() => removeComponent(i)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#4b4b5b',
                        cursor: 'pointer',
                        fontSize: 18,
                        padding: '0 4px',
                      }}
                    >
                      ×
                    </button>
                  </div>

                  {/* Device selector */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                    {Object.entries(DEVICE_META).map(([key, meta]) => (
                      <button
                        key={key}
                        onClick={() => updateComponent(i, 'device', key)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 6,
                          border: '1px solid',
                          borderColor: comp.device === key ? '#6c5ce7' : '#2a2a3e',
                          background: comp.device === key ? '#6c5ce720' : 'transparent',
                          color: comp.device === key ? '#a29bfe' : '#6b6b7b',
                          fontSize: 12,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {meta.icon} {meta.label}
                      </button>
                    ))}
                  </div>

                  {/* Prompt editor */}
                  <textarea
                    value={comp.imagePrompt}
                    onChange={(e) => updateComponent(i, 'imagePrompt', e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: 80,
                      background: '#0a0a0f',
                      border: '1px solid #1a1a2e',
                      color: '#c8c6c3',
                      padding: 12,
                      borderRadius: 8,
                      fontSize: 13,
                      fontFamily: 'inherit',
                      lineHeight: 1.5,
                      resize: 'vertical',
                      outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                onClick={handleReset}
                style={{
                  padding: '12px 24px',
                  background: '#1a1a2e',
                  border: '1px solid #2a2a3e',
                  borderRadius: 10,
                  color: '#8b8b9b',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                ← Start Over
              </button>
              <button
                onClick={handleGenerate}
                style={{
                  flex: 1,
                  padding: '14px 24px',
                  background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
                  border: 'none',
                  borderRadius: 10,
                  color: 'white',
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  letterSpacing: '-0.01em',
                }}
              >
                Generate All Mockups →
              </button>
            </div>
          </div>
        )}

        {/* Phase: Generating */}
        {phase === 'generating' && (
          <div>
            <div style={{ marginBottom: 32, textAlign: 'center' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  border: '3px solid #2a2a3e',
                  borderTopColor: '#6c5ce7',
                  borderRadius: '50%',
                  margin: '0 auto 16px',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <p style={{ fontSize: 15, fontWeight: 500 }}>
                {progress.current} / {progress.total}
              </p>
              <p style={{ fontSize: 13, color: '#6b6b7b', marginTop: 4 }}>{progress.step}</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>

            {/* Show results as they come in */}
            {results.length > 0 && <ResultsGrid results={results} />}
          </div>
        )}

        {/* Phase: Done */}
        {phase === 'done' && (
          <div>
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 600 }}>{productName} — Mockups</h2>
                <p style={{ color: '#6b6b7b', fontSize: 14, marginTop: 4 }}>
                  {results.filter((r) => r.status === 'success').length} of {results.length} mockups rendered
                  successfully
                </p>
              </div>
              <button
                onClick={handleReset}
                style={{
                  padding: '10px 20px',
                  background: '#1a1a2e',
                  border: '1px solid #2a2a3e',
                  borderRadius: 8,
                  color: '#8b8b9b',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                New Product
              </button>
            </div>

            <ResultsGrid results={results} />
          </div>
        )}
      </div>
    </>
  );
}

function ResultsGrid({ results }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
      {results.map((r, i) => (
        <div
          key={i}
          style={{
            background: '#12121e',
            border: '1px solid',
            borderColor: r.status === 'success' ? '#2a2a3e' : r.status === 'partial' ? '#4a3515' : '#4a1515',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {/* Image */}
          <div style={{ aspectRatio: '16/10', background: '#0a0a0f', position: 'relative' }}>
            {r.status === 'success' && r.mockupUrl ? (
              <img
                src={r.mockupUrl}
                alt={r.name}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : r.status === 'partial' && r.rawImageUrl ? (
              <img
                src={r.rawImageUrl}
                alt={r.name}
                style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.7 }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#4b4b5b',
                  fontSize: 14,
                }}
              >
                Failed
              </div>
            )}

            {/* Status badge */}
            <div
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                padding: '3px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 500,
                background:
                  r.status === 'success' ? '#10b98120' : r.status === 'partial' ? '#f59e0b20' : '#ef444420',
                color: r.status === 'success' ? '#10b981' : r.status === 'partial' ? '#f59e0b' : '#ef4444',
              }}
            >
              {r.status === 'success' ? 'Done' : r.status === 'partial' ? 'Raw only' : 'Error'}
            </div>
          </div>

          {/* Info */}
          <div style={{ padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{r.name}</div>
            <div style={{ fontSize: 12, color: '#6b6b7b', marginTop: 2 }}>
              {DEVICE_META[r.device]?.icon} {DEVICE_META[r.device]?.label} · {r.role?.replace(/_/g, ' ')}
            </div>

            {r.error && (
              <div style={{ fontSize: 11, color: '#f87171', marginTop: 6, lineHeight: 1.4 }}>{r.error}</div>
            )}

            {/* Download links */}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {r.mockupUrl && (
                <a
                  href={r.mockupUrl}
                  target="_blank"
                  rel="noopener"
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    background: '#6c5ce7',
                    borderRadius: 6,
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 500,
                    textDecoration: 'none',
                    textAlign: 'center',
                  }}
                >
                  Download Mockup
                </a>
              )}
              {r.rawImageUrl && (
                <a
                  href={r.rawImageUrl}
                  target="_blank"
                  rel="noopener"
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    background: '#1a1a2e',
                    border: '1px solid #2a2a3e',
                    borderRadius: 6,
                    color: '#8b8b9b',
                    fontSize: 12,
                    textDecoration: 'none',
                    textAlign: 'center',
                  }}
                >
                  Raw Image
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
