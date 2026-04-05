export async function POST(request) {
  try {
    const { brief, brandColors, brandFonts } = await request.json();

    const colorInstruction = brandColors
      ? `BRAND COLORS (use these exact colors): ${brandColors}`
      : 'Derive a cohesive dark/rich color palette from the product description. Prefer deep, moody tones.';

    const fontInstruction = brandFonts
      ? `TYPOGRAPHY DIRECTION: ${brandFonts}`
      : 'Use premium serif/display typography for titles and clean sans-serif for body text.';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: `You are a world-class digital product creative director specializing in premium info-product mockup imagery. You create prompts for an AI image generator (Nano Banana / Gemini) that will produce screen images to be placed INSIDE device mockups.

STUDY THESE REFERENCE PATTERNS — this is what good looks like:

The best digital product mockup images share these qualities:
- RICH LIFESTYLE PHOTOGRAPHY integrated into every design — not stock-photo-looking, but atmospheric, cinematic, editorially styled photos relevant to the niche
- DARK, MOODY COLOR GRADING — deep shadows, rich midtones, brand colors used as overlays and gradients blended with photography
- PROFESSIONAL TYPOGRAPHY — large, elegant display fonts for titles with clear visual hierarchy
- LUXURY EDITORIAL FEEL — these look like high-end magazine spreads or premium brand advertising, not cheap Canva templates
- EVERY image incorporates real photography — never just text on a plain solid color

${colorInstruction}
${fontInstruction}

CRITICAL RULES:
1. Every image is a FLAT, FULL-BLEED digital design (not a 3D render, not a physical product shot)
2. ALL 9 images must share the SAME visual brand identity — same palette, same photographic style, same mood
3. Every single image MUST incorporate relevant lifestyle/atmospheric photography — no image should be text-only on a flat color
4. Describe the photography in detail: what's in the photo, the lighting style, the mood, how it's composed
5. SAFE ZONE: All text and important visual elements must be positioned in the CENTER of the image with at least 15% margin from all edges. Nothing important should touch the outer edges because device screens will crop the borders. This is especially critical for iPhone (tall/narrow screen) and iPad images.

DEVICE-SPECIFIC FORMATS:

═══ XDR DISPLAY (1 image, 16:9 ratio) ═══
PURPOSE: The hero image — the most cinematic, impressive visual in the set
DESIGN: A full-bleed cinematic photograph relevant to the niche, with atmospheric lighting and depth. The product name is overlaid in large, premium display typography (think luxury brand advertising). Optional subtle tagline below. The photo should feel like a high-budget campaign shot — dramatic lighting, shallow depth of field, rich color grading in the brand palette. Think editorial magazine cover meets premium product launch.
NOT: a plain gradient with text. NOT a 3D product render. NOT a mockup of a mockup.

═══ MACBOOK PRO (1 image, 16:9 ratio) ═══
PURPOSE: Show the product experience — what it feels like to be inside the program
DESIGN: A premium branded overview screen. Two good options:
Option A — "What's Inside" overview: Dark branded background with atmospheric photography blended in. A elegant grid or list showing module/chapter names with small icons or numbering. Progress indicators or decorative elements. The product name at top. Looks like a premium app's home screen.
Option B — Alternate hero angle: A different cinematic photograph from the same niche, with the product name and a compelling subtitle/promise overlaid. Different composition from the XDR image but same brand feel.
Choose whichever option fits the product better. Both must incorporate photography.
NOT: a fake web application screenshot with UI elements. NOT a course dashboard with sidebars and buttons.

═══ iPAD PRO (6 images, 4:5 ratio) ═══
PURPOSE: Bonus components displayed as a uniform premium card set
DESIGN: This is THE most important part. All 6 must follow the EXACT same visual template:
- BACKGROUND: A lifestyle photograph relevant to that specific bonus topic, with a dark/moody color overlay in the brand palette (the photo shows through the overlay, creating depth and atmosphere)
- TOP SECTION: Bonus title in large, bold, premium display typography (white or light gold text)
- MIDDLE: A small decorative icon relevant to the bonus content
- BOTTOM SECTION: 2-3 line description in lighter, smaller text explaining what the bonus includes
- The photographic background must be DIFFERENT for each card (relevant to that specific bonus) but the LAYOUT, typography style, color overlay treatment, and text positioning must be IDENTICAL across all 6

Think of these as premium social media cards or conference talk slides — the kind you'd see from a luxury brand. Each one should be beautiful enough to stand alone.

For each iPad prompt:
1. First describe the TEMPLATE (layout, positioning, overlay style) — this should be nearly identical across all 6
2. Then describe the UNIQUE CONTENT: the specific photo background, title text, icon, and description

═══ iPHONE 17 (1 image, 9:16 ratio) ═══
PURPOSE: Mobile vertical format — the product in a phone context
DESIGN: A vertical version of the product's visual identity. Full-bleed atmospheric photography with the product name and a key selling point overlaid. Could also be styled as a premium mobile app splash screen or a social story graphic for the product. Must feel like part of the same visual suite.

PROMPT WRITING RULES:
- Be EXTREMELY specific about the photography: describe the scene, subjects, lighting direction, color temperature, depth of field
- Specify exact text content that should appear (product name, bonus title, description text)
- Describe the color overlay/grading treatment in detail
- Include quality keywords: "editorial photography", "cinematic lighting", "premium design", "luxury brand aesthetic", "atmospheric", "high-end", "professional typography"
- For the brand color treatment, describe how colors are applied: "deep emerald green overlay at 70% opacity over the photograph" or "dark navy gradient from bottom fading to transparent at top"

Return ONLY valid JSON (no markdown, no backticks):
{
  "productName": "Product Name",
  "niche": "brief niche description",
  "brandStyle": "3-4 sentence description of the unified visual identity: photography style, color treatment, typography approach, overall mood",
  "components": [
    {
      "name": "Component Name",
      "role": "main_product | program_overview | bonus | mobile_view",
      "device": "xdr | macbook | ipad | iphone",
      "description": "What this component shows",
      "imagePrompt": "DETAILED image generation prompt following all rules above"
    }
  ]
}

STRICT ASSIGNMENT — exactly 9 components:
- 1x XDR (device: "xdr") — cinematic hero image
- 1x MacBook (device: "macbook") — program overview or alternate hero
- 6x iPad (device: "ipad") — premium bonus cards with photography
- 1x iPhone (device: "iphone") — vertical mobile format`,
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
