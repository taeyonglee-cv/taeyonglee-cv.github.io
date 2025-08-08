#!/usr/bin/env node

/**
 * Google Scholar Profile Citation Crawler with Proxy Support
 * 
 * Fetches citation counts using rotating proxies to avoid IP blocking
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class ProxyScholarCrawler {
    constructor() {
        this.publicationsFile = path.join(__dirname, '..', 'data', 'publications.json');
        this.configFile = path.join(__dirname, '..', 'config.json');
        
        // 무료 프록시 목록 (동적으로 가져올 수도 있음)
        this.proxyList = [
            // 이 부분은 실시간으로 무료 프록시를 가져오는 로직으로 대체
        ];
        
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
        ];
    }

    // 여러 소스에서 무료 프록시 가져오기
    async getFreeProxies() {
        const proxySources = [
            'https://api.proxyscrape.com/v2/?request=get&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all&format=textplain',
            'https://www.proxy-list.download/api/v1/get?type=http',
            'https://api.openproxylist.xyz/http.txt'
        ];
    
        const allProxies = [];
    
        for (const sourceUrl of proxySources) {
            try {
                const url = new URL(sourceUrl);
                const options = {
                    hostname: url.hostname,
                    path: url.pathname + url.search,
                    method: 'GET',
                    timeout: 10000
                };
    
                const proxies = await new Promise((resolve) => {
                    const protocol = url.protocol === 'https:' ? https : http;
                    const req = protocol.request(options, (res) => {
                        let data = '';
                        res.on('data', chunk => data += chunk);
                        res.on('end', () => {
                            const proxies = data.split('\n')
                                .filter(line => line.trim())
                                .map(line => {
                                    const [ip, port] = line.trim().split(':');
                                    return { host: ip, port: parseInt(port) };
                                })
                                .filter(proxy => proxy.host && proxy.port && !isNaN(proxy.port));
                            
                            resolve(proxies);
                        });
                    });
    
                    req.on('error', () => resolve([]));
                    req.setTimeout(10000, () => {
                        req.destroy();
                        resolve([]);
                    });
                    req.end();
                });
    
                allProxies.push(...proxies.slice(0, 5));
            } catch (error) {
                continue;
            }
        }
    
        // 백업 프록시 추가
        if (allProxies.length === 0) {
            allProxies.push(
                { host: '8.208.84.236', port: 3128 },
                { host: '20.111.54.16', port: 8123 },
                { host: '103.117.192.14', port: 80 },
                { host: '167.172.173.210', port: 37849 },
                { host: '185.82.96.51', port: 9091 }
            );
        }
    
        console.log(`📡 Found ${allProxies.length} free proxies`);
        return allProxies.slice(0, 15);
    }

    // 프록시를 통한 요청
    async fetchWithProxy(url, proxy = null) {
        return new Promise((resolve) => {
            const urlObj = new URL(url);
            const isHttps = urlObj.protocol === 'https:';
            
            const options = {
                hostname: proxy ? proxy.host : urlObj.hostname,
                port: proxy ? proxy.port : (isHttps ? 443 : 80),
                path: proxy ? url : urlObj.pathname + urlObj.search,
                method: 'GET',
                headers: {
                    'User-Agent': this.userAgents[Math.floor(Math.random() * this.userAgents.length)],
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Referer': 'https://scholar.google.com/',
                    'Host': urlObj.hostname
                }
            };

            if (proxy) {
                console.log(`🔄 Trying proxy: ${proxy.host}:${proxy.port}`);
            }

            const protocol = proxy ? http : (isHttps ? https : http);
            const req = protocol.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        console.log(`✅ Success via ${proxy ? 'proxy' : 'direct'} (${data.length} chars)`);
                        resolve({ success: true, data });
                    } else {
                        console.log(`❌ HTTP ${res.statusCode} via ${proxy ? 'proxy' : 'direct'}`);
                        resolve({ success: false, statusCode: res.statusCode });
                    }
                });
            });

            req.on('error', (error) => {
                console.log(`❌ Error via ${proxy ? 'proxy' : 'direct'}: ${error.message}`);
                resolve({ success: false, error: error.message });
            });

            req.setTimeout(25000, () => {
                req.destroy();
                console.log(`⏰ Timeout via ${proxy ? 'proxy' : 'direct'}`);
                resolve({ success: false, error: 'timeout' });
            });

            req.end();
        });
    }

    // 다중 방법으로 Scholar 프로필 가져오기
    async fetchScholarProfileMultiMethod(scholarId) {
        const url = `https://scholar.google.com/citations?user=${scholarId}&hl=en&pagesize=100`;
        
        console.log(`🔍 Fetching Scholar profile: ${scholarId}`);
        
        // 방법 1: 직접 연결
        console.log('📡 Method 1: Direct connection');
        await this.randomDelay(3000, 6000);
        let result = await this.fetchWithProxy(url);
        if (result.success) return result.data;

        // 방법 2: 무료 프록시 사용
        console.log('📡 Method 2: Free proxies');
        const proxies = await this.getFreeProxies();
        await this.randomDelay(3000, 6000);
        
        for (const proxy of proxies.slice(0, 10)) { // 상위 5개 프록시만 시도
            await this.randomDelay(3000, 5000);
            result = await this.fetchWithProxy(url, proxy);
            if (result.success) return result.data;
        }

        // 방법 3: 다른 User-Agent로 직접 재시도
        console.log('📡 Method 3: Different user agents');
        for (let i = 0; i < 3; i++) {
            await this.randomDelay(5000, 8000);
            result = await this.fetchWithProxy(url);
            if (result.success) return result.data;
        }

        console.error('❌ All methods failed');
        return null;
    }

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

    // HTML 파싱 (기존과 동일)
    parseScholarProfile(html) {
        const publications = [];
        
        try {
            const titleCitationPattern = /<a[^>]*class="gsc_a_at"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]*class="gsc_a_ac[^"]*"[^>]*>(\d+)<\/a>/g;
            let match;
            
            while ((match = titleCitationPattern.exec(html)) !== null) {
                const title = match[1].trim();
                const citations = parseInt(match[2]);
                publications.push({ title, citations });
            }

            if (publications.length === 0) {
                const alternativePattern = /<tr[^>]*class="gsc_a_tr"[^>]*>[\s\S]*?<a[^>]*class="gsc_a_at"[^>]*>([^<]+)<\/a>[\s\S]*?<td[^>]*class="gsc_a_c"[^>]*><a[^>]*>(\d+)<\/a>/g;
                
                while ((match = alternativePattern.exec(html)) !== null) {
                    const title = match[1].trim();
                    const citations = parseInt(match[2]);
                    publications.push({ title, citations });
                }
            }

            if (publications.length === 0) {
                const citationNumbers = html.match(/gsc_a_ac[^>]*>(\d+)</g);
                const titleElements = html.match(/gsc_a_at[^>]*>([^<]+)</g);
                
                if (citationNumbers && titleElements && citationNumbers.length === titleElements.length) {
                    for (let i = 0; i < Math.min(citationNumbers.length, titleElements.length); i++) {
                        const citations = parseInt(citationNumbers[i].match(/(\d+)/)[1]);
                        const title = titleElements[i].match(/>([^<]+)/)[1].trim();
                        publications.push({ title, citations });
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

    matchTitle(localTitle, scholarTitle) {
        const normalize = (title) => {
            return title.toLowerCase()
                       .replace(/[^\w\s]/g, ' ')
                       .replace(/\s+/g, ' ')
                       .trim();
        };

        const localNorm = normalize(localTitle);
        const scholarNorm = normalize(scholarTitle);

        if (localNorm === scholarNorm) return true;
        if (localNorm.includes(scholarNorm) || scholarNorm.includes(localNorm)) return true;

        const localWords = localNorm.split(' ').slice(0, 5).join(' ');
        const scholarWords = scholarNorm.split(' ').slice(0, 5).join(' ');
        
        return localWords === scholarWords;
    }

    async updateCitationsFromScholar() {
        console.log('📊 Google Scholar Citation Crawler (Multi-Method)');
        console.log('==================================================');
        
        const config = this.loadConfig();
        const publications = this.loadPublications();
        
        let scholarId = config.author?.scholarId || config.scholarId;
        let googleScholarUrl = config.social?.googleScholar || config.googleScholar;
        
        if (!scholarId && !googleScholarUrl) {
            console.error('❌ No Scholar ID found in config.json');
            return;
        }

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

        // 다중 방법으로 프로필 가져오기
        const profileHtml = await this.fetchScholarProfileMultiMethod(scholarId);
        if (!profileHtml) {
            console.error('❌ Could not fetch Scholar profile with any method');
            
            if (publications.length > 0) {
                console.log('📝 Keeping existing citation data');
                return;
            } else {
                process.exit(1);
            }
        }

        const scholarPublications = this.parseScholarProfile(profileHtml);
        if (scholarPublications.length === 0) {
            console.error('❌ Could not parse publications from Scholar profile');
            
            if (publications.length > 0) {
                console.log('📝 Keeping existing citation data');
                return;
            } else {
                process.exit(1);
            }
        }

        console.log(`📊 Found ${scholarPublications.length} publications in Scholar profile\n`);

        // 인용수 업데이트
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

        this.savePublications(publications);
        
        const totalCitations = publications.reduce((sum, pub) => sum + (pub.citations || 0), 0);
        
        console.log('\n🎉 Citation update completed!');
        console.log('📈 Results:');
        console.log(`   • ${publications.length} publications processed`);
        console.log(`   • ${updated} citation counts updated`);
        console.log(`   • ${totalCitations} total citations`);
        console.log(`   • Data source: Google Scholar (multi-method)`);
        
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

const crawler = new ProxyScholarCrawler();
crawler.updateCitationsFromScholar().catch(console.error);
