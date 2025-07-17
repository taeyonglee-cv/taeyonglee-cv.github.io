# Taeyong Lee Homepage - Setup Guide

This document describes how to maintain and update Taeyong Lee's personal academic homepage.

## 🚀 Quick Update Workflow

### For New Publications:
1. **Add PDF files** to `publications/` directory
2. **Run extraction**: `npm run extract-pdfs`
3. **Enhance abstracts**: `npm run enhance-abstracts`  
4. **Update citations**: `npm run update-citations`
5. **Deploy**: Git commit and push to trigger GitHub Pages

### For Citation Updates Only:
```bash
npm run update-citations
```

### For Abstract Re-enhancement:
```bash
npm run enhance-abstracts
```

## 🔧 System Requirements

### Environment Setup:
```bash
npm install                    # Install dependencies
```

### API Keys (Optional - for abstract enhancement):
Create `.env` file:
```
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
```

### Configuration:
The `config.json` contains Taeyong's profile settings:
- Google Scholar ID: `B6KrOaoAAAAJ`
- Social links and contact information
- Homepage metadata

## 📊 Data Pipeline

### 1. PDF Extraction (`scripts/pdf-abstracts.js`)
- Extracts metadata from PDF files in `publications/`
- Prioritizes "Published online" dates
- Prevents duplicate processing
- Outputs to `data/publications.json`

### 2. AI Enhancement (`scripts/llm-abstracts.js`)
- Generates multilingual abstracts (EN/KO/FR)
- Uses few-shot prompting with domain examples
- Enhances Korean translation quality
- Adds structured multilingual summaries

### 3. Citation Tracking (`scripts/scholar-citation-crawler.js`)
- Fetches from Google Scholar profile: B6KrOaoAAAAJ
- Matches papers by title similarity
- Updates citation counts in real-time
- Provides citation trend analysis

## 🔍 Verification

Run system health check:
```bash
npm run verify
```

This checks:
- All PDFs are processed
- All publications have enhanced abstracts
- Citation data is current
- No data integrity issues

## 📦 Deployment

### GitHub Pages Setup:
1. Repository: `taeyonglee-cv/taeyonglee-cv.github.io`
2. GitHub Actions automatically deploy on push to main
3. Homepage URL: `https://taeyonglee-cv.github.io`

### Manual Deployment:
```bash
npm run deploy    # Full pipeline + commit ready
```

## 🚨 Troubleshooting

### Common Issues:

**PDF not processing:**
- Check file is in `publications/` directory
- Ensure PDF is readable and not corrupted
- Run `npm run extract-pdfs` again

**Citations not updating:**
- Verify Google Scholar profile ID in config.json
- Check Scholar profile is public
- Run `npm run update-citations` manually

**Korean translation issues:**
- Run `npm run enhance-abstracts` to re-process
- Check API key availability in .env

### File Structure Check:
```
✅ index.html, app.js, style.css (homepage)
✅ data/publications.json (107 citations total)
✅ publications/*.pdf (7 research papers)  
✅ config.json (Taeyong's profile)
✅ .github/workflows/deploy.yml (auto-deployment)
```

---

*Maintenance guide for Taeyong Lee's academic homepage system*