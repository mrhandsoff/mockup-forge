export const maxDuration = 60;

export async function POST(request) {
  try {
    const { imageUrl } = await request.json();

    if (!process.env.FAL_API_KEY) {
      return Response.json({ error: 'FAL_API_KEY not configured' }, { status: 500 });
    }

    // Try sync endpoint first — birefnet is fast
    const res = await fetch('https://fal.run/fal-ai/birefnet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${process.env.FAL_API_KEY}`,
      },
      body: JSON.stringify({
        image_url: imageUrl,
      }),
    });

    if (!res.ok) {
      // Fall back to queue if sync fails
      const queueRes = await fetch('https://queue.fal.run/fal-ai/birefnet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${process.env.FAL_API_KEY}`,
        },
        body: JSON.stringify({ image_url: imageUrl }),
      });

      if (!queueRes.ok) {
        const errText = await queueRes.text();
        return Response.json({ error: `BG removal failed: ${errText}` }, { status: 500 });
      }

      const queueData = await queueRes.json();

      if (queueData.image?.url) {
        return Response.json({ imageUrl: queueData.image.url });
      }

      const requestId = queueData.request_id;
      if (!requestId) {
        return Response.json({ error: 'No request_id', raw: queueData }, { status: 500 });
      }

      // Poll
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const statusRes = await fetch(
          `https://queue.fal.run/fal-ai/birefnet/requests/${requestId}/status`,
          { headers: { Authorization: `Key ${process.env.FAL_API_KEY}` } }
        );
        if (!statusRes.ok) continue;
        const statusData = await statusRes.json();

        if (statusData.status === 'COMPLETED') {
          const resultRes = await fetch(
            `https://queue.fal.run/fal-ai/birefnet/requests/${requestId}`,
            { headers: { Authorization: `Key ${process.env.FAL_API_KEY}` } }
          );
          const resultData = await resultRes.json();
          if (resultData.image?.url) {
            return Response.json({ imageUrl: resultData.image.url });
          }
          return Response.json({ error: 'No image in result', raw: resultData }, { status: 500 });
        }
        if (statusData.status === 'FAILED') {
          return Response.json({ error: 'BG removal failed' }, { status: 500 });
        }
      }
      return Response.json({ error: 'BG removal timeout' }, { status: 504 });
    }

    const data = await res.json();
    if (data.image?.url) {
      return Response.json({ imageUrl: data.image.url });
    }
    return Response.json({ error: 'No image in response', raw: data }, { status: 500 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
