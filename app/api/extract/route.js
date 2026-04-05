export async function POST(request) {
  try {
    const { brief } = await request.json();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `You are a product mockup planner. Given a product description, extract all components and assign each to a device type for mockup rendering.

Return ONLY valid JSON (no markdown, no backticks) in this exact format:
{
  "productName": "Product Name",
  "niche": "brief niche description",
  "components": [
    {
      "name": "Component Name",
      "role": "main_product | bonus | course_dashboard | sales_page | module | template | checklist | workbook",
      "device": "xdr | macbook | ipad | iphone",
      "description": "What this component is",
      "imagePrompt": "Detailed prompt for generating a product cover/screen image for this component. Include style, colors, text overlay suggestions, and visual elements. Make it professional and on-brand for the niche."
    }
  ]
}

STRICT DEVICE ASSIGNMENT — you must produce exactly 9 components using this layout:
- 1x Apple XDR display (device: "xdr") → The main product / hero front-end offer. This is the largest, most prominent device.
- 1x MacBook Pro (device: "macbook") → Course dashboard view, member area, or inside-the-product screen.
- 6x iPad Pro (device: "ipad") → Bonuses, guides, PDFs, ebooks, workbooks, templates, checklists. Spread across 6 iPads. If fewer than 6 bonuses exist, create additional relevant components (e.g. module preview, chapter spread, resource page, quick-start guide) to fill all 6 slots.
- 1x iPhone 17 (device: "iphone") → Smallest bonus, quick-reference card, checklist, or mobile view of the product.

Total: exactly 9 components. Always fill all 9 slots.

Generate detailed, specific image prompts that will produce professional product mockup screens. Each prompt should describe what would appear ON the device screen — like a product cover, a course dashboard UI, or an ebook cover page. Make prompts visually rich with specific colors, typography style, layout descriptions, and brand-appropriate imagery.`,
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
