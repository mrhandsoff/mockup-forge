export const maxDuration = 60;

export async function POST(request) {
  try {
    const { imageUrl, mockupId, size } = await request.json();

    if (!mockupId) return Response.json({ error: 'No mockupId' }, { status: 400 });
    if (!process.env.MOCKUUUPS_API_KEY) return Response.json({ error: 'No API key' }, { status: 500 });

    const response = await fetch('https://api.mockuuups.studio/v1/renders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MOCKUUUPS_API_KEY}`,
      },
      body: JSON.stringify({
        mockup: mockupId,
        size: size || 1000,
        mode: 'sync',
        destination: 'cdn',
        contents: [{ type: 'image', url: imageUrl }],
      }),
    });

    const text = await response.text();
    console.log('Mockuuups raw response:', response.status, text);

    if (!response.ok) {
      return Response.json({ error: `Mockuuups ${response.status}: ${text}` }, { status: response.status });
    }

    let data;
    try { data = JSON.parse(text); } catch(e) {
      return Response.json({ error: 'Invalid JSON from Mockuuups', raw: text.slice(0, 500) }, { status: 500 });
    }

    // Find URL anywhere in response
    const url = findUrl(data);
    return Response.json({ url, raw: data });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function findUrl(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const fields = ['url','image','download_url','image_url','mockup_url','cdn_url','render_url','file','src','href','link','download','thumbnail'];
  for (const f of fields) {
    if (obj[f] && typeof obj[f] === 'string' && obj[f].startsWith('http')) return obj[f];
  }
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      const found = findUrl(obj[key]);
      if (found) return found;
    }
  }
  return null;
}