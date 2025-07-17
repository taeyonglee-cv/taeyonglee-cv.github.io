#!/usr/bin/env node

/**
 * LLM Abstract Generator
 * 
 * This script enhances publication abstracts using various LLM services.
 * It can generate better abstracts and translate them to multiple languages.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

class LLMAbstractGenerator {
    constructor() {
        this.dataDir = path.join(__dirname, '..', 'data');
        this.publicationsFile = path.join(this.dataDir, 'publications.json');
        this.configFile = path.join(__dirname, '..', 'config.json');
        this.envFile = path.join(__dirname, '..', '.env');
        
        // Load environment variables if .env exists
        this.loadEnvVariables();
        
        // Available LLM services
        this.services = {
            anthropic: {
                name: 'Anthropic Claude',
                endpoint: 'https://api.anthropic.com/v1/messages',
                envVar: 'ANTHROPIC_API_KEY',
                model: 'claude-3-haiku-20240307'
            },
            openai: {
                name: 'OpenAI GPT',
                endpoint: 'https://api.openai.com/v1/chat/completions',
                envVar: 'OPENAI_API_KEY',
                model: 'gpt-3.5-turbo'
            },
            ollama: {
                name: 'Ollama (Local)',
                endpoint: 'http://localhost:11434/api/generate',
                envVar: null, // No API key needed for local
                model: 'llama2'
            },
            groq: {
                name: 'Groq',
                endpoint: 'https://api.groq.com/openai/v1/chat/completions',
                envVar: 'GROQ_API_KEY',
                model: 'llama3-8b-8192'
            }
        };
    }

    loadEnvVariables() {
        try {
            if (fs.existsSync(this.envFile)) {
                const envContent = fs.readFileSync(this.envFile, 'utf8');
                envContent.split('\n').forEach(line => {
                    line = line.trim();
                    // Skip empty lines and comments
                    if (!line || line.startsWith('#')) {
                        return;
                    }
                    
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

    loadConfig() {
        try {
            if (fs.existsSync(this.configFile)) {
                return JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
            }
        } catch (error) {
            console.warn('⚠️ Could not load config file:', error.message);
        }
        return {};
    }

    loadPublications() {
        try {
            if (fs.existsSync(this.publicationsFile)) {
                return JSON.parse(fs.readFileSync(this.publicationsFile, 'utf8'));
            }
        } catch (error) {
            console.error('❌ Could not load publications:', error.message);
        }
        return [];
    }

    articleAlreadyExists(newArticle, existingPublications) {
        // Normalize text for comparison
        const normalizeText = (text) => {
            return text.toLowerCase()
                      .trim()
                      .replace(/[^\w\s]/g, '') // Remove punctuation
                      .replace(/\s+/g, ' '); // Normalize whitespace
        };

        const newTitle = normalizeText(newArticle.title || '');
        const newJournal = normalizeText(newArticle.journal || '');

        return existingPublications.some(existing => {
            const existingTitle = normalizeText(existing.title || '');
            const existingJournal = normalizeText(existing.journal || '');
            
            // Match on both title and journal for accuracy
            return existingTitle === newTitle && existingJournal === newJournal;
        });
    }

    filterNewArticlesOnly(extractedArticles) {
        // Load existing publications to compare against
        const existingPublications = this.loadPublications();
        const newArticles = [];

        console.log(`🔍 Checking ${extractedArticles.length} articles against existing ${existingPublications.length} publications...`);

        for (const article of extractedArticles) {
            if (this.articleAlreadyExists(article, existingPublications)) {
                console.log(`⏭️ Skipping existing: "${article.title.substring(0, 50)}..."`);
            } else {
                console.log(`✅ New article found: "${article.title.substring(0, 50)}..."`);
                newArticles.push(article);
            }
        }

        const skippedCount = extractedArticles.length - newArticles.length;
        if (skippedCount > 0) {
            console.log(`📊 Token optimization: Skipped ${skippedCount} existing articles, processing ${newArticles.length} new articles`);
        }

        return newArticles;
    }

    detectAvailableService() {
        // Check which LLM services are available
        const available = [];
        
        console.log('🔍 Checking available LLM services:');
        
        for (const [key, service] of Object.entries(this.services)) {
            const hasKey = service.envVar && process.env[service.envVar];
            console.log(`   ${key}: ${service.envVar} = ${hasKey ? 'FOUND' : 'NOT FOUND'}`);
            
            if (hasKey) {
                available.push({ key, service, priority: 1 });
            } else if (key === 'ollama') {
                // We'll test Ollama connectivity separately
                available.push({ key, service, priority: 2 });
            }
        }
        
        // Sort by priority (API keys first, then local)
        available.sort((a, b) => a.priority - b.priority);
        
        console.log(`🎯 Selected service: ${available.length > 0 ? available[0].key : 'none'}`);
        
        return available.length > 0 ? available[0] : null;
    }

    async testOllamaConnection() {
        return new Promise((resolve) => {
            const req = https.get('http://localhost:11434/api/tags', {timeout: 2000}, (res) => {
                resolve(res.statusCode === 200);
            });
            
            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
        });
    }

    async generateAbstractWithOpenAI(title, service, currentAbstract = '') {
        const apiKey = process.env[service.envVar];
        if (!apiKey) {
            throw new Error(`API key not found for ${service.name}`);
        }

        const prompt = `<task>Write a structured academic abstract following this exact format</task>

<example_1>
For "Constrained optimal control problem of oncolytic viruses":
Most models for oncolytic virotherapy overlook real-world constraints on virus dosage, limiting their clinical relevance. We formulated a constrained optimal control model with isoperimetric-type constraints and rigorously proved the existence of an optimal control using the Filippov–Cesari theorem. Beyond simulation, our work provides theoretical guarantees for optimal strategies, establishing a solid foundation for constrained cancer treatment planning. This dual theoretical–computational framework offers practical guidance for designing virus-based cancer therapies within realistic medical limits.
</example_1>

<example_2>
For "Prediction of effectiveness of universal rotavirus vaccination":
Rotavirus causes a major disease burden in young children in Vietnam, but the national immunization program has yet to adopt universal RV vaccination due to concerns about lower vaccine effectiveness in low-income settings. We developed an age-stratified dynamic transmission model reflecting Vietnam's demographic change and calibrated it using hospitalization data from over 5,000 pediatric cases. Even with modest efficacy (55–85%), universal vaccination can cut hospitalizations by up to 50% over 10 years, with stronger protection in children aged 4–12 months and indirect benefits for those too young to be vaccinated. Our work supports policy decisions in LMICs, showing that rotavirus vaccination is a cost-justifiable and impactful intervention when guided by robust dynamic modeling.
</example_2>

<example_3>
For "The effect of control measures on COVID-19 transmission in South Korea":
COVID-19 spread rapidly in early 2020, and while Korea's interventions were initially successful, maintaining strict measures like social distancing and school closures imposes high social costs. We developed a calibrated age-structured SEIR model with added compartments for quarantine and isolation, fitted to KDCA-reported age-specific case data, comparing multiple intervention scenarios with differing assumptions about infectivity. Without social distancing, a second wave is predicted, while early isolation (2 vs. 3 days) reduced cumulative cases by up to 60% and deaths by up to 83%, with quarantine becoming as critical as isolation if exposed individuals are also infectious. The study demonstrates that timing and intensity of interventions critically shape outbreak trajectories, highlighting that combining early isolation and quarantine was essential for Korea's initial COVID-19 control.
</example_3>

<example_4>
For "A mathematical model of COVID-19 transmission in a tertiary hospital":
COVID-19 spreads rapidly in closed settings like hospitals, threatening vulnerable patients and potentially paralyzing care. We developed a detailed SEIR compartment model tailored to a 2500-bed Korean tertiary hospital, simulating interventions such as front-door screening, quarantine, early testing, and PPE usage. Early testing was the most effective measure, reducing incident cases by 80.7% over 60 days, while quarantining patients cut cases by 65.7% and universal mask-wearing yielded 66.4% reduction. This is the first hospital-specific COVID-19 transmission model incorporating staff/visitor flow and spatial structure, offering strong evidence that early testing and patient isolation are far more effective than screening alone.
</example_4>

<example_5>
For "Application of control theory in a delayed-infection":
Oncolytic virotherapy holds promise for cancer treatment, but viral clearance by the immune system and non-uniform diffusion reduce its efficacy. We formulated a PDE-based spatial model incorporating tumor–virus dynamics, immune-driven viral clearance, and multi-level viral coating, applying finite-horizon optimal control to determine the ideal initial distribution of coating levels. A bimodal injection—mixing thickly coated and thinly coated virus—consistently minimized tumor volume, with the optimal composition evolving over time as thicker coatings gain importance for long-term control. This study provides the first spatially-resolved control framework for virotherapy with immune evasion and delayed infection, offering actionable guidance for designing virus formulations.
</example_5>

<paper_title>
${title}
</paper_title>

<source_text>
${currentAbstract}
</source_text>

<analysis>
CRITICAL: Match the EXACT paper to its corresponding example:

1. If title contains "Constrained optimal control problem of oncolytic viruses" → Follow Example 1 EXACTLY
2. If title contains "Prediction of effectiveness of universal rotavirus vaccination" → Follow Example 2 EXACTLY  
3. If title contains "The effect of control measures on COVID-19 transmission in South Korea" → Follow Example 3 EXACTLY
4. If title contains "A mathematical model of COVID-19 transmission in a tertiary hospital" → Follow Example 4 EXACTLY
5. If title contains "Application of control theory in a delayed-infection" → Follow Example 5 EXACTLY

For other papers, use keyword analysis:
- Theoretical proofs + Filippov-Cesari → Example 1 pattern
- Vaccination effectiveness → Example 2 pattern  
- Hospital interventions → Example 3 pattern
- Applied optimal control + PDE → Example 4 pattern
</analysis>

<structure>
Write exactly 4 sentences following this pattern:
Sentence 1: Problem/motivation statement
Sentence 2: Methodology/approach description  
Sentence 3: Key findings/insights with specific numbers
Sentence 4: Impact/significance statement
</structure>

<requirements>
CRITICAL INSTRUCTION: You MUST follow the exact example identified in the analysis step.
- Write EXACTLY 4 sentences following the matched example's style and content approach
- DO NOT invent content not present in the source - only use what's actually written
- DO NOT add theoretical concepts (like "existence and uniqueness") if not mentioned in source
- DO NOT mix examples - use only the matched example as template
- Return only the 4-sentence abstract - no formatting, emojis, or labels
</requirements>

<output>
Write the 4-sentence abstract following the matched example:
</output>`;

        const requestData = JSON.stringify({
            model: service.model,
            messages: [
                {
                    role: "system",
                    content: "You are an academic writing assistant. Generate concise, professional abstracts for research papers."
                },
                {
                    role: "user", 
                    content: prompt
                }
            ],
            max_tokens: 250,
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
                            reject(new Error('Unexpected API response format'));
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

    async generateAbstractWithGroq(title, service, currentAbstract = '') {
        // Similar to OpenAI but with Groq endpoint
        return this.generateAbstractWithOpenAI(title, service, currentAbstract);
    }

    async generateAbstractWithAnthropic(title, service, currentAbstract = '') {
        const apiKey = process.env[service.envVar];
        if (!apiKey) {
            throw new Error(`API key not found for ${service.name}`);
        }

        const prompt = `<task>Write a 4-sentence academic abstract following these exact examples</task>

<example_1>
For "Constrained optimal control problem of oncolytic viruses":
Most models for oncolytic virotherapy overlook real-world constraints on virus dosage, limiting their clinical relevance. We formulated a constrained optimal control model with isoperimetric-type constraints and rigorously proved the existence of an optimal control using the Filippov–Cesari theorem. Beyond simulation, our work provides theoretical guarantees for optimal strategies, establishing a solid foundation for constrained cancer treatment planning. This dual theoretical–computational framework offers practical guidance for designing virus-based cancer therapies within realistic medical limits.
</example_1>

<example_2>
For "Prediction of effectiveness of universal rotavirus vaccination":
Rotavirus causes a major disease burden in young children in Vietnam, but the national immunization program has yet to adopt universal RV vaccination due to concerns about lower vaccine effectiveness in low-income settings. We developed an age-stratified dynamic transmission model reflecting Vietnam's demographic change and calibrated it using hospitalization data from over 5,000 pediatric cases. Even with modest efficacy (55–85%), universal vaccination can cut hospitalizations by up to 50% over 10 years, with stronger protection in children aged 4–12 months and indirect benefits for those too young to be vaccinated. Our work supports policy decisions in LMICs, showing that rotavirus vaccination is a cost-justifiable and impactful intervention when guided by robust dynamic modeling.
</example_2>

<example_3>
For "The effect of control measures on COVID-19 transmission in South Korea":
COVID-19 spread rapidly in early 2020, and while Korea's interventions were initially successful, maintaining strict measures like social distancing and school closures imposes high social costs. We developed a calibrated age-structured SEIR model with added compartments for quarantine and isolation, fitted to KDCA-reported age-specific case data, comparing multiple intervention scenarios with differing assumptions about infectivity. Without social distancing, a second wave is predicted, while early isolation (2 vs. 3 days) reduced cumulative cases by up to 60% and deaths by up to 83%, with quarantine becoming as critical as isolation if exposed individuals are also infectious. The study demonstrates that timing and intensity of interventions critically shape outbreak trajectories, highlighting that combining early isolation and quarantine was essential for Korea's initial COVID-19 control.
</example_3>

<example_4>
For "A mathematical model of COVID-19 transmission in a tertiary hospital":
COVID-19 spreads rapidly in closed settings like hospitals, threatening vulnerable patients and potentially paralyzing care. We developed a detailed SEIR compartment model tailored to a 2500-bed Korean tertiary hospital, simulating interventions such as front-door screening, quarantine, early testing, and PPE usage. Early testing was the most effective measure, reducing incident cases by 80.7% over 60 days, while quarantining patients cut cases by 65.7% and universal mask-wearing yielded 66.4% reduction. This is the first hospital-specific COVID-19 transmission model incorporating staff/visitor flow and spatial structure, offering strong evidence that early testing and patient isolation are far more effective than screening alone.
</example_4>

<example_5>
For "Application of control theory in a delayed-infection":
Oncolytic virotherapy holds promise for cancer treatment, but viral clearance by the immune system and non-uniform diffusion reduce its efficacy. We formulated a PDE-based spatial model incorporating tumor–virus dynamics, immune-driven viral clearance, and multi-level viral coating, applying finite-horizon optimal control to determine the ideal initial distribution of coating levels. A bimodal injection—mixing thickly coated and thinly coated virus—consistently minimized tumor volume, with the optimal composition evolving over time as thicker coatings gain importance for long-term control. This study provides the first spatially-resolved control framework for virotherapy with immune evasion and delayed infection, offering actionable guidance for designing virus formulations.
</example_5>

<paper_title>
${title}
</paper_title>

<source_text>
${currentAbstract}
</source_text>

<analysis>
CRITICAL: Match the EXACT paper to its corresponding example:

1. If title contains "Constrained optimal control problem of oncolytic viruses" → Follow Example 1 EXACTLY
2. If title contains "Prediction of effectiveness of universal rotavirus vaccination" → Follow Example 2 EXACTLY  
3. If title contains "The effect of control measures on COVID-19 transmission in South Korea" → Follow Example 3 EXACTLY
4. If title contains "A mathematical model of COVID-19 transmission in a tertiary hospital" → Follow Example 4 EXACTLY
5. If title contains "Application of control theory in a delayed-infection" → Follow Example 5 EXACTLY

For other papers, use keyword analysis:
- Theoretical proofs + Filippov-Cesari → Example 1 pattern
- Vaccination effectiveness → Example 2 pattern  
- Hospital interventions → Example 3 pattern
- Applied optimal control + PDE → Example 4 pattern
</analysis>

<structure>
Write exactly 4 sentences following this pattern:
Sentence 1: Problem/motivation statement
Sentence 2: Methodology/approach description  
Sentence 3: Key findings/insights with specific numbers
Sentence 4: Impact/significance statement
</structure>

<requirements>
CRITICAL INSTRUCTION: You MUST follow the exact example identified in the analysis step.
- Write EXACTLY 4 sentences following the matched example's style and content approach
- DO NOT invent content not present in the source - only use what's actually written
- DO NOT add theoretical concepts (like "existence and uniqueness") if not mentioned in source
- DO NOT mix examples - use only the matched example as template
- Return only the 4-sentence abstract - no formatting, emojis, or labels
</requirements>

<output>
Write the 4-sentence abstract following the matched example:
</output>`;

        const requestData = JSON.stringify({
            model: service.model,
            max_tokens: 250,
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ]
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

    async enhanceKoreanTranslation(koreanText, service) {
        const enhancePrompt = `<task>Fix broken Korean text and improve translation quality</task>

<source_text>
${koreanText}
</source_text>

<critical_fixes>
ABSOLUTELY CRITICAL: Fix ALL broken Unicode characters. Look for these patterns and fix them:
- 조건��� → 조건을
- 유지���는 → 유지하는  
- 상급종합병원�� → 상급종합병원을
- 데이터를 ��용하여 → 데이터를 사용하여
- 종��-바이러스 → 종양-바이러스
- Any text containing � symbols must be completely fixed
- Replace ALL corrupted characters with proper Korean text
</critical_fixes>

<improvement_rules>
1. CRITICAL: Remove ALL introduction text including:
   - "다음은... 번역한 결과입니다"
   - "다음은 개선된 한국어 번역문입니다"
   - "Enhanced Korean translation:"
   - Any introductory phrases
2. Use ONLY 반말 style: ~했다, ~한다, ~이다, ~였다
3. Fix translationese:
   - 암세포용해바이러스 → 종양용해바이러스요법
   - modest 효능 → 일반적인 효능
   - outbreak trajectories → 유행 양상
   - 남한 → 대한민국 or 한국
   - 실행 가능한 지침 → 실용적인 지침
4. Use natural Korean academic expressions
5. Keep all numbers exactly as written
6. Return ONLY clean Korean abstract text
</improvement_rules>

<output>
</output>`;

        const apiKey = process.env[service.envVar];
        let finalData;
        
        if (service.endpoint.includes('anthropic')) {
            finalData = JSON.stringify({
                model: service.model,
                max_tokens: 500,
                messages: [{ role: "user", content: enhancePrompt }]
            });
        } else {
            finalData = JSON.stringify({
                model: service.model,
                messages: [
                    { role: "system", content: "You are a Korean academic writing specialist focused on quality improvement." },
                    { role: "user", content: enhancePrompt }
                ],
                max_tokens: 400,
                temperature: 0.2
            });
        }

        return new Promise((resolve, reject) => {
            let hostname, path, headers;
            
            if (service.endpoint.includes('anthropic')) {
                hostname = 'api.anthropic.com';
                path = '/v1/messages';
                headers = {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Length': Buffer.byteLength(finalData)
                };
            } else {
                hostname = service.endpoint.includes('groq') ? 'api.groq.com' : 'api.openai.com';
                path = service.endpoint.includes('groq') ? '/openai/v1/chat/completions' : '/v1/chat/completions';
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Length': Buffer.byteLength(finalData)
                };
            }
            
            const options = { hostname, port: 443, path, method: 'POST', headers };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (service.endpoint.includes('anthropic')) {
                            if (response.content && response.content[0]) {
                                resolve(response.content[0].text.trim());
                            } else {
                                reject(new Error('Korean enhancement failed'));
                            }
                        } else {
                            if (response.choices && response.choices[0]) {
                                resolve(response.choices[0].message.content.trim());
                            } else {
                                reject(new Error('Korean enhancement failed'));
                            }
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', reject);
            req.write(finalData);
            req.end();
        });
    }

    async enhanceFrenchTranslation(frenchText, service) {
        const enhancePrompt = `<task>Clean French translation by removing unwanted introduction text</task>

<source_text>
${frenchText}
</source_text>

<critical_fixes>
ABSOLUTELY CRITICAL: Remove ALL introduction text including:
- "Voici la traduction française de l'abstract académique"
- "Traduction française :"
- "French translation:"
- "Voici la traduction française"
- Any introductory phrases or headers
- Remove any line that starts with "Voici" or "Traduction"
</critical_fixes>

<improvement_rules>
1. Keep ONLY the actual French abstract content
2. Use natural French academic style
3. Keep all numbers and percentages exactly as written
4. Ensure proper French grammar and flow
5. Return ONLY clean French abstract text
6. No introduction, no formatting markers
</improvement_rules>

<output>
</output>`;

        const apiKey = process.env[service.envVar];
        let finalData;
        
        if (service.endpoint.includes('anthropic')) {
            finalData = JSON.stringify({
                model: service.model,
                max_tokens: 500,
                messages: [{ role: "user", content: enhancePrompt }]
            });
        } else {
            finalData = JSON.stringify({
                model: service.model,
                messages: [
                    { role: "system", content: "You are a French academic writing specialist focused on cleaning translations." },
                    { role: "user", content: enhancePrompt }
                ],
                max_tokens: 400,
                temperature: 0.2
            });
        }

        return new Promise((resolve, reject) => {
            let hostname, path, headers;
            
            if (service.endpoint.includes('anthropic')) {
                hostname = 'api.anthropic.com';
                path = '/v1/messages';
                headers = {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Length': Buffer.byteLength(finalData)
                };
            } else {
                hostname = service.endpoint.includes('groq') ? 'api.groq.com' : 'api.openai.com';
                path = service.endpoint.includes('groq') ? '/openai/v1/chat/completions' : '/v1/chat/completions';
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Length': Buffer.byteLength(finalData)
                };
            }
            
            const options = { hostname, port: 443, path, method: 'POST', headers };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (service.endpoint.includes('anthropic')) {
                            if (response.content && response.content[0]) {
                                resolve(response.content[0].text.trim());
                            } else {
                                reject(new Error('French enhancement failed'));
                            }
                        } else {
                            if (response.choices && response.choices[0]) {
                                resolve(response.choices[0].message.content.trim());
                            } else {
                                reject(new Error('French enhancement failed'));
                            }
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', reject);
            req.write(finalData);
            req.end();
        });
    }

    async translateAbstract(abstract, targetLang, service) {
        const langNames = {
            ko: 'Korean',
            fr: 'French', 
            en: 'English'
        };

        if (targetLang === 'en') {
            return abstract; // Already in English
        }

        const koPrompt = `<task>Translate this academic abstract to Korean using proper encoding</task>

<source_text>
${abstract}
</source_text>

<translation_rules>
- Keep these terms in English: COVID-19, SEIR, R0, Filippov-Cesari, regime
- Translate these: basic reproductive number → 기본재생산지수, herd immunity → 집단면역
- Use ONLY 반말 (informal) style: ~했다, ~한다, ~이다, ~였다 (NOT ~합니다, ~입니다)
- Use proper Korean academic terminology:
  * oncolytic virotherapy → 종양용해바이러스요법
  * modest efficacy → 일반적인 효능
  * control theory → 제어이론
  * optimal control → 최적제어
- Complete the translation - do not cut off text
- Ensure proper UTF-8 encoding for Korean characters
- DO NOT include any introductory phrases like "다음은... 번역한 결과입니다", and "Enhanced Korean translation: "
- Return ONLY the translated abstract content
- Keep all numbers exactly as written
</translation_rules>

<output>
Korean translation:
</output>`;

        const frPrompt = `<task>Translate this academic abstract to French using proper encoding</task>

<source_text>
${abstract}
</source_text>

<translation_rules>
- Keep these terms in English: COVID-19, SEIR, R0, Filippov-Cesari, regime
- Translate these: basic reproductive number → nombre de reproduction de base, herd immunity → immunité collective
- Keep all numbers exactly as written
- Use natural French academic style
- Complete the translation - do not cut off text
- Ensure proper UTF-8 encoding for French characters
- DO NOT include any introductory phrases like "Voici la traduction française de l'abstract académique :", "Traduction française : " and "French translation: "
- Use proper French mathematical terminology
</translation_rules>

<output>
French translation:
</output>`;

        const prompt = targetLang === 'ko' ? koPrompt : frPrompt;

        const apiKey = process.env[service.envVar];
        const requestData = JSON.stringify({
            model: service.model,
            messages: [
                {
                    role: "system",
                    content: `You are a professional academic translator specializing in ${langNames[targetLang]} translation.`
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 250,
            temperature: 0.3
        });

        return new Promise((resolve, reject) => {
            let hostname, path, headers, finalData;
            
            if (service.endpoint.includes('anthropic')) {
                hostname = 'api.anthropic.com';
                path = '/v1/messages';
                // Reformat request for Anthropic
                finalData = JSON.stringify({
                    model: service.model,
                    max_tokens: 500,
                    messages: [
                        {
                            role: "user",
                            content: prompt
                        }
                    ]
                });
                headers = {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Length': Buffer.byteLength(finalData)
                };
            } else {
                hostname = service.endpoint.includes('groq') ? 'api.groq.com' : 'api.openai.com';
                path = service.endpoint.includes('groq') ? '/openai/v1/chat/completions' : '/v1/chat/completions';
                finalData = requestData;
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Length': Buffer.byteLength(finalData)
                };
            }
            
            const options = {
                hostname,
                port: 443,
                path,
                method: 'POST',
                headers
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (service.endpoint.includes('anthropic')) {
                            if (response.content && response.content[0]) {
                                resolve(response.content[0].text.trim());
                            } else {
                                reject(new Error('Anthropic translation failed'));
                            }
                        } else {
                            if (response.choices && response.choices[0]) {
                                resolve(response.choices[0].message.content.trim());
                            } else {
                                reject(new Error('Translation failed'));
                            }
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', reject);
            req.write(finalData);
            req.end();
        });
    }

    async generateFallbackAbstract(title) {
        // Fallback method using simple templates and keyword analysis
        console.log('🔄 Using fallback abstract generation...');
        
        const keywords = this.extractKeywords(title);
        const domain = this.detectResearchDomain(title);
        
        const templates = {
            'epidemiology': `This study presents research on ${title.toLowerCase()}. The work involves mathematical modeling and analysis of epidemiological patterns, contributing to our understanding of disease transmission and control strategies.`,
            'control_theory': `This paper investigates ${title.toLowerCase()}, applying control theory principles and mathematical optimization techniques to analyze system dynamics and develop effective intervention strategies.`,
            'mathematical_biology': `This research examines ${title.toLowerCase()} using mathematical modeling approaches. The study contributes to the field of mathematical biology through theoretical analysis and computational methods.`,
            'general': `This study focuses on ${title.toLowerCase()}, employing rigorous analytical methods and mathematical approaches to advance understanding in this important research area.`
        };
        
        return templates[domain] || templates['general'];
    }

    extractKeywords(title) {
        const commonWords = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'using', 'based'];
        return title.toLowerCase()
            .split(/\\s+/)
            .filter(word => word.length > 3 && !commonWords.includes(word))
            .slice(0, 5);
    }

    detectResearchDomain(title) {
        const titleLower = title.toLowerCase();
        
        if (titleLower.includes('covid') || titleLower.includes('epidemi') || titleLower.includes('transmission') || titleLower.includes('vaccination')) {
            return 'epidemiology';
        }
        if (titleLower.includes('control') || titleLower.includes('optimal') || titleLower.includes('optimization')) {
            return 'control_theory';
        }
        if (titleLower.includes('mathematical') || titleLower.includes('model')) {
            return 'mathematical_biology';
        }
        
        return 'general';
    }

    async enhancePublication(publication, service) {
        console.log(`\\n🔄 Enhancing: "${publication.title.substring(0, 50)}..."`);
        
        try {
            let englishAbstract;
            
            // Generate or improve English abstract
            if (service.key === 'openai' || service.key === 'groq') {
                englishAbstract = await this.generateAbstractWithOpenAI(
                    publication.title, 
                    service.service,
                    publication.summary.en
                );
            } else if (service.key === 'anthropic') {
                englishAbstract = await this.generateAbstractWithAnthropic(
                    publication.title,
                    service.service,
                    publication.summary.en
                );
            } else {
                // Fallback to template-based generation
                englishAbstract = await this.generateFallbackAbstract(publication.title);
            }
            
            console.log('✅ Generated English abstract');
            
            // Generate multilingual versions
            const summary = { en: englishAbstract };
            
            if (service.key === 'openai' || service.key === 'groq' || service.key === 'anthropic') {
                try {
                    // Initial Korean translation
                    let koreanTranslation = await this.translateAbstract(englishAbstract, 'ko', service.service);
                    console.log('✅ Initial Korean translation completed');
                    
                    // Enhance Korean translation quality 1
                    koreanTranslation = await this.enhanceKoreanTranslation(koreanTranslation, service.service);
                    console.log('✅ Enhanced Korean translation quality 1');
                    
                    // Enhance Korean translation quality 2
                    summary.ko = await this.enhanceKoreanTranslation(koreanTranslation, service.service);
                    console.log('✅ Enhanced Korean translation quality 2');

                    // Initial French translation
                    let frenchTranslation = await this.translateAbstract(englishAbstract, 'fr', service.service);
                    console.log('✅ Initial French translation completed');
                    
                    // Enhance French translation quality 1
                    frenchTranslation = await this.enhanceFrenchTranslation(frenchTranslation, service.service);
                    console.log('✅ Enhanced French translation quality 1');
                    
                    // Enhance French translation quality 2
                    summary.fr = await this.enhanceFrenchTranslation(frenchTranslation, service.service);
                    console.log('✅ Enhanced French translation quality 2');
                } catch (error) {
                    console.warn('⚠️ Translation failed, using fallback');
                    summary.ko = `[한국어] ${englishAbstract}`;
                    summary.fr = `[Français] ${englishAbstract}`;
                }
            } else {
                // Simple fallback translations
                summary.ko = `[한국어] ${englishAbstract}`;
                summary.fr = `[Français] ${englishAbstract}`;
            }
            
            return {
                ...publication,
                summary,
                enhanced_at: new Date().toISOString()
            };
            
        } catch (error) {
            console.warn(`⚠️ Enhancement failed for "${publication.title}":`, error.message);
            
            // Return original with fallback abstract
            const fallbackAbstract = await this.generateFallbackAbstract(publication.title);
            return {
                ...publication,
                summary: {
                    en: fallbackAbstract,
                    ko: `[한국어] ${fallbackAbstract}`,
                    fr: `[Français] ${fallbackAbstract}`
                },
                enhanced_at: new Date().toISOString()
            };
        }
    }

    savePublications(publications) {
        console.log('\\n💾 Saving enhanced publications...');
        fs.writeFileSync(this.publicationsFile, JSON.stringify(publications, null, 2));
        console.log(`✅ Saved ${publications.length} enhanced publications`);
    }

    async run(mode = 'auto') {
        console.log('🤖 LLM Abstract Generator');
        console.log('==========================');
        
        const publications = this.loadPublications();
        if (publications.length === 0) {
            console.error('❌ No publications found. Run publication fetcher first.');
            return;
        }
        
        console.log(`📚 Found ${publications.length} publications to enhance`);
        
        // Detect available LLM service
        const availableService = this.detectAvailableService();
        
        if (!availableService) {
            console.log('⚠️ No LLM API keys found. Using fallback generation.');
            console.log('💡 Add API keys to .env file for better results:');
            console.log('   OPENAI_API_KEY=your_key_here');
            console.log('   GROQ_API_KEY=your_key_here');
        } else {
            console.log(`🎯 Using ${availableService.service.name} for enhancement`);
        }
        
        // Filter out publications that already have enhanced summaries
        const publicationsToEnhance = publications.filter(pub => {
            const hasEnhancedSummary = pub.summary && 
                                     pub.summary.en && 
                                     pub.summary.ko && 
                                     pub.summary.fr && 
                                     pub.enhanced_at;
            
            if (hasEnhancedSummary) {
                console.log(`⏭️ Skipping already enhanced: "${pub.title.substring(0, 50)}..."`);
                return false;
            }
            return true;
        });

        if (publicationsToEnhance.length === 0) {
            console.log('✅ All publications already enhanced! No work needed.');
            return;
        }

        console.log(`📊 Token optimization: Processing ${publicationsToEnhance.length}/${publications.length} publications`);

        // Enhance publications
        const enhancedPublications = [];
        
        for (let i = 0; i < publicationsToEnhance.length; i++) {
            const publication = publicationsToEnhance[i];
            
            console.log(`\\n📖 Processing ${i + 1}/${publicationsToEnhance.length}`);
            
            // FAILSAFE: Double-check this publication hasn't been enhanced
            const isAlreadyEnhanced = publication.summary && 
                                    publication.summary.en && 
                                    publication.summary.ko && 
                                    publication.summary.fr && 
                                    publication.enhanced_at;
            
            if (isAlreadyEnhanced) {
                console.error(`🚨 CRITICAL ERROR: Attempting to enhance already processed publication: ${publication.title}`);
                console.error('🛑 TERMINATING to prevent duplicate processing and token waste');
                process.exit(1);
            }

            const enhanced = await this.enhancePublication(
                publication, 
                availableService || { key: 'fallback' }
            );
            
            enhancedPublications.push(enhanced);
            
            // Add delay to avoid rate limiting
            if (availableService && i < publicationsToEnhance.length - 1) {
                console.log('⏱️ Waiting to avoid rate limits...');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Combine enhanced publications with skipped ones to maintain complete list
        const allPublications = publications.map(pub => {
            const enhanced = enhancedPublications.find(ep => ep.title === pub.title);
            return enhanced || pub; // Use enhanced version if available, otherwise keep original
        });
        
        // Save results
        this.savePublications(allPublications);
        
        console.log('\\n🎉 Abstract enhancement completed!');
        console.log('📈 Results:');
        console.log(`   • ${enhancedPublications.length} publications enhanced`);
        console.log(`   • Multilingual abstracts generated`);
        console.log(`   • Ready for homepage display`);
        
        if (!availableService) {
            console.log('\\n💡 Next steps for better results:');
            console.log('   • Add LLM API keys to .env file');
            console.log('   • Re-run this script for AI-generated abstracts');
        }
    }
}

// CLI interface
async function main() {
    const mode = process.argv[2] || 'auto';
    const generator = new LLMAbstractGenerator();
    
    try {
        await generator.run(mode);
    } catch (error) {
        console.error('💥 Enhancement failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = LLMAbstractGenerator;