export async function POST(request) {
  try {
    const { prompt, aspectRatio } = await request.json();

    // Map aspect ratios to fal.ai image_size values
    const sizeMap = {
      '16:9': 'landscape_16_9',
      '4:3': 'landscape_4_3',
      '3:4': 'portrait_4_3',
      '9:16': 'portrait_16_9',
      '1:1': 'square',
    };

    const imageSize = sizeMap[aspectRatio] || 'landscape_16_9';

    // Submit to fal.ai queue
    const submitRes = await fetch('https://queue.fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${process.env.FAL_API_KEY}`,
      },
      body: JSON.stringify({
        prompt,
        image_size: imageSize,
        num_images: 1,
        num_inference_steps: 4,
        enable_safety_checker: false,
      }),
    });

    if (!submitRes.ok) {
      const err = await submitRes.text();
      return Response.json({ error: `fal.ai submit error: ${err}` }, { status: 500 });
    }

    const submitData = await submitRes.json();

    // If synchronous response with images
    if (submitData.images && submitData.images.length > 0) {
      return Response.json({ imageUrl: submitData.images[0].url });
    }

    // If queued, poll for result
    const requestId = submitData.request_id;
    if (!requestId) {
      return Response.json({ error: 'No request_id or images in response', raw: submitData }, { status: 500 });
    }

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 2000));
      attempts++;

      const statusRes = await fetch(
        `https://queue.fal.run/fal-ai/flux/schnell/requests/${requestId}/status`,
        {
          headers: { Authorization: `Key ${process.env.FAL_API_KEY}` },
        }
      );

      if (!statusRes.ok) continue;

      const statusData = await statusRes.json();

      if (statusData.status === 'COMPLETED') {
        // Fetch the result
        const resultRes = await fetch(
          `https://queue.fal.run/fal-ai/flux/schnell/requests/${requestId}`,
          {
            headers: { Authorization: `Key ${process.env.FAL_API_KEY}` },
          }
        );

        if (!resultRes.ok) {
          return Response.json({ error: 'Failed to fetch result' }, { status: 500 });
        }

        const resultData = await resultRes.json();
        if (resultData.images && resultData.images.length > 0) {
          return Response.json({ imageUrl: resultData.images[0].url });
        }
        return Response.json({ error: 'No images in result', raw: resultData }, { status: 500 });
      }

      if (statusData.status === 'FAILED') {
        return Response.json({ error: 'Image generation failed' }, { status: 500 });
      }
    }

    return Response.json({ error: 'Timeout waiting for image generation' }, { status: 504 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
