import { put } from '@vercel/blob';

export async function POST(request) {
  try {
    const { base64, filename } = await request.json();

    if (!base64) {
      return Response.json({ error: 'No image data provided' }, { status: 400 });
    }

    const buffer = Buffer.from(base64, 'base64');
    const name = filename || `cropped-${Date.now()}.png`;

    const blob = await put(name, buffer, {
      access: 'public',
      contentType: 'image/jpeg',
    });

    return Response.json({ url: blob.url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
