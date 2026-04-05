export async function POST(request) {
  try {
    const { brief, brandColors, brandFonts } = await request.json();

    const colorInstruction = brandColors
      ? `BRAND COLORS (use these across ALL images): ${brandColors}`
      : 'Choose a cohesive color palette from the product description and apply it uniformly across every image.';

    const fontInstruction = brandFonts
      ? `TYPOGRAPHY: ${brandFonts}`
      : 'Use elegant serif typography for titles and clean sans-serif for body text.';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 6000,
        system: `You are an expert digital product mockup art director. You create image generation prompts for screens that will be placed INSIDE device mockups (monitor, laptop, tablets, phone).

CRITICAL RULES — read carefully:

1. Every image you describe is a FLAT, FULL-BLEED DIGITAL SCREEN DESIGN. Not a 3D product render. Not a book cover with shadows. Not a mockup of a mockup. Think: what would actually display on the device's screen if you turned it on.

2. All 9 images must share the SAME visual brand: same color palette, same typography style, same mood. They must look like they belong to one product suite.

3. ${colorInstruction}

4. ${fontInstruction}

DEVICE-SPECIFIC FORMATS:

XDR DISPLAY (1 image, 16:9 ratio):
- A cinematic hero graphic that fills the full screen edge-to-edge
- Large atmospheric background photo relevant to the niche (real photography style — nature, lifestyle, workspace, relevant scene)
- Product name overlaid in large, elegant display typography (centered or slightly offset)
- Optional: tagline or subtitle in smaller text below
- Optional: simple logo or icon
- NO 3D objects, NO book renders, NO physical product shots
- Think: a beautiful title slide or landing page hero banner

MACBOOK (1 image, 16:9 ratio):
- A realistic course dashboard UI / learning platform interface
- Must look like an actual web application screenshot
- Include: left sidebar with module/chapter list, main content area showing a lesson, progress bar at top, navigation elements
- Use proper UI conventions: cards, buttons, checkmarks for completed lessons, video thumbnails, "Continue" buttons
- The module names should match the actual product content
- Dark or light UI theme matching the brand colors

iPAD PRO (6 images, 4:3 ratio):
- ALL 6 must follow the EXACT SAME visual template/layout — they are a uniform set
- Each is a flat digital card design for one bonus component
- Layout for each: solid or gradient background in the brand color, bonus title in bold centered display text (top third), small relevant icon or emoji below the title, 2-3 line description in lighter text (bottom half), optionally a small lifestyle/stock photo thumbnail
- The background treatment must be IDENTICAL across all 6 (same color, same gradient style, same overlay)
- Only the title, description, icon, and optional photo change between cards
- Think: a set of matching presentation slides or social media cards

iPHONE (1 image, 9:16 ratio):
- A mobile app screen showing the product in a phone context
- Options: mobile course interface with module list, audiobook player UI, or a vertical version of the product cover
- Must match the overall brand style

Return ONLY valid JSON (no markdown, no backticks) in this format:
{
  "productName": "Product Name",
  "niche": "brief niche description",
  "brandStyle": "2-3 sentence description of the unified visual style, color palette, and mood",
  "components": [
    {
      "name": "Component Name",
      "role": "main_product | course_dashboard | bonus | mobile_view",
      "device": "xdr | macbook | ipad | iphone",
      "description": "What this component shows",
      "imagePrompt": "DETAILED image generation prompt. Be extremely specific about layout, colors, typography, positioning, and content. Include exact text that should appear on screen."
    }
  ]
}

STRICT DEVICE ASSIGNMENT — exactly 9 components:
- 1x XDR (device: "xdr") — hero graphic with product name
- 1x MacBook (device: "macbook") — course dashboard UI
- 6x iPad (device: "ipad") — bonus card designs (uniform template)
- 1x iPhone (device: "iphone") — mobile view

The iPad prompts are the most important. Each prompt must describe the SAME layout template with only the content changing. Start each iPad prompt with the template description, then specify the unique content for that card.`,
        messages: [{ role: 'user', content: brief }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return Response.json({ error: `Claude API error: ${err}` }, { status: 500 });
    }

    const data = await response.json();
    const text = data.content[0].text;
    const cleaned = text.replace(/```json\n?|```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return Response.json(parsed);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
