# 📝 Content Editing Guide

This guide explains exactly where and how to modify your homepage content.

## 🎯 Quick Reference

| Want to Change | Edit This File | Section |
|---|---|---|
| **Name, Bio, Title** | `index.html` | Lines 21-23 |
| **Experiences** | `config.json` | `experiences` array |
| **Ongoing Project** | `config.json` | `ongoingProject` object |
| **Achievements** | `config.json` | `achievements` array |
| **Education** | `config.json` | `educations` array |
| **Publications** | `data/publications.json` | Add/edit entries |
| **Social Links** | `config.json` | `social` object |

## 📋 Step-by-Step Editing

### 1. Personal Information (Header)

**File**: `index.html` (lines 21-23)

```html
<h1 class="name">Taeyong Lee</h1>
<p class="title">Scholar & Developer</p>
<p class="bio">Your bio description here...</p>
```

### 2. Experiences Section

**File**: `config.json`

```json
"experiences": [
  {
    "title": "Current Position",
    "description": "What you're doing now"
  },
  {
    "title": "Previous Role",
    "description": "Previous position details"
  }
]
```

**Example**:
```json
"experiences": [
  {
    "title": "Postdoctoral Researcher",
    "description": "Mathematical modeling of infectious diseases at Seoul National University"
  },
  {
    "title": "PhD Student",
    "description": "Applied Mathematics with focus on epidemiological modeling"
  }
]
```

### 3. Ongoing Projects

**File**: `config.json`

```json
"ongoingProject": {
  "name": "Your Project Name",
  "progress": 85
}
```

**Example**:
```json
"ongoingProject": {
  "name": "COVID-19 Variant Transmission Modeling",
  "progress": 75
}
```

### 4. Achievements

**File**: `config.json`

```json
"achievements": [
  {
    "name": "Award/Grant Name",
    "period": "Year or Period",
    "where": "Organization/Institution"
  }
]
```

**Example**:
```json
"achievements": [
  {
    "name": "Outstanding Research Award",
    "period": "2024",
    "where": "Korean Mathematical Society"
  },
  {
    "name": "National Research Foundation Grant",
    "period": "2023-2025",
    "where": "NRF Korea"
  }
]
```

### 5. Education

**File**: `config.json`

```json
"educations": [
  {
    "degree": "PhD in Applied Mathematics",
    "university": "Seoul National University",
    "period": "2018-2024",
    "gpa": "4.0/4.0"
  }
]
```

### 6. Publications

**File**: `data/publications.json`

```json
{
  "date": "2024-01-15",
  "title": "Your Paper Title",
  "journal": "Journal Name",
  "link": "https://doi.org/10.xxxx/yyyy",
  "citations": 10,
  "thumbnail": "publications/your-paper.png",
  "summary": {
    "en": "English abstract...",
    "ko": "Korean abstract...",
    "fr": "French abstract..."
  }
}
```

**Adding a new publication**:
1. Add the JSON entry to the array
2. Place PDF file in `publications/` folder
3. Create thumbnail image (PNG, 80x80px recommended)

### 7. Social Links

**File**: `config.json`

```json
"social": {
  "github": "https://github.com/yourusername",
  "linkedin": "https://linkedin.com/in/yourprofile/",
  "googleScholar": "https://scholar.google.com/citations?user=YOURID"
}
```

## 🔄 After Making Changes

1. **Save the file**
2. **Refresh your browser** (Ctrl+F5 for hard refresh)
3. **Check the changes** appear correctly

## ⚠️ Important Notes

- **Backup before editing**: Always keep a copy of working files
- **Valid JSON**: Ensure your JSON syntax is correct (use a JSON validator)
- **File paths**: Make sure image paths in `publications/` are correct
- **Testing**: Test locally with `python -m http.server 8000`

## 🐛 Common Issues

**Problem**: Changes don't appear
- **Solution**: Hard refresh (Ctrl+F5) or clear browser cache

**Problem**: Page breaks after editing
- **Solution**: Check JSON syntax with [jsonlint.com](https://jsonlint.com)

**Problem**: Images don't load
- **Solution**: Verify file paths and ensure files exist in `publications/` folder

---

**Need more help?** Check the main README.md for additional guidance!