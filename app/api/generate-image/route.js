export const maxDuration = 120;

export async function POST(request) {
  try {
    const { prompt, aspectRatio } = await request.json();

    if (!process.env.FAL_API_KEY) {
      return Response.json({ error: 'FAL_API_KEY not configured' }, { status: 500 });
    }

    const ratioMap = {
      '16:9': '16:9',
      '4:5': '4:5',
      '3:4': '3:4',
      '9:16': '9:16',
      '1:1': '1:1',
    };

    const ar = ratioMap[aspectRatio] || '16:9';

    // Submit to Nano Banana 2 queue
    const submitRes = await fetch('https://queue.fal.run/fal-ai/nano-banana-2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${process.env.FAL_API_KEY}`,
      },
      body: JSON.stringify({
        prompt,
        num_images: 1,
        aspect_ratio: ar,
        output_format: 'png',
      }),
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      return Response.json({ error: `fal.ai submit error (${submitRes.status}): ${errText}` }, { status: 500 });
    }

    const submitData = await submitRes.json();

    if (submitData.images && submitData.images.length > 0) {
      return Response.json({ imageUrl: submitData.images[0].url });
    }

    const requestId = submitData.request_id;
    if (!requestId) {
      return Response.json({ error: 'No request_id returned', raw: submitData }, { status: 500 });
    }

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 90;

    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 2000));
      attempts++;

      const statusRes = await fetch(
        `https://queue.fal.run/fal-ai/nano-banana-2/requests/${requestId}/status`,
        { headers: { Authorization: `Key ${process.env.FAL_API_KEY}` } }
      );

      if (!statusRes.ok) continue;
      const statusData = await statusRes.json();

      if (statusData.status === 'COMPLETED') {
        const resultRes = await fetch(
          `https://queue.fal.run/fal-ai/nano-banana-2/requests/${requestId}`,
          { headers: { Authorization: `Key ${process.env.FAL_API_KEY}` } }
        );

        if (!resultRes.ok) {
          const errText = await resultRes.text();
          return Response.json({ error: `Result fetch failed: ${errText}` }, { status: 500 });
        }

        const resultData = await resultRes.json();
        if (resultData.images && resultData.images.length > 0) {
          return Response.json({ imageUrl: resultData.images[0].url });
        }
        return Response.json({ error: 'No images in result' }, { status: 500 });
      }

      if (statusData.status === 'FAILED') {
        return Response.json({ error: 'Image generation failed' }, { status: 500 });
      }
    }

    return Response.json({ error: 'Timeout' }, { status: 504 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}