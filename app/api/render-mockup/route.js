export async function POST(request) {
  try {
    const { imageUrl, mockupId, size } = await request.json();

    if (!mockupId) {
      return Response.json({ error: 'No mockupId provided' }, { status: 400 });
    }

    if (!process.env.MOCKUUUPS_API_KEY) {
      return Response.json({ error: 'MOCKUUUPS_API_KEY not configured' }, { status: 500 });
    }

    // Submit render request
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
        contents: [
          {
            type: 'image',
            url: imageUrl,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return Response.json(
        { error: `Mockuuups API error (${response.status}): ${err}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // If we got a direct URL back, return it
    if (data.url || data.image || data.download_url) {
      return Response.json({
        url: data.url || data.image || data.download_url,
        thumbnail: data.thumbnail || null,
        raw: data,
      });
    }

    // If async with a render ID, poll for completion
    if (data.id || data.render_id) {
      const renderId = data.id || data.render_id;
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2000));
        attempts++;

        const pollRes = await fetch(`https://api.mockuuups.studio/v1/renders/${renderId}`, {
          headers: {
            Authorization: `Bearer ${process.env.MOCKUUUPS_API_KEY}`,
          },
        });

        if (!pollRes.ok) continue;

        const pollData = await pollRes.json();

        if (pollData.url || pollData.image || pollData.download_url) {
          return Response.json({
            url: pollData.url || pollData.image || pollData.download_url,
            thumbnail: pollData.thumbnail || null,
            raw: pollData,
          });
        }

        if (pollData.status === 'failed' || pollData.status === 'error') {
          return Response.json({ error: 'Mockup render failed' }, { status: 500 });
        }
      }

      return Response.json({ error: 'Timeout waiting for mockup render' }, { status: 504 });
    }

    // Fallback: return whatever we got
    return Response.json({
      url: null,
      raw: data,
      error: 'Unexpected response format — check Mockuuups API docs',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
