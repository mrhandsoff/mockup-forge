# MockupForge v2

AI-powered product mockup generator. Paste a product brief → Claude extracts components → fal.ai generates images → Mockuuups Studio renders them on real device frames.

## How It Works

1. You paste your full product description
2. Claude AI extracts every component (main product, bonuses, course modules, etc.)
3. Claude assigns each to a device type and writes image generation prompts
4. You review/edit the prompts and device assignments
5. fal.ai generates each image
6. Mockuuups Studio renders each image onto a professional device frame (iMac, MacBook, iPad, iPhone, Monitor)
7. You download finished device mockups

## Setup (15 minutes)

### Step 1: Get API Keys (5 min)

You need three API keys:

| Service | Where to get it | Cost |
|---------|----------------|------|
| **Anthropic** (Claude) | [console.anthropic.com](https://console.anthropic.com) → API Keys | Pay per use (~$0.01/extraction) |
| **fal.ai** (image gen) | [fal.ai](https://fal.ai) → Dashboard → Keys | Pay per use (~$0.01/image) |
| **Mockuuups Studio** | [mockuuups.studio/developers](https://mockuuups.studio/developers/) | Free tier: 50 credits. $50/mo for 500. |

### Step 2: Find Mockup IDs (5 min)

Browse [mockuuups.studio/mockup-generator](https://mockuuups.studio/mockup-generator/) and pick a scene for each device type:

- **Desktop/iMac**: [mockuuups.studio/mockup-generator/desktop](https://mockuuups.studio/mockup-generator/desktop/)
- **Laptop/MacBook**: [mockuuups.studio/mockup-generator/laptop](https://mockuuups.studio/mockup-generator/laptop/)
- **Tablet/iPad**: [mockuuups.studio/mockup-generator/tablet](https://mockuuups.studio/mockup-generator/tablet/)
- **Phone/iPhone**: [mockuuups.studio/mockup-generator/phone](https://mockuuups.studio/mockup-generator/phone/)

Click any mockup. The ID is in the URL: `mockuuups.studio/create/[THIS_IS_THE_ID]`

### Step 3: Deploy to Vercel (5 min)

```bash
# Extract and set up
tar -xzf mockup-forge.tar.gz
cd mockup-forge
npm install

# Test locally
cp .env.example .env.local
# Edit .env.local with your API keys and mockup IDs
npm run dev
# Visit http://localhost:3000

# Deploy
git init
git add .
git commit -m "MockupForge v2"
gh repo create mockup-forge --private --push
# Or push to GitHub manually, then import to Vercel
```

In Vercel, add these environment variables:

```
ANTHROPIC_API_KEY=sk-ant-...
FAL_API_KEY=...
MOCKUUUPS_API_KEY=...
MOCKUP_ID_IMAC=...
MOCKUP_ID_MACBOOK=...
MOCKUP_ID_IPAD=...
MOCKUP_ID_IPHONE=...
MOCKUP_ID_MONITOR=...
```

## Cost Per Run

A typical 6-component product run costs roughly:
- Claude extraction: ~$0.01
- 6 images via fal.ai: ~$0.06
- 6 mockup renders: 6 credits (1 credit = ~$0.10 on Start plan)
- **Total: ~$0.67 per product**

## Settings

The app has a Settings panel where you can change mockup IDs per device type without redeploying. But the initial IDs should be set via environment variables.

## Phase 2 (future)

Bundle layout composition — where individual device mockups get automatically arranged into multi-device bundle scenes. This requires designing 5 layout templates in a compositor tool and adding one final API call layer.
