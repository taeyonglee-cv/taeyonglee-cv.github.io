const fs = require('fs');
const path = require('path');
const https = require('https');
const pdfParse = require('pdf-parse');

class PDFAbstractGenerator {
    constructor() {
        this.publicationsDir = path.join(__dirname, '..', 'publications');
        this.outputFile = path.join(__dirname, '..', 'data', 'publications.json');
        this.envFile = path.join(__dirname, '..', '.env');
        this.loadEnvVariables();
        
        this.services = {
            anthropic: {
                name: 'Anthropic Claude',
                endpoint: 'https://api.anthropic.com/v1/messages',
                model: 'claude-3-haiku-20240307',
                envVar: 'ANTHROPIC_API_KEY'
            },
            openai: {
                name: 'OpenAI GPT',
                endpoint: 'https://api.openai.com/v1/chat/completions',
                model: 'gpt-3.5-turbo',
                envVar: 'OPENAI_API_KEY'
            }
        };
    }

    loadEnvVariables() {
        try {
            if (fs.existsSync(this.envFile)) {
                const envContent = fs.readFileSync(this.envFile, 'utf8');
                envContent.split('\n').forEach(line => {
                    line = line.trim();
                    if (!line || line.startsWith('#')) return;
                    
                    const equalIndex = line.indexOf('=');
                    if (equalIndex > 0) {
                        const key = line.substring(0, equalIndex).trim();
                        const value = line.substring(equalIndex + 1).trim().replace(/^["']|["']$/g, '');
                        if (key && value) {
                            process.env[key] = value;
                        }
                    }
                });
            }
        } catch (error) {
            console.warn('⚠️ Could not load .env file:', error.message);
        }
    }

    detectAvailableService() {
        console.log('🔍 Checking available LLM services:');
        
        for (const [key, service] of Object.entries(this.services)) {
            const hasKey = service.envVar && process.env[service.envVar];
            console.log(`   ${key}: ${service.envVar} = ${hasKey ? 'FOUND' : 'NOT FOUND'}`);
            
            if (hasKey) {
                console.log(`🎯 Selected service: ${key}`);
                return { key, service };
            }
        }
        
        console.log('❌ No LLM service available');
        return null;
    }

    async extractPDFContent(pdfPath, correctionPath = null) {
        try {
            const dataBuffer = fs.readFileSync(pdfPath);
            const data = await pdfParse(dataBuffer);
            
            let correctionData = null;
            if (correctionPath && fs.existsSync(correctionPath)) {
                const correctionBuffer = fs.readFileSync(correctionPath);
                correctionData = await pdfParse(correctionBuffer);
            }
            
            const text = data.text;
            const lines = text.split('\n').filter(line => line.trim().length > 0);
            
            // Enhanced title extraction
            let title = this.extractTitle(lines, text);
            
            // Extract journal name
            let journal = this.extractJournal(lines, text);
            
            // Extract publication date with better patterns
            let publicationDate = this.extractPublicationDateEnhanced(lines, text);
            
            // Enhanced abstract extraction
            let abstractText = this.extractAbstractEnhanced(lines, text);
            
            // Extract quantitative results from Results/Conclusion sections
            let quantitativeResults = this.extractQuantitativeResults(lines, text);
            
            // Extract statistical findings (percentages, numbers, p-values, etc.)
            let statisticalFindings = this.extractStatisticalFindings(text);
            
            // Extract results from tables and figures
            let tableResults = this.extractTableResults(text);
            
            // Extract DOI from PDF
            let doi = this.extractDOI(lines, text);
            
            // Combine with correction data if available
            let correctionText = '';
            if (correctionData) {
                correctionText = correctionData.text;
                console.log('📝 Including correction data');
            }
            
            return {
                title: title || path.basename(pdfPath, '.pdf'),
                journal: journal || 'Unknown Journal',
                publicationDate: publicationDate || '2024-01-01',
                abstract: abstractText.trim(),
                quantitativeResults: quantitativeResults.trim(),
                statisticalFindings: statisticalFindings,
                tableResults: tableResults,
                doi: doi,
                correctionText: correctionText,
                fullText: text.substring(0, 5000), // Increased context
                rawText: text // Keep full text for comprehensive analysis
            };
        } catch (error) {
            console.error(`❌ Error extracting PDF ${pdfPath}:`, error.message);
            return null;
        }
    }

    extractTitle(lines, fullText) {
        // Clean and prepare lines
        const cleanedLines = lines.map(line => line.trim()).filter(line => line.length > 0);
        
        // Known journal names to skip
        const journalNames = [
            'mathematics and computers in simulation',
            'scientific reports',
            'human vaccines',
            'immunotherapeutics',
            'plos one',
            'chaos, solitons',
            'mathematical biosciences',
            'aimspress',
            'elsevier',
            'springer',
            'wiley',
            'nature',
            'science'
        ];
        
        // Skip patterns
        const skipPatterns = [
            /^doi:/i,
            /^issn/i,
            /^volume/i,
            /^number/i,
            /^page/i,
            /^pp\./i,
            /^published/i,
            /^received/i,
            /^accepted/i,
            /^available online/i,
            /^contents lists/i,
            /^sciencedirect/i,
            /^http[s]?:\/\//i,
            /^www\./i,
            /^©/i,
            /^\d{4}/i,
            /^\|/i,
            /^research article/i,
            /^original article/i,
            /^article/i,
            /^abstract/i,
            /^keywords/i,
            /^introduction/i,
            /^methods/i,
            /^author/i,
            /^corresponding/i,
            /^email/i,
            /^affiliation/i,
            /^department/i,
            /^university/i,
            /^college/i,
            /^school/i,
            /received.*accepted/i,
            /accepted.*published/i,
            /^\d{1,2}\s+\w+\s+\d{4}/i,
            /contents.*available/i,
            /science.*direct/i,
            /mathematics.*computers/i
        ];
        
        const titleCandidates = [];
        
        // Strategy 1: Look for title-like lines in first 30 lines
        for (let i = 0; i < Math.min(30, cleanedLines.length); i++) {
            const line = cleanedLines[i];
            const lowerLine = line.toLowerCase();
            
            // Skip if too short or too long
            if (line.length < 25 || line.length > 300) continue;
            
            // Skip if matches skip patterns
            if (skipPatterns.some(pattern => pattern.test(line))) continue;
            
            // Skip if contains journal names
            if (journalNames.some(journal => lowerLine.includes(journal))) continue;
            
            // Skip if looks like metadata
            if (lowerLine.includes('journal') || lowerLine.includes('volume') || 
                lowerLine.includes('number') || lowerLine.includes('page') ||
                lowerLine.includes('doi') || lowerLine.includes('issn') ||
                lowerLine.includes('published') || lowerLine.includes('received') ||
                lowerLine.includes('accepted') || lowerLine.includes('available') ||
                lowerLine.includes('contents') || lowerLine.includes('sciencedirect') ||
                lowerLine.includes('aims') || lowerLine.includes('springer') ||
                lowerLine.includes('elsevier') || lowerLine.includes('wiley')) continue;
            
            // Skip if mostly numbers or special characters
            const alphaCount = (line.match(/[a-zA-Z]/g) || []).length;
            if (alphaCount < line.length * 0.6) continue;
            
            // Look for title characteristics
            const hasCapitalizedWords = /[A-Z][a-z]/.test(line);
            const hasMultipleWords = line.split(/\s+/).length >= 4;
            const endsWithPeriod = line.endsWith('.');
            
            if (hasCapitalizedWords && hasMultipleWords && !endsWithPeriod) {
                titleCandidates.push({
                    text: line,
                    score: this.calculateTitleScore(line, i),
                    position: i
                });
            }
        }
        
        // Strategy 2: Look for multi-line titles
        for (let i = 0; i < Math.min(25, cleanedLines.length - 1); i++) {
            const line1 = cleanedLines[i];
            const line2 = cleanedLines[i + 1];
            
            if (line1.length > 20 && line2.length > 20 && 
                !line1.toLowerCase().includes('journal') && 
                !line2.toLowerCase().includes('journal')) {
                
                const combined = `${line1} ${line2}`;
                if (combined.length > 30 && combined.length < 250) {
                    titleCandidates.push({
                        text: combined,
                        score: this.calculateTitleScore(combined, i) + 10, // Bonus for multi-line
                        position: i
                    });
                }
            }
        }
        
        // Strategy 3: Look for text after specific keywords
        const afterKeywords = ['research article', 'original article', 'article'];
        for (let i = 0; i < Math.min(20, cleanedLines.length); i++) {
            const line = cleanedLines[i].toLowerCase();
            
            if (afterKeywords.some(keyword => line.includes(keyword))) {
                for (let j = i + 1; j < Math.min(i + 5, cleanedLines.length); j++) {
                    const candidate = cleanedLines[j];
                    if (candidate.length > 30 && candidate.length < 250) {
                        titleCandidates.push({
                            text: candidate,
                            score: this.calculateTitleScore(candidate, j) + 5,
                            position: j
                        });
                    }
                }
            }
        }
        
        // Sort by score and return best candidate
        titleCandidates.sort((a, b) => b.score - a.score);
        
        if (titleCandidates.length > 0) {
            let title = this.cleanTitle(titleCandidates[0].text);
            
            // If still looks like spaced text, try to fix it more aggressively
            if (title.includes(' a ') || title.includes(' i ') || title.includes(' o ')) {
                title = this.fixSpacedText(title);
            }
            
            return title;
        }
        
        return '';
    }
    
    calculateTitleScore(text, position) {
        let score = 0;
        
        // Prefer earlier positions
        score += Math.max(0, 50 - position * 2);
        
        // Prefer certain length ranges
        if (text.length >= 50 && text.length <= 150) score += 20;
        if (text.length >= 30 && text.length <= 200) score += 10;
        
        // Prefer proper capitalization
        if (/^[A-Z]/.test(text)) score += 10;
        if (/[A-Z][a-z]/.test(text)) score += 5;
        
        // Prefer academic words
        const academicWords = ['effect', 'impact', 'analysis', 'study', 'model', 'evaluation', 
                             'assessment', 'investigation', 'research', 'application', 'method',
                             'approach', 'development', 'implementation', 'optimization', 'control'];
        academicWords.forEach(word => {
            if (text.toLowerCase().includes(word)) score += 3;
        });
        
        // Prefer medical/scientific terms
        const scientificTerms = ['covid', 'virus', 'vaccination', 'disease', 'transmission', 
                               'mathematical', 'statistical', 'clinical', 'epidemiological'];
        scientificTerms.forEach(term => {
            if (text.toLowerCase().includes(term)) score += 5;
        });
        
        // Penalize if looks like metadata
        if (text.toLowerCase().includes('journal') || 
            text.toLowerCase().includes('volume') ||
            text.toLowerCase().includes('doi') ||
            text.toLowerCase().includes('issn')) score -= 30;
        
        // Penalize if mostly numbers
        const numberCount = (text.match(/\d/g) || []).length;
        if (numberCount > text.length * 0.3) score -= 20;
        
        return score;
    }
    
    fixSpacedText(title) {
        // More aggressive fix for PDFs with single-character spacing
        // This handles cases like "e s t i m a t i n g" -> "estimating"
        
        // Split into words and process each word
        const words = title.split(' ');
        const fixedWords = [];
        
        for (let i = 0; i < words.length; i++) {
            let word = words[i];
            
            // If this is a single character and the next few are also single chars, combine them
            if (word.length === 1 && i < words.length - 1) {
                let combined = word;
                let j = i + 1;
                
                // Look ahead for more single characters
                while (j < words.length && words[j].length === 1) {
                    combined += words[j];
                    j++;
                }
                
                // If we combined multiple single chars, use the combined version
                if (combined.length > 1) {
                    fixedWords.push(combined);
                    i = j - 1; // Skip the chars we just combined
                } else {
                    fixedWords.push(word);
                }
            } else {
                fixedWords.push(word);
            }
        }
        
        return fixedWords.join(' ');
    }

    cleanTitle(title) {
        // Remove extra spaces and fix common issues
        title = title.replace(/\s+/g, ' ').trim();
        
        // Fix PDF parsing spacing issues (common problem where single chars are separated by spaces)
        title = title.replace(/\b([a-z])\s+([a-z])\s+([a-z])\s+([a-z])\b/gi, '$1$2$3$4');
        title = title.replace(/\b([a-z])\s+([a-z])\s+([a-z])\b/gi, '$1$2$3');
        title = title.replace(/\b([a-z])\s+([a-z])\b/gi, '$1$2');
        
        // Fix specific spaced patterns
        title = title.replace(/c\s+o\s+n\s+t\s+e\s+n\s+t\s+s/gi, 'contents');
        title = title.replace(/l\s+i\s+s\s+t\s+s/gi, 'lists');
        title = title.replace(/a\s+v\s+a\s+i\s+l\s+a\s+b\s+l\s+e/gi, 'available');
        title = title.replace(/s\s+c\s+i\s+e\s+n\s+c\s+e/gi, 'science');
        title = title.replace(/d\s+i\s+r\s+e\s+c\s+t/gi, 'direct');
        title = title.replace(/m\s+a\s+t\s+h\s+e\s+m\s+a\s+t\s+i\s+c\s+s/gi, 'mathematics');
        title = title.replace(/c\s+o\s+m\s+p\s+u\s+t\s+e\s+r\s+s/gi, 'computers');
        title = title.replace(/s\s+i\s+m\s+u\s+l\s+a\s+t\s+i\s+o\s+n/gi, 'simulation');
        title = title.replace(/e\s+s\s+t\s+i\s+m\s+a\s+t\s+i\s+n\s+g/gi, 'estimating');
        title = title.replace(/b\s+a\s+s\s+i\s+c/gi, 'basic');
        title = title.replace(/r\s+e\s+p\s+r\s+o\s+d\s+u\s+c\s+t\s+i\s+v\s+e/gi, 'reproductive');
        title = title.replace(/v\s+a\s+r\s+i\s+c\s+e\s+l\s+l\s+a/gi, 'varicella');
        title = title.replace(/k\s+o\s+r\s+e\s+a/gi, 'korea');
        title = title.replace(/i\s+n\s+c\s+o\s+r\s+p\s+o\s+r\s+a\s+t\s+i\s+n\s+g/gi, 'incorporating');
        title = title.replace(/s\s+o\s+c\s+i\s+a\s+l/gi, 'social');
        title = title.replace(/c\s+o\s+n\s+t\s+a\s+c\s+t/gi, 'contact');
        title = title.replace(/p\s+a\s+t\s+t\s+e\s+r\s+n\s+s/gi, 'patterns');
        title = title.replace(/s\s+e\s+r\s+o\s+p\s+r\s+e\s+v\s+a\s+l\s+e\s+n\s+c\s+e/gi, 'seroprevalence');
        title = title.replace(/e\s+f\s+f\s+e\s+c\s+t/gi, 'effect');
        title = title.replace(/c\s+o\s+n\s+t\s+r\s+o\s+l/gi, 'control');
        title = title.replace(/m\s+e\s+a\s+s\s+u\s+r\s+e\s+s/gi, 'measures');
        title = title.replace(/t\s+r\s+a\s+n\s+s\s+m\s+i\s+s\s+s\s+i\s+o\s+n/gi, 'transmission');
        title = title.replace(/m\s+a\s+t\s+h\s+e\s+m\s+a\s+t\s+i\s+c\s+a\s+l/gi, 'mathematical');
        title = title.replace(/m\s+o\s+d\s+e\s+l/gi, 'model');
        title = title.replace(/t\s+e\s+r\s+t\s+i\s+a\s+r\s+y/gi, 'tertiary');
        title = title.replace(/h\s+o\s+s\s+p\s+i\s+t\s+a\s+l/gi, 'hospital');
        title = title.replace(/a\s+s\s+s\s+e\s+s\s+s\s+m\s+e\s+n\s+t/gi, 'assessment');
        title = title.replace(/i\s+n\s+t\s+e\s+r\s+v\s+e\s+n\s+t\s+i\s+o\s+n/gi, 'intervention');
        title = title.replace(/s\s+t\s+r\s+a\s+t\s+e\s+g\s+i\s+e\s+s/gi, 'strategies');
        title = title.replace(/p\s+r\s+e\s+d\s+i\s+c\s+t\s+i\s+o\s+n/gi, 'prediction');
        title = title.replace(/e\s+f\s+f\s+e\s+c\s+t\s+i\s+v\s+e\s+n\s+e\s+s\s+s/gi, 'effectiveness');
        title = title.replace(/u\s+n\s+i\s+v\s+e\s+r\s+s\s+a\s+l/gi, 'universal');
        title = title.replace(/r\s+o\s+t\s+a\s+v\s+i\s+r\s+u\s+s/gi, 'rotavirus');
        title = title.replace(/v\s+a\s+c\s+c\s+i\s+n\s+a\s+t\s+i\s+o\s+n/gi, 'vaccination');
        title = title.replace(/i\s+m\s+p\s+a\s+c\s+t/gi, 'impact');
        title = title.replace(/i\s+n\s+c\s+i\s+d\s+e\s+n\s+c\s+e/gi, 'incidence');
        title = title.replace(/h\s+e\s+r\s+p\s+e\s+s/gi, 'herpes');
        title = title.replace(/z\s+o\s+s\s+t\s+e\s+r/gi, 'zoster');
        title = title.replace(/u\s+s\s+i\s+n\s+g/gi, 'using');
        title = title.replace(/c\s+h\s+a\s+n\s+g\s+i\s+n\s+g/gi, 'changing');
        title = title.replace(/p\s+o\s+p\s+u\s+l\s+a\s+t\s+i\s+o\s+n/gi, 'population');
        title = title.replace(/d\s+e\s+m\s+o\s+g\s+r\s+a\s+p\s+h\s+i\s+c\s+s/gi, 'demographics');
        
        // Fix common concatenation issues - more comprehensive
        title = title.replace(/([a-z])([A-Z])/g, '$1 $2');
        title = title.replace(/([a-z])(\d)/g, '$1 $2');
        title = title.replace(/(\d)([A-Z])/g, '$1 $2');
        
        // Fix specific common concatenations
        title = title.replace(/([a-z])(of|on|in|and|the|a|an|to|for|with|by|at|is|as|or|but|not|from|this|that|these|those|which|who|what|when|where|why|how|COVID|SARS|RNA|DNA|HIV|TB|USA|UK|EU|US|vs|vs\.|etc|i\.e\.|e\.g\.)/gi, '$1 $2');
        title = title.replace(/(of|on|in|and|the|a|an|to|for|with|by|at|is|as|or|but|not|from|this|that|these|those|which|who|what|when|where|why|how|COVID|SARS|RNA|DNA|HIV|TB|USA|UK|EU|US|vs|vs\.|etc|i\.e\.|e\.g\.)([A-Z])/gi, '$1 $2');
        
        // Fix specific problematic patterns
        title = title.replace(/effectof/gi, 'effect of');
        title = title.replace(/modelof/gi, 'model of');
        title = title.replace(/impactof/gi, 'impact of');
        title = title.replace(/analysisof/gi, 'analysis of');
        title = title.replace(/studyof/gi, 'study of');
        title = title.replace(/transmissionin/gi, 'transmission in');
        title = title.replace(/vaccinationon/gi, 'vaccination on');
        title = title.replace(/measureson/gi, 'measures on');
        title = title.replace(/controlmeasures/gi, 'control measures');
        title = title.replace(/hospitaland/gi, 'hospital and');
        title = title.replace(/tertiaryhospital/gi, 'tertiary hospital');
        title = title.replace(/SouthKorea/gi, 'South Korea');
        title = title.replace(/COVID-19/gi, 'COVID-19');
        title = title.replace(/varicellaand/gi, 'varicella and');
        title = title.replace(/zosterincidence/gi, 'zoster incidence');
        title = title.replace(/mathematicalmodel/gi, 'mathematical model');
        title = title.replace(/using.*mathematical.*model.*with/gi, 'using a mathematical model with');
        
        // Remove common prefixes/suffixes
        title = title.replace(/^(The|A|An)\s+/i, '');
        title = title.replace(/\s+\|\s*$/, '');
        title = title.replace(/\s*\(\d{4}\)\s*$/, '');
        title = title.replace(/\s*\.\s*$/, '');
        
        // Remove metadata patterns
        title = title.replace(/^contents\s+lists\s+available\s+at\s+science\s+direct\s*/i, '');
        title = title.replace(/^received:.*accepted:.*$/i, '');
        title = title.replace(/^\d{1,2}\s+\w+\s+\d{4}.*$/i, '');
        
        // Clean up extra spaces again
        title = title.replace(/\s+/g, ' ').trim();
        
        // Fix repeated words
        title = title.replace(/\b(\w+)\s+\1\b/gi, '$1');
        
        // Capitalize first letter
        if (title.length > 0) {
            title = title.charAt(0).toUpperCase() + title.slice(1);
        }
        
        return title;
    }

    extractJournal(lines, fullText) {
        // Common journal patterns
        const journalPatterns = [
            /journal of ([^\\n]+)/i,
            /published in ([^\\n]+)/i,
            /([^\\n]*journal[^\\n]*)/i,
            /([^\\n]*reports[^\\n]*)/i,
            /plos one/i,
            /nature/i,
            /science/i,
            /mathematical biosciences/i,
            /human vaccines/i,
            /scientific reports/i
        ];
        
        // Look in first 10 lines for journal name
        for (let i = 0; i < Math.min(10, lines.length); i++) {
            const line = lines[i];
            
            // Direct journal name detection
            if (line.toLowerCase().includes('plos one')) return 'PLOS ONE';
            if (line.toLowerCase().includes('scientific reports')) return 'Scientific Reports';
            if (line.toLowerCase().includes('mathematical biosciences')) return 'Mathematical Biosciences and Engineering';
            if (line.toLowerCase().includes('human vaccines')) return 'Human Vaccines & Immunotherapeutics';
            if (line.toLowerCase().includes('chaos, solitons')) return 'Chaos, Solitons & Fractals';
            
            for (const pattern of journalPatterns) {
                const match = line.match(pattern);
                if (match) {
                    return match[1] || match[0];
                }
            }
        }
        
        // Check filename patterns
        const filename = path.basename(this.currentFile, '.pdf');
        if (filename.includes('journal.pone')) return 'PLOS ONE';
        if (filename.includes('s41598')) return 'Scientific Reports';
        if (filename.includes('10.3934_mbe')) return 'Mathematical Biosciences and Engineering';
        
        return 'Unknown Journal';
    }

    extractPublicationDate(lines, fullText) {
        // Date patterns
        const datePatterns = [
            /published[^\\n]*([0-9]{1,2}[\\s]*[a-zA-Z]+[\\s]*[0-9]{4})/i,
            /received[^\\n]*([0-9]{1,2}[\\s]*[a-zA-Z]+[\\s]*[0-9]{4})/i,
            /accepted[^\\n]*([0-9]{1,2}[\\s]*[a-zA-Z]+[\\s]*[0-9]{4})/i,
            /([0-9]{1,2}[\\s]*[a-zA-Z]+[\\s]*[0-9]{4})/,
            /([0-9]{4})/
        ];
        
        // Look in first 20 lines for publication date
        for (let i = 0; i < Math.min(20, lines.length); i++) {
            const line = lines[i];
            
            for (const pattern of datePatterns) {
                const match = line.match(pattern);
                if (match) {
                    const dateStr = match[1] || match[0];
                    const year = dateStr.match(/[0-9]{4}/);
                    if (year && parseInt(year[0]) >= 2020 && parseInt(year[0]) <= 2024) {
                        return this.formatDate(dateStr);
                    }
                }
            }
        }
        
        // Check filename for date clues
        const filename = path.basename(this.currentFile, '.pdf');
        const yearMatch = filename.match(/20[0-9]{2}/);
        if (yearMatch) {
            return `${yearMatch[0]}-01-01`;
        }
        
        return '2024-01-01';
    }

    formatDate(dateStr) {
        const months = {
            'january': '01', 'february': '02', 'march': '03', 'april': '04',
            'may': '05', 'june': '06', 'july': '07', 'august': '08',
            'september': '09', 'october': '10', 'november': '11', 'december': '12',
            'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
            'jun': '06', 'jul': '07', 'aug': '08', 'sep': '09',
            'oct': '10', 'nov': '11', 'dec': '12'
        };
        
        const yearMatch = dateStr.match(/[0-9]{4}/);
        if (!yearMatch) return '2024-01-01';
        
        const year = yearMatch[0];
        const monthMatch = dateStr.toLowerCase().match(/[a-zA-Z]+/);
        
        if (monthMatch) {
            const month = months[monthMatch[0].toLowerCase()] || '01';
            return `${year}-${month}-01`;
        }
        
        return `${year}-01-01`;
    }

    extractAbstract(lines) {
        let abstractText = '';
        let abstractStart = -1;
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes('abstract')) {
                abstractStart = i;
                break;
            }
        }
        
        if (abstractStart >= 0) {
            for (let i = abstractStart + 1; i < Math.min(abstractStart + 20, lines.length); i++) {
                if (lines[i].toLowerCase().includes('introduction') || 
                    lines[i].toLowerCase().includes('keywords') ||
                    lines[i].toLowerCase().includes('1.') ||
                    lines[i].toLowerCase().includes('method')) {
                    break;
                }
                abstractText += lines[i] + ' ';
            }
        }
        
        return abstractText;
    }

    extractKeyFindings(lines) {
        let keyFindings = '';
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes('conclusion') || 
                lines[i].toLowerCase().includes('results') ||
                lines[i].toLowerCase().includes('findings')) {
                for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
                    keyFindings += lines[j] + ' ';
                }
                break;
            }
        }
        
        return keyFindings;
    }

    async generateAbstractFromPDF(pdfContent, serviceInfo) {
        const { service } = serviceInfo;
        const apiKey = process.env[service.envVar];
        
        const prompt = `Based on this academic paper content, create a concise, engaging abstract (75-100 words MAX):

Title: "${pdfContent.title}"

Original Abstract: "${pdfContent.abstract}"

Key Findings/Conclusions: "${pdfContent.keyFindings}"

Full Context: "${pdfContent.fullText.substring(0, 1500)}"

${pdfContent.correctionText ? `Correction Information: "${pdfContent.correctionText.substring(0, 500)}"` : ''}

Write a punchy, accessible abstract that:
• Starts with the KEY FINDING or IMPACT (what the research discovered)
• Uses SIMPLE, CLEAR language - avoid jargon
• Sounds NATURAL and CONVERSATIONAL while staying professional
• Shows CONCRETE RESULTS and REAL-WORLD IMPACT
• VARIES in structure (don't always start the same way)
• If correction info is provided, incorporate any important corrections

AVOID these overused phrases:
- "Groundbreaking findings reveal"
- "Rigorous mathematical modeling"
- "This study demonstrates"
- "By leveraging sophisticated"

Instead, be DIRECT and ENGAGING:
- "We found that..."
- "This research shows..."
- "Our analysis reveals..."
- "The results demonstrate..."

Abstract:`;

        if (service.endpoint.includes('anthropic')) {
            return await this.generateWithAnthropic(prompt, service, apiKey);
        } else {
            return await this.generateWithOpenAI(prompt, service, apiKey);
        }
    }

    async generateWithAnthropic(prompt, service, apiKey) {
        const requestData = JSON.stringify({
            model: service.model,
            max_tokens: 200,
            messages: [{ role: "user", content: prompt }]
        });

        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.anthropic.com',
                port: 443,
                path: '/v1/messages',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Length': Buffer.byteLength(requestData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.content && response.content[0]) {
                            resolve(response.content[0].text.trim());
                        } else {
                            reject(new Error('Unexpected Anthropic API response format'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', reject);
            req.write(requestData);
            req.end();
        });
    }

    async generateWithOpenAI(prompt, service, apiKey) {
        const requestData = JSON.stringify({
            model: service.model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 200,
            temperature: 0.7
        });

        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.openai.com',
                port: 443,
                path: '/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Length': Buffer.byteLength(requestData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.choices && response.choices[0]) {
                            resolve(response.choices[0].message.content.trim());
                        } else {
                            reject(new Error('Unexpected OpenAI API response format'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', reject);
            req.write(requestData);
            req.end();
        });
    }

    loadExistingPublications() {
        try {
            if (fs.existsSync(this.outputFile)) {
                return JSON.parse(fs.readFileSync(this.outputFile, 'utf8'));
            }
        } catch (error) {
            console.warn('⚠️ Could not load existing publications:', error.message);
        }
        return [];
    }

    isPDFAlreadyProcessed(pdfFileName, existingPublications) {
        return existingPublications.some(pub => pub.pdf_file === pdfFileName);
    }

    async processPDFs() {
        console.log('📚 PDF Abstract Generator');
        console.log('========================');
        
        const serviceInfo = this.detectAvailableService();
        if (!serviceInfo) {
            console.log('❌ No LLM service available. Please set up API keys.');
            return;
        }
        
        console.log(`🎯 Using ${serviceInfo.service.name} for enhancement`);
        
        // Load existing publications to avoid reprocessing
        const existingPublications = this.loadExistingPublications();
        console.log(`📋 Found ${existingPublications.length} existing publications`);
        
        const allPdfFiles = fs.readdirSync(this.publicationsDir)
            .filter(file => file.endsWith('.pdf') && !file.includes('_correction'));
        
        // Filter out already processed PDFs
        const newPdfFiles = allPdfFiles.filter(pdfFile => {
            const isProcessed = this.isPDFAlreadyProcessed(pdfFile, existingPublications);
            if (isProcessed) {
                console.log(`⏭️ Skipping already processed: "${pdfFile}"`);
                return false;
            }
            return true;
        });
        
        console.log(`📚 Found ${allPdfFiles.length} total PDFs, processing ${newPdfFiles.length} new ones`);
        
        if (newPdfFiles.length === 0) {
            console.log('✅ All PDFs already processed! No new extractions needed.');
            return;
        }
        
        const newPublications = [];
        
        for (let i = 0; i < newPdfFiles.length; i++) {
            const pdfFile = newPdfFiles[i];
            const pdfPath = path.join(this.publicationsDir, pdfFile);
            this.currentFile = pdfPath; // Store for journal extraction
            
            console.log(`\n📖 Processing ${i + 1}/${newPdfFiles.length}`);
            console.log(`🔄 Extracting: "${pdfFile}"`);
            
            try {
                // FAILSAFE: Double-check this PDF hasn't been processed
                if (this.isPDFAlreadyProcessed(pdfFile, existingPublications)) {
                    console.error(`🚨 CRITICAL ERROR: Attempting to process already existing PDF: ${pdfFile}`);
                    console.error('🛑 TERMINATING to prevent duplicate processing and token waste');
                    process.exit(1);
                }

                // Check for correction file
                let correctionPath = null;
                if (pdfFile.includes('journal.pone.0249262')) {
                    correctionPath = path.join(this.publicationsDir, 'journal.pone.0253685_correction.pdf');
                    console.log('🔍 Looking for correction file...');
                    if (fs.existsSync(correctionPath)) {
                        console.log('📝 Found correction file');
                    }
                }
                
                const pdfContent = await this.extractPDFContent(pdfPath, correctionPath);
                if (!pdfContent) {
                    console.log('❌ Failed to extract PDF content');
                    continue;
                }
                
                console.log(`📄 Raw Title: "${pdfContent.title.substring(0, 60)}..."`);
                console.log(`📰 Raw Journal: "${pdfContent.journal}"`);
                console.log(`📅 Date: "${pdfContent.publicationDate}"`);
                console.log('🤖 Enhancing title and journal with LLM...');
                
                // Use LLM to enhance title, journal, and date extraction
                const enhancedInfo = await this.enhanceTitleJournalAndDate(pdfContent, serviceInfo);
                pdfContent.title = enhancedInfo.title || pdfContent.title;
                pdfContent.journal = enhancedInfo.journal || pdfContent.journal;
                pdfContent.publicationDate = enhancedInfo.publicationDate || pdfContent.publicationDate;
                
                console.log(`✨ Enhanced Title: "${pdfContent.title.substring(0, 60)}..."`);
                console.log(`✨ Enhanced Journal: "${pdfContent.journal}"`);
                console.log(`✨ Enhanced Date: "${pdfContent.publicationDate}"`);
                console.log('🤖 Generating factual abstract from extracted content...');
                
                const abstract = await this.generateFactualAbstractFromPDF(pdfContent, serviceInfo);
                
                const publication = {
                    date: pdfContent.publicationDate,
                    title: pdfContent.title,
                    journal: pdfContent.journal,
                    link: pdfContent.doi || `./publications/${pdfFile}`,
                    citations: 0,
                    summary: {
                        en: abstract,
                        ko: `[한국어] ${abstract}`,
                        fr: `[Français] ${abstract}`
                    },
                    thumbnail: `./publications/${path.basename(pdfFile, '.pdf')}.png`,
                    fetched_at: new Date().toISOString(),
                    enhanced_at: new Date().toISOString(),
                    pdf_file: pdfFile,
                    formatted_date: this.formatDateForDisplay(pdfContent.publicationDate)
                };
                
                newPublications.push(publication);
                console.log('✅ Generated abstract');
                
                // Rate limiting
                if (i < newPdfFiles.length - 1) {
                    console.log('⏱️ Waiting to avoid rate limits...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
            } catch (error) {
                console.error(`❌ Error processing ${pdfFile}:`, error.message);
            }
        }
        
        // Combine existing publications with new ones
        const allPublications = [...existingPublications, ...newPublications];
        
        // Save to file
        console.log('\n💾 Saving publications...');
        fs.writeFileSync(this.outputFile, JSON.stringify(allPublications, null, 2));
        console.log(`✅ Saved ${allPublications.length} total publications (${newPublications.length} new) to ${this.outputFile}`);
        
        console.log('\n🎉 PDF processing completed!');
        console.log('📈 Results:');
        console.log(`   • ${newPublications.length} new publications processed`);
        console.log(`   • ${allPublications.length} total publications in database`);
        console.log('   • Proper titles, journals, and dates extracted');
        console.log('   • Correction files handled');
        console.log('   • Ready for homepage display');
    }

    extractDateRelevantText(fullText) {
        // Extract text that might contain publication dates - prioritize "Published online" patterns
        const datePatterns = [
            // Highest priority: Published online patterns
            /published online:?\s*\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/gi,
            /published online:?\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi,
            /published online:?\s*\d{4}[\/\-\s]\d{1,2}[\/\-\s]\d{1,2}/gi,
            /published online:?\s*\d{1,2}[\/\-\s]\d{1,2}[\/\-\s]\d{4}/gi,
            /published online:?[^.]*?\d{4}/gi,
            
            // Other publication patterns
            /available online:?[^.]*?\d{4}/gi,
            /received:?[^.]*?\d{4}/gi,
            /accepted:?[^.]*?\d{4}/gi,
            /published:?[^.]*?\d{4}/gi,
            /first published:?[^.]*?\d{4}/gi,
            /publication date:?[^.]*?\d{4}/gi,
            /copyright.*?\d{4}/gi,
            /\d{4}.*?published/gi,
            
            // Generic date patterns
            /\b\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi,
            /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
            /\d{1,2}[\/\-\s]\d{1,2}[\/\-\s]\d{4}/gi,
            /\d{4}[\/\-\s]\d{1,2}[\/\-\s]\d{1,2}/gi
        ];
        
        let dateText = '';
        for (const pattern of datePatterns) {
            const matches = fullText.match(pattern);
            if (matches) {
                dateText += matches.join('\n') + '\n';
            }
        }
        
        // Also get the last 1000 characters where publication info often appears
        const lastPart = fullText.substring(Math.max(0, fullText.length - 1000));
        
        return dateText + '\n\nLast part of document:\n' + lastPart;
    }

    async enhanceTitleJournalAndDate(pdfContent, serviceInfo) {
        const { service } = serviceInfo;
        const apiKey = process.env[service.envVar];
        
        // Search for publication date patterns in the full text
        const fullText = pdfContent.rawText;
        const dateSearchText = this.extractDateRelevantText(fullText);
        
        
        const prompt = `Analyze this academic paper PDF content and extract the correct title, journal name, and publication date.

PDF Content (first 2000 characters):
"${fullText.substring(0, 2000)}"

Additional date-relevant content from throughout the document:
"${dateSearchText}"

Current extracted title: "${pdfContent.title}"
Current extracted journal: "${pdfContent.journal}"
Current extracted date: "${pdfContent.publicationDate}"

Please provide:
1. The correct, properly formatted paper title (fix any spacing issues, remove metadata)
2. The correct journal name (full name, not abbreviation or URL)
3. The correct publication date (look for "Published:", "Received:", "Accepted:", etc.)

For dates, find the ACTUAL publication date in the PDF content. SEARCH THE ENTIRE PDF CONTENT meticulously, including the last pages where publication info often appears. Look for patterns like:
- "Published online: [date]"
- "Available online [date]"
- "Published: [date]"
- "Received: [date]; Accepted: [date]"
- "First published: [date]"
- "Publication date: [date]"
- Copyright dates and journal publication info
- Date formats: "15 July 2021", "2021 Mar 15", "March 2021", "2021-03-15"

CRITICAL INSTRUCTIONS FOR DATE EXTRACTION:
1. ABSOLUTE PRIORITY ORDER (use the MOST RECENT date from this hierarchy):
   - "Published online: [date]" (ABSOLUTE HIGHEST PRIORITY - this is the final publication date)
   - "Available online: [date]"
   - "Published: [date]"
   - "Accepted: [date]" (ONLY use if no published online date exists)
   
   CRITICAL: If you find ANY occurrence of "Published online:" anywhere in the document, that date MUST be used regardless of any other dates found.

2. THOROUGH SEARCH STRATEGY:
   - Search the ENTIRE document text systematically, word by word
   - Look for "Published online:" phrase that commonly appears on the same line or immediately after accepted dates
   - Check for sequences like "Accepted: [date]" followed by "Published online: [date]" - ALWAYS use the published online date
   - Examine headers, footers, first page, last pages, and reference sections
   - Pay special attention to text that appears after "Accepted:" - the published online date often follows immediately
   - If you see both an accepted date and a published online date, IGNORE the accepted date and use ONLY the published online date

3. STRICT RULES:
   - Do NOT use placeholder dates like 2024-01-01, 2021-01-01, or any January 1st dates unless explicitly stated
   - Do NOT estimate or add days to any date - use the EXACT date found
   - MANDATORY: If you find "Published online:" anywhere in the document, that date takes precedence over ALL others
   - Look for patterns where publication information appears in sequences
   - Double-check your search: scan the document multiple times for "Published online:" before settling on an accepted date

4. COMMON PUBLICATION PATTERNS TO RECOGNIZE:
   - "Received [date], revised [date], accepted [date], published online [date]"
   - "Accepted: [date]" immediately followed by "Published online: [date]"
   - "Published online [date]" appearing separately from other dates
   - Online publication dates typically appear after accepted dates in academic papers

IMPORTANT: Find the real publication date from the PDF content provided. Be thorough and precise. Search the entire document carefully.

FINAL VERIFICATION STEP: Before finalizing your date choice, perform THREE separate scans of the entire document:
1. First scan: Look specifically for "Published online:" followed by any date
2. Second scan: Look for any text containing "online" and a date
3. Third scan: Look for any date that appears AFTER an accepted date
If ANY of these scans find a date, use that date instead of the accepted date.

Return the date in this format:
- If day is available: "2021-07-15" (for July 15, 2021)
- If only month is available: "2021-07" (for July 2021)
- If only year is available: "2021" (for 2021)

Return ONLY a JSON object with this exact format (no explanatory text):
{
  "title": "Correct paper title here",
  "journal": "Correct journal name here",
  "publicationDate": "2021-07-15"
}`;

        try {
            if (service.endpoint.includes('anthropic')) {
                return await this.enhanceWithAnthropic(prompt, service, apiKey);
            } else {
                return await this.enhanceWithOpenAI(prompt, service, apiKey);
            }
        } catch (error) {
            console.error('❌ Error enhancing title/journal/date:', error.message);
            return { title: pdfContent.title, journal: pdfContent.journal, publicationDate: pdfContent.publicationDate };
        }
    }

    async enhanceWithAnthropic(prompt, service, apiKey) {
        const requestData = JSON.stringify({
            model: service.model,
            max_tokens: 300,
            messages: [{ role: "user", content: prompt }]
        });

        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.anthropic.com',
                port: 443,
                path: '/v1/messages',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Length': Buffer.byteLength(requestData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.content && response.content[0]) {
                            const text = response.content[0].text.trim();
                            // Try to parse as JSON, fallback to text
                            try {
                                const parsed = JSON.parse(text);
                                resolve(parsed);
                            } catch {
                                resolve({ title: text, journal: 'Unknown Journal' });
                            }
                        } else {
                            reject(new Error('Unexpected Anthropic API response format'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', reject);
            req.write(requestData);
            req.end();
        });
    }

    async enhanceWithOpenAI(prompt, service, apiKey) {
        const requestData = JSON.stringify({
            model: service.model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 300,
            temperature: 0.3
        });

        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.openai.com',
                port: 443,
                path: '/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Length': Buffer.byteLength(requestData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.choices && response.choices[0]) {
                            const text = response.choices[0].message.content.trim();
                            // Try to parse as JSON, fallback to text
                            try {
                                const parsed = JSON.parse(text);
                                resolve(parsed);
                            } catch {
                                resolve({ title: text, journal: 'Unknown Journal' });
                            }
                        } else {
                            reject(new Error('Unexpected OpenAI API response format'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', reject);
            req.write(requestData);
            req.end();
        });
    }

    formatDateForDisplay(dateString) {
        // Handle different date formats: "2021-07-15", "2021-07", "2021-01"
        const parts = dateString.split('-');
        const year = parts[0];
        const month = parts[1];
        const day = parts[2];

        const monthNames = {
            en: ['January', 'February', 'March', 'April', 'May', 'June',
                 'July', 'August', 'September', 'October', 'November', 'December'],
            ko: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
            fr: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
        };

        if (month && month !== '01') {
            const monthIndex = parseInt(month) - 1;
            
            if (day) {
                // Full date: "July 15, 2021", "2021.07.15", "15 Juillet 2021"
                return {
                    en: `${monthNames.en[monthIndex]} ${parseInt(day)}, ${year}`,
                    ko: `${year}.${month}.${day}`,
                    fr: `${parseInt(day)} ${monthNames.fr[monthIndex]} ${year}`
                };
            } else {
                // Month and year: "July 2021", "2021.07", "Juillet 2021"
                return {
                    en: `${monthNames.en[monthIndex]} ${year}`,
                    ko: `${year}.${month}`,
                    fr: `${monthNames.fr[monthIndex]} ${year}`
                };
            }
        } else {
            // Year only: "2021", "2021", "2021"
            return {
                en: year,
                ko: year,
                fr: year
            };
        }
    }

    // Enhanced extraction methods based on 2024 research
    extractPublicationDateEnhanced(lines, fullText) {
        console.log('🔍 Enhanced date extraction...');
        
        // Enhanced date patterns with priority order
        const highPriorityPatterns = [
            // Published online patterns (highest priority)
            /published\s+online[:\s]*([0-9]{1,2}[\s\-\/]*[a-zA-Z]*[\s\-\/]*[0-9]{4})/i,
            /available\s+online[:\s]*([0-9]{1,2}[\s\-\/]*[a-zA-Z]*[\s\-\/]*[0-9]{4})/i,
            
            // Published patterns
            /published[:\s]*([0-9]{1,2}[\s\-\/]*[a-zA-Z]*[\s\-\/]*[0-9]{4})/i,
            
            // Accepted patterns (lower priority)
            /accepted[:\s]*([0-9]{1,2}[\s\-\/]*[a-zA-Z]*[\s\-\/]*[0-9]{4})/i,
            
            // Received patterns (lowest priority)
            /received[:\s]*([0-9]{1,2}[\s\-\/]*[a-zA-Z]*[\s\-\/]*[0-9]{4})/i
        ];
        
        // Search entire document for date patterns
        for (const pattern of highPriorityPatterns) {
            const matches = fullText.matchAll(new RegExp(pattern.source, 'gi'));
            for (const match of matches) {
                const dateStr = match[1];
                const formatted = this.formatDate(dateStr);
                if (formatted && formatted !== '2024-01-01') {
                    console.log(`✅ Found date: ${formatted} (pattern: ${match[0]})`);
                    return formatted;
                }
            }
        }
        
        return this.extractPublicationDate(lines, fullText); // Fallback to original method
    }

    extractAbstractEnhanced(lines, fullText) {
        console.log('🔍 Enhanced abstract extraction...');
        
        // Multiple abstract detection patterns
        const abstractPatterns = [
            /abstract[:\s]*\n(.*?)(?=\n\s*(?:keywords|introduction|1\.|background))/is,
            /abstract[:\s]*(.*?)(?=\n\s*(?:keywords|introduction|1\.|background))/is,
            /summary[:\s]*\n(.*?)(?=\n\s*(?:keywords|introduction|1\.))/is
        ];
        
        // Try each pattern
        for (const pattern of abstractPatterns) {
            const match = fullText.match(pattern);
            if (match && match[1]) {
                let abstract = match[1].trim();
                abstract = abstract.replace(/\s+/g, ' '); // Clean whitespace
                if (abstract.length > 100 && abstract.length < 2000) {
                    console.log(`✅ Found enhanced abstract (${abstract.length} chars)`);
                    return abstract;
                }
            }
        }
        
        return this.extractAbstract(lines); // Fallback to original method
    }

    extractQuantitativeResults(lines, fullText) {
        console.log('🔍 Extracting quantitative results...');
        
        const resultPatterns = [
            // Results section patterns
            /results[:\s]*\n(.*?)(?=\n\s*(?:discussion|conclusion|limitations|references))/is,
            /findings[:\s]*\n(.*?)(?=\n\s*(?:discussion|conclusion|limitations))/is,
            
            // Conclusion patterns
            /conclusion[s]?[:\s]*\n(.*?)(?=\n\s*(?:acknowledgments|references|funding))/is,
            
            // Discussion patterns that might contain key results
            /discussion[:\s]*\n(.*?)(?=\n\s*(?:conclusion|limitations|references))/is
        ];
        
        let results = [];
        
        for (const pattern of resultPatterns) {
            const match = fullText.match(pattern);
            if (match && match[1]) {
                const section = match[1].trim();
                
                // Extract sentences with numbers, percentages, or statistical terms
                const quantitativeSentences = section.match(/[^.!?]*(?:\d+(?:\.\d+)?%?|\bp\s*[<>=]\s*\d+|\bCI\b|\bOR\b|\bRR\b|\bR[₀0]\b)[^.!?]*[.!?]/g);
                
                if (quantitativeSentences) {
                    results.push(...quantitativeSentences);
                }
            }
        }
        
        const uniqueResults = [...new Set(results)];
        console.log(`✅ Found ${uniqueResults.length} quantitative result sentences`);
        return uniqueResults.join(' ').substring(0, 1000); // Limit length
    }

    extractStatisticalFindings(fullText) {
        console.log('🔍 Extracting statistical findings...');
        
        const statisticalPatterns = [
            // Percentages
            /(\d+(?:\.\d+)?%)/g,
            
            // P-values
            /(p\s*[<>=]\s*\d+(?:\.\d+)?)/gi,
            
            // Confidence intervals
            /(95%\s*CI[:\s]*\d+(?:\.\d+)?[-–]\d+(?:\.\d+)?)/gi,
            
            // R0 values
            /(R[₀0]\s*[=:]\s*\d+(?:\.\d+)?)/gi,
            
            // Odds ratios / Risk ratios
            /((?:OR|RR)\s*[=:]\s*\d+(?:\.\d+)?)/gi,
            
            // Reduction/increase patterns
            /(\d+(?:\.\d+)?%?\s*(?:reduction|decrease|increase|improvement))/gi,
            
            // Fold changes
            /(\d+(?:\.\d+)?[-–]fold)/gi,
            
            // Sample sizes
            /(n\s*=\s*\d+)/gi
        ];
        
        let findings = [];
        
        for (const pattern of statisticalPatterns) {
            const matches = fullText.matchAll(pattern);
            for (const match of matches) {
                findings.push(match[1] || match[0]);
            }
        }
        
        const uniqueFindings = [...new Set(findings)];
        console.log(`✅ Found ${uniqueFindings.length} statistical findings`);
        return uniqueFindings.slice(0, 20); // Limit to top 20 findings
    }

    extractTableResults(fullText) {
        console.log('🔍 Extracting table results...');
        
        const tablePatterns = [
            // Table references with results
            /table\s+\d+[^.]*(?:\d+(?:\.\d+)?%|\bp\s*[<>=])/gi,
            
            // Tabular data patterns
            /(\d+(?:\.\d+)?)\s+\(\s*(\d+(?:\.\d+)?%?)\s*\)/g,
            
            // Results in parentheses
            /\(\s*(\d+(?:\.\d+)?%?[^)]*)\s*\)/g
        ];
        
        let tableResults = [];
        
        for (const pattern of tablePatterns) {
            const matches = fullText.matchAll(pattern);
            for (const match of matches) {
                if (match[0].length < 100) { // Avoid capturing too much text
                    tableResults.push(match[0]);
                }
            }
        }
        
        const uniqueTableResults = [...new Set(tableResults)];
        console.log(`✅ Found ${uniqueTableResults.length} table result patterns`);
        return uniqueTableResults.slice(0, 15); // Limit results
    }

    extractDOI(lines, fullText) {
        console.log('🔍 Extracting DOI...');
        
        // DOI patterns to match
        const doiPatterns = [
            /doi:\s*(\S+)/gi,
            /https?:\/\/doi\.org\/([^\s]+)/gi,
            /10\.\d{4,}\/[^\s]+/g
        ];
        
        // Search in lines first
        for (const line of lines) {
            const lowerLine = line.toLowerCase();
            if (lowerLine.includes('doi')) {
                for (const pattern of doiPatterns) {
                    const matches = line.matchAll(pattern);
                    for (const match of matches) {
                        let doi = match[1] || match[0];
                        if (doi.startsWith('10.')) {
                            console.log(`✅ Found DOI: ${doi}`);
                            return `https://doi.org/${doi}`;
                        }
                    }
                }
            }
        }
        
        // Search in full text
        for (const pattern of doiPatterns) {
            const matches = fullText.matchAll(pattern);
            for (const match of matches) {
                let doi = match[1] || match[0];
                if (doi.startsWith('10.')) {
                    console.log(`✅ Found DOI: ${doi}`);
                    return `https://doi.org/${doi}`;
                }
            }
        }
        
        console.log('❌ No DOI found');
        return null;
    }

    async generateFactualAbstractFromPDF(pdfContent, serviceInfo) {
        const { service } = serviceInfo;
        const apiKey = process.env[service.envVar];
        
        const prompt = `You are an expert academic abstract writer. Follow this step-by-step reasoning process:

STEP 1: ANALYZE THE RESEARCH
Original Abstract: "${pdfContent.abstract}"
Quantitative Results: "${pdfContent.quantitativeResults || 'None found'}"
Statistical Findings: ${pdfContent.statisticalFindings ? pdfContent.statisticalFindings.join(', ') : 'None found'}

STEP 2: IDENTIFY KEY INSIGHTS
- What is methodologically novel or surprising?
- Which findings challenge conventional wisdom?
- How do numerical results reveal unexpected patterns?

STEP 3: AVOID THESE COMMON MISTAKES
❌ BAD: "viruses with higher infectivity are more effective" (obvious)
✅ GOOD: "surprisingly, reduced infectivity combined with immune evasion achieved superior outcomes"
❌ BAD: "60%, 47%, 33%, 41%, 1%, 25%, 75%, 73%, 50%, and 73% reductions"
✅ GOOD: "substantial reductions in older adults (60-75%) contrasted with minimal impact in children (1-25%)"

STEP 4: STRUCTURE YOUR ABSTRACT
1. Lead with the novel methodological approach or counterintuitive finding
2. Explain the research innovation in 1-2 sentences
3. Present grouped numerical results with interpretation
4. Conclude with theoretical or practical significance

STEP 5: QUALITY CHECK
- No title repetition ✓
- Technical terms used precisely ✓
- Numbers grouped meaningfully ✓
- Avoids obvious statements ✓
- 90-120 words ✓

Write a compelling abstract that reveals non-obvious insights:`;

        if (service.endpoint.includes('anthropic')) {
            return this.callAnthropicAPI(prompt, apiKey, service.model);
        } else {
            return this.callOpenAIAPI(prompt, apiKey, service.model);
        }
    }

    async callAnthropicAPI(prompt, apiKey, model) {
        const requestData = JSON.stringify({
            model: model,
            max_tokens: 250,
            messages: [{ role: "user", content: prompt }]
        });

        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.anthropic.com',
                port: 443,
                path: '/v1/messages',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Length': Buffer.byteLength(requestData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.content && response.content[0]) {
                            resolve(response.content[0].text.trim());
                        } else {
                            reject(new Error('Invalid Anthropic response'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', reject);
            req.write(requestData);
            req.end();
        });
    }

    async callOpenAIAPI(prompt, apiKey, model) {
        const requestData = JSON.stringify({
            model: model,
            messages: [
                { role: "system", content: "You are a factual academic abstract writer." },
                { role: "user", content: prompt }
            ],
            max_tokens: 250,
            temperature: 0.3
        });

        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.openai.com',
                port: 443,
                path: '/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Length': Buffer.byteLength(requestData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.choices && response.choices[0]) {
                            resolve(response.choices[0].message.content.trim());
                        } else {
                            reject(new Error('Invalid OpenAI response'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', reject);
            req.write(requestData);
            req.end();
        });
    }
}

// Run the generator
const generator = new PDFAbstractGenerator();
generator.processPDFs().catch(console.error);