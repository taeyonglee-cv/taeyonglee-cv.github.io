# 🚀 Getting Started

Quick guide to set up and customize your homepage.

## ⚡ Quick Start

1. **Run locally:**
   ```bash
   python -m http.server 8000
   # Visit: http://localhost:8000
   ```

2. **Edit content:**
   - Open `config.json` in any text editor
   - Make changes and save
   - Refresh browser to see updates

## 📝 First Customizations

### 1. Update Personal Info
Edit lines 21-23 in `index.html`:
```html
<h1 class="name">Your Name</h1>
<p class="title">Your Title</p>  
<p class="bio">Your bio description...</p>
```

### 2. Update Experience
Edit `config.json`:
```json
"experiences": [
  {
    "title": "Current Position",
    "description": "What you're doing now"
  }
]
```

### 3. Update Social Links
Edit `config.json`:
```json
"social": {
  "github": "https://github.com/yourusername",
  "linkedin": "https://linkedin.com/in/yourprofile",
  "googleScholar": "https://scholar.google.com/citations?user=YOURID"
}
```

## 🌐 Deploy to GitHub Pages

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Update homepage"
   git push origin main
   ```

2. **Enable GitHub Pages:**
   - Go to repository Settings
   - Scroll to Pages section
   - Select "Deploy from a branch"
   - Choose "main" branch
   - Your site will be at: `https://yourusername.github.io/repository-name`

## 📚 Adding Publications

1. **Add to `data/publications.json`:**
   ```json
   {
     "date": "2024-01-15",
     "title": "Your Paper Title",
     "journal": "Journal Name", 
     "link": "https://doi.org/...",
     "citations": 5,
     "thumbnail": "publications/paper.png",
     "summary": {
       "en": "English abstract...",
       "ko": "Korean abstract...",
       "fr": "French abstract..."
     }
   }
   ```

2. **Add files:**
   - Place PDF in `publications/` folder
   - Create thumbnail image (80x80px PNG)

## 🎨 Styling Changes

Edit `style.css` to customize:
- Colors (see `:root` variables)
- Fonts
- Layout spacing
- Component styling

## 🆘 Help

- **Changes not showing?** Hard refresh (Ctrl+F5)
- **JSON errors?** Check syntax at [jsonlint.com](https://jsonlint.com)
- **Need examples?** Check existing `config.json` and `data/publications.json`

---

**Ready to customize? Start with `config.json`!**