export const maxDuration = 60;

export async function POST(request) {
  try {
    const { imageUrl, mockupId, size } = await request.json();

    if (!mockupId) {
      return Response.json({ error: 'No mockupId provided' }, { status: 400 });
    }

    if (!process.env.MOCKUUUPS_API_KEY) {
      return Response.json({ error: 'MOCKUUUPS_API_KEY not configured' }, { status: 500 });
    }

    // Submit render
    const response = await fetch('https://api.mockuuups.studio/v1/renders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MOCKUUUPS_API_KEY}`,
      },
      body: JSON.stringify({
        mockup: mockupId,
        size: size || 1000,
        mode: 'async',
        destination: 'cdn',
        contents: [{ type: 'image', url: imageUrl }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return Response.json({ error: `Mockuuups POST error (${response.status}): ${err}` }, { status: response.status });
    }

    const postData = await response.json();

    // Try to find URL anywhere in the POST response
    const postUrl = findUrl(postData);
    if (postUrl) {
      return Response.json({ url: postUrl, source: 'post', raw: postData });
    }

    // If we got a render ID, poll — but only 15 times (30 sec)
    const renderId = postData.id || postData.render_id || postData.uuid;
    if (!renderId) {
      // No URL and no render ID — return raw so we can debug
      return Response.json({ url: null, error: 'No URL or render ID found', raw: postData });
    }

    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const pollRes = await fetch(`https://api.mockuuups.studio/v1/renders/${renderId}`, {
        headers: { Authorization: `Bearer ${process.env.MOCKUUUPS_API_KEY}` },
      });

      if (!pollRes.ok) continue;

      const pollData = await pollRes.json();
      const pollUrl = findUrl(pollData);

      if (pollUrl) {
        return Response.json({ url: pollUrl, source: 'poll', raw: pollData });
      }

      // Check for explicit failure
      const status = pollData.status || pollData.state;
      if (status === 'failed' || status === 'error') {
        return Response.json({ error: 'Render failed', raw: pollData }, { status: 500 });
      }
    }

    // Timed out — return last poll data so we can see the structure
    return Response.json({ url: null, error: 'Poll timeout — check raw for response format', raw: postData });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Recursively search for a URL in the response
function findUrl(obj) {
  if (!obj || typeof obj !== 'object') return null;

  // Check common URL field names
  const urlFields = ['url', 'image', 'download_url', 'image_url', 'mockup_url',
                     'cdn_url', 'render_url', 'file', 'src', 'href', 'link',
                     'download', 'thumbnail'];

  for (const field of urlFields) {
    if (obj[field] && typeof obj[field] === 'string' && obj[field].startsWith('http')) {
      return obj[field];
    }
  }

  // Check nested objects
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      const found = findUrl(obj[key]);
      if (found) return found;
    }
  }

  return null;
}