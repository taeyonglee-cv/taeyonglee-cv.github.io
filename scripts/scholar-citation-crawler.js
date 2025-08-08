#!/usr/bin/env node

/**
 * Google Scholar Profile Citation Crawler
 * 
 * Fetches accurate citation counts directly from the user's Google Scholar profile page
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

class ScholarCitationCrawler {
    constructor() {
        this.publicationsFile = path.join(__dirname, '..', 'data', 'publications.json');
        this.configFile = path.join(__dirname, '..', 'config.json');
        this.delay = 1000; // 1 second between requests
        
        // User-Agent 목록 추가
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
        ];
    }

    // 랜덤 User-Agent 선택
    getRandomUserAgent() {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    // 랜덤 딜레이 추가
    randomDelay(min = 2000, max = 5000) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    loadConfig() {
        try {
            return JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
        } catch (error) {
            console.error('❌ Could not load config.json:', error.message);
            return {};
        }
    }

    loadPublications() {
        try {
            return JSON.parse(fs.readFileSync(this.publicationsFile, 'utf8'));
        } catch (error) {
            console.error('❌ Could not load publications:', error.message);
            return [];
        }
    }

    savePublications(publications) {
        try {
            const dataDir = path.dirname(this.publicationsFile);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            fs.writeFileSync(this.publicationsFile, JSON.stringify(publications, null, 2));
            console.log('✅ Publications updated successfully');
        } catch (error) {
            console.error('❌ Could not save publications:', error.message);
        }
    }

    // 개선된 Scholar profile 가져오기 (재시도 로직 포함)
    async fetchScholarProfile(scholarId, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`🔍 Fetching Google Scholar profile (attempt ${attempt}/${maxRetries}): ${scholarId}`);
            
            // 첫 번째 시도가 아니면 딜레이 추가
            if (attempt > 1) {
                const waitTime = Math.min(30000, 5000 * Math.pow(2, attempt - 1));
                console.log(`⏳ Waiting ${waitTime/1000} seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            // 랜덤 딜레이 추가
            await this.randomDelay(2000, 5000);

            const result = await new Promise((resolve) => {
                const options = {
                    hostname: 'scholar.google.com',
                    port: 443,
                    path: `/citations?user=${scholarId}&hl=en&pagesize=100`,
                    method: 'GET',
                    headers: {
                        'User-Agent': this.getRandomUserAgent(),
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Accept-Encoding': 'identity',
                        'DNT': '1',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'none',
                        'Cache-Control': 'max-age=0'
                    }
                };

                const req = https.request(options, (res) => {
                    let data = '';
                    
                    res.on('data', (chunk) => {
                        data += chunk;
                    });
                    
                    res.on('end', () => {
                        if (res.statusCode === 200) {
                            console.log(`✅ Successfully fetched profile (${data.length} characters)`);
                            resolve({ success: true, data: data });
                        } else {
                            console.log(`❌ Error fetching profile: HTTP ${res.statusCode}`);
                            resolve({ success: false, statusCode: res.statusCode });
                        }
                    });
                });

                req.on('error', (error) => {
                    console.log(`❌ Request error: ${error.message}`);
                    resolve({ success: false, error: error.message });
                });

                req.setTimeout(20000, () => {
                    console.log(`⏰ Request timeout`);
                    req.destroy();
                    resolve({ success: false, error: 'timeout' });
                });

                req.end();
            });

            if (result.success) {
                return result.data;
            } else if (result.statusCode === 403) {
                console.log(`🚫 Got 403 Forbidden on attempt ${attempt}`);
                if (attempt < maxRetries) {
                    console.log(`💡 This might be temporary blocking, will retry with longer delay...`);
                }
            }
        }

        console.error(`❌ Failed to fetch Scholar profile after ${maxRetries} attempts`);
        return '';
    }

    // Extract publications and citations from Scholar profile HTML
    parseScholarProfile(html) {
        const publications = [];
        
        try {
            // Look for publication entries in the HTML
            // Google Scholar uses specific patterns for publication listings
            
            // Method 1: Look for citation count patterns near titles
            const titleCitationPattern = /<a[^>]*class="gsc_a_at"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]*class="gsc_a_ac[^"]*"[^>]*>(\d+)<\/a>/g;
            let match;
            
            while ((match = titleCitationPattern.exec(html)) !== null) {
                const title = match[1].trim();
                const citations = parseInt(match[2]);
                
                publications.push({
                    title: title,
                    citations: citations
                });
            }

            // Method 2: Alternative pattern matching
            if (publications.length === 0) {
                // Try different patterns for citation extraction
                const alternativePattern = /<tr[^>]*class="gsc_a_tr"[^>]*>[\s\S]*?<a[^>]*class="gsc_a_at"[^>]*>([^<]+)<\/a>[\s\S]*?<td[^>]*class="gsc_a_c"[^>]*><a[^>]*>(\d+)<\/a>/g;
                
                while ((match = alternativePattern.exec(html)) !== null) {
                    const title = match[1].trim();
                    const citations = parseInt(match[2]);
                    
                    publications.push({
                        title: title,
                        citations: citations
                    });
                }
            }

            // Method 3: Look for any citation numbers in the page
            if (publications.length === 0) {
                console.log('📄 Trying to extract raw citation data...');
                const citationNumbers = html.match(/gsc_a_ac[^>]*>(\d+)</g);
                const titleElements = html.match(/gsc_a_at[^>]*>([^<]+)</g);
                
                if (citationNumbers && titleElements && citationNumbers.length === titleElements.length) {
                    for (let i = 0; i < Math.min(citationNumbers.length, titleElements.length); i++) {
                        const citations = parseInt(citationNumbers[i].match(/(\d+)/)[1]);
                        const title = titleElements[i].match(/>([^<]+)/)[1].trim();
                        
                        publications.push({
                            title: title,
                            citations: citations
                        });
                    }
                }
            }

            console.log(`📊 Extracted ${publications.length} publications from Scholar profile`);
            return publications;
            
        } catch (error) {
            console.error(`❌ Error parsing Scholar profile: ${error.message}`);
            return [];
        }
    }

    // Match publication titles (fuzzy matching for slight differences)
    matchTitle(localTitle, scholarTitle) {
        // Normalize titles for comparison
        const normalize = (title) => {
            return title.toLowerCase()
                       .replace(/[^\w\s]/g, ' ')
                       .replace(/\s+/g, ' ')
                       .trim();
        };

        const localNorm = normalize(localTitle);
        const scholarNorm = normalize(scholarTitle);

        // Exact match
        if (localNorm === scholarNorm) return true;

        // Check if one contains the other (for truncated titles)
        if (localNorm.includes(scholarNorm) || scholarNorm.includes(localNorm)) return true;

        // Check first 5 words match (for very long titles)
        const localWords = localNorm.split(' ').slice(0, 5).join(' ');
        const scholarWords = scholarNorm.split(' ').slice(0, 5).join(' ');
        
        return localWords === scholarWords;
    }

    async updateCitationsFromScholar() {
        console.log('📊 Google Scholar Profile Citation Crawler');
        console.log('==========================================');
        
        const config = this.loadConfig();
        const publications = this.loadPublications();
        
        // Extract Scholar ID from nested config structure
        let scholarId = config.author?.scholarId || config.scholarId;
        let googleScholarUrl = config.social?.googleScholar || config.googleScholar;
        
        if (!scholarId && !googleScholarUrl) {
            console.error('❌ No Scholar ID found in config.json');
            console.log('💡 Please add "scholarId" to author section or "googleScholar" to social section');
            return;
        }

        // Extract Scholar ID from Google Scholar URL if needed
        if (!scholarId && googleScholarUrl) {
            const match = googleScholarUrl.match(/user=([^&]+)/);
            scholarId = match ? match[1] : null;
        }

        if (!scholarId) {
            console.error('❌ Could not extract Scholar ID from config');
            return;
        }

        console.log(`👤 Using Scholar ID: ${scholarId}`);
        console.log(`📚 Found ${publications.length} local publications to update\n`);

        // Fetch Scholar profile with retry logic
        const profileHtml = await this.fetchScholarProfile(scholarId);
        if (!profileHtml) {
            console.error('❌ Could not fetch Scholar profile after multiple attempts');
            console.log('💡 This might be due to temporary blocking or Google Scholar\'s anti-bot measures');
            console.log('🔗 Please check manually at: ' + (googleScholarUrl || `https://scholar.google.com/citations?user=${scholarId}`));
            
            // 기존 데이터 유지하고 종료
            if (publications.length > 0) {
                console.log('📝 Keeping existing citation data');
                return;
            } else {
                // 에러로 종료하여 GitHub Actions에서 감지되도록
                process.exit(1);
            }
        }

        // Parse publications from Scholar profile
        const scholarPublications = this.parseScholarProfile(profileHtml);
        if (scholarPublications.length === 0) {
            console.error('❌ Could not parse publications from Scholar profile');
            console.log('💡 This might be due to Google Scholar\'s page structure changes');
            console.log('🔗 Please check manually at: ' + (googleScholarUrl || `https://scholar.google.com/citations?user=${scholarId}`));
            
            // 기존 데이터 유지
            if (publications.length > 0) {
                console.log('📝 Keeping existing citation data');
                return;
            } else {
                process.exit(1);
            }
        }

        console.log(`📊 Found ${scholarPublications.length} publications in Scholar profile\n`);

        // Match and update citations
        let updated = 0;
        for (const publication of publications) {
            console.log(`🔍 Matching: "${publication.title.substring(0, 60)}..."`);
            
            let matched = false;
            for (const scholarPub of scholarPublications) {
                if (this.matchTitle(publication.title, scholarPub.title)) {
                    const oldCitations = publication.citations || 0;
                    publication.citations = scholarPub.citations;
                    publication.citations_updated_at = new Date().toISOString();
                    
                    console.log(`   ✅ Matched with: "${scholarPub.title.substring(0, 60)}..."`);
                    console.log(`   📈 Citations: ${oldCitations} → ${scholarPub.citations}`);
                    
                    if (oldCitations !== scholarPub.citations) {
                        updated++;
                    }
                    matched = true;
                    break;
                }
            }
            
            if (!matched) {
                console.log(`   ⚠️ No match found in Scholar profile`);
                publication.citations = publication.citations || 0;
            }
        }

        // Save updated publications
        this.savePublications(publications);
        
        const totalCitations = publications.reduce((sum, pub) => sum + (pub.citations || 0), 0);
        
        console.log('\n🎉 Citation update completed!');
        console.log('📈 Results:');
        console.log(`   • ${publications.length} publications processed`);
        console.log(`   • ${updated} citation counts updated`);
        console.log(`   • ${totalCitations} total citations`);
        console.log(`   • Data source: Google Scholar profile`);
        
        // Show top cited papers
        const topCited = publications
            .filter(pub => pub.citations > 0)
            .sort((a, b) => b.citations - a.citations)
            .slice(0, 5);
            
        if (topCited.length > 0) {
            console.log('\n🏆 Top cited papers:');
            topCited.forEach((pub, index) => {
                console.log(`   ${index + 1}. ${pub.citations} citations: "${pub.title.substring(0, 60)}..."`);
            });
        }
    }
}

// Run Scholar citation crawler
const crawler = new ScholarCitationCrawler();
crawler.updateCitationsFromScholar().catch(console.error);
