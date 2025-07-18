// Language detection and management
let currentLang = 'en';
let translations = {
  "en": {
    "title": "Scholar & Developer",
    "bio": "Passionate researcher exploring the intersection of mathematics, biology, and technology. Focused on computational modeling and innovative solutions for complex systems.",
    "cv-download": "Download CV",
    "publications-title": "Publications",
    "projects-title": "Projects",
    "experiences-title": "Experiences",
    "ongoing-project-title": "Ongoing project",
    "achievements-title": "Achievements",
    "educations-title": "Educations",
    "sort-by": "Sort by:",
    "sort-date": "Date",
    "sort-citations": "Citations",
    "sort-title": "Title",
    "visitor-count": "Visitors:",
    "view-abstract": "View Abstract",
    "hide-abstract": "Hide Abstract",
    "citations": "citations",
    "published-in": "Published in"
  },
  "ko": {
    "title": "학자 & 개발자",
    "bio": "수학, 생물학, 기술의 교차점을 탐구하는 열정적인 연구자입니다. 복잡한 시스템을 위한 계산 모델링과 혁신적인 솔루션에 중점을 두고 있습니다.",
    "cv-download": "이력서 다운로드",
    "publications-title": "출판물",
    "projects-title": "프로젝트",
    "experiences-title": "경험",
    "ongoing-project-title": "진행중인 프로젝트",
    "achievements-title": "성과",
    "educations-title": "교육",
    "sort-by": "정렬 기준:",
    "sort-date": "날짜",
    "sort-citations": "인용수",
    "sort-title": "제목",
    "visitor-count": "방문자:",
    "view-abstract": "초록 보기",
    "hide-abstract": "초록 숨기기",
    "citations": "인용",
    "published-in": "게재지"
  },
  "fr": {
    "title": "Chercheur & Développeur",
    "bio": "Chercheur passionné explorant l'intersection des mathématiques, de la biologie et de la technologie. Axé sur la modélisation computationnelle et les solutions innovantes pour les systèmes complexes.",
    "cv-download": "Télécharger CV",
    "publications-title": "Publications",
    "projects-title": "Projets",
    "experiences-title": "Expériences",
    "ongoing-project-title": "Projet en cours",
    "achievements-title": "Réalisations",
    "educations-title": "Éducations",
    "sort-by": "Trier par:",
    "sort-date": "Date",
    "sort-citations": "Citations",
    "sort-title": "Titre",
    "visitor-count": "Visiteurs:",
    "view-abstract": "Voir le résumé",
    "hide-abstract": "Masquer le résumé",
    "citations": "citations",
    "published-in": "Publié dans"
  }
};
let publications = [];
let projects = [];
let config = {};

// Load config from config.json
async function loadConfig() {
    try {
        console.log('⚙️ Loading config...');
        const response = await fetch('config.json');
        config = await response.json();
        console.log('✅ Config loaded successfully');
    } catch (error) {
        console.error('❌ Error loading config:', error);
        config = {}; // fallback to empty config
    }
}

// Load translations (now just returns immediately since they're embedded)
async function loadTranslations() {
    // Translations are embedded in the code
}

// Detect browser language
function detectLanguage() {
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('ko')) return 'ko';
    if (browserLang.startsWith('fr')) return 'fr';
    return 'en';
}

// Apply translations
function applyTranslations(lang) {
    console.log('Applying translations for language:', lang);
    currentLang = lang;
    document.documentElement.lang = lang;
    
    // Update language selector
    document.querySelectorAll('.language-selector button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    
    // Translate elements
    const elemsToTranslate = document.querySelectorAll('[data-i18n]');
    console.log('Found elements to translate:', elemsToTranslate.length);
    elemsToTranslate.forEach(elem => {
        const key = elem.getAttribute('data-i18n');
        console.log('Translating element with key:', key, 'to', translations[lang] && translations[lang][key]);
        if (translations[lang] && translations[lang][key]) {
            if (elem.tagName === 'INPUT' || elem.tagName === 'SELECT') {
                elem.placeholder = translations[lang][key];
            } else if (elem.tagName === 'OPTION') {
                elem.textContent = translations[lang][key];
            } else {
                // Handle elements with child nodes (like the CV download link with icon)
                const icon = elem.querySelector('i');
                if (icon) {
                    elem.innerHTML = icon.outerHTML + ' ' + translations[lang][key];
                } else {
                    elem.textContent = translations[lang][key];
                }
            }
        }
    });
    
    // Update select options
    const sortSelect = document.getElementById('sort-publications');
    if (sortSelect) {
        sortSelect.querySelectorAll('option').forEach(option => {
            const key = option.getAttribute('data-i18n');
            if (key && translations[lang] && translations[lang][key]) {
                option.textContent = translations[lang][key];
            }
        });
    }
    
    // Re-render dynamic content
    renderPublications();
    renderExperiences();
    renderOngoingProject();
    renderAchievements();
    renderEducations();
}

// Dynamic publication loading
async function loadPublications() {
    console.log('📚 Loading publications data...');
    
    try {
        // Try to load from generated JSON file first
        const response = await fetch('data/publications.json');
        
        if (response.ok) {
            const data = await response.json();
            console.log(`✅ Loaded ${data.length} publications from data file`);
            return data;
        } else {
            console.warn('⚠️ Publications data file not found, using sample data');
        }
    } catch (error) {
        console.warn('⚠️ Error loading publications data:', error.message);
    }
    
    // Fallback to sample data
    console.log('📄 Using sample publications data');
    return getSamplePublications();
}

// Sample publications as fallback
function getSamplePublications() {
    return [
        {
            date: "2024-03-01",
            title: "Optimized Control of Menstrual Cycle Hormones",
            journal: "Journal of Mathematical Biology",
            link: "https://journal-link.com",
            citations: 25,
            summary: {
                en: "This paper presents a novel mathematical framework for understanding and optimizing hormonal dynamics in the menstrual cycle, with potential applications in reproductive health management.",
                ko: "이 논문은 월경 주기의 호르몬 역학을 이해하고 최적화하기 위한 새로운 수학적 프레임워크를 제시하며, 생식 건강 관리에 잠재적인 응용 가능성을 가지고 있습니다.",
                fr: "Cet article présente un nouveau cadre mathématique pour comprendre et optimiser la dynamique hormonale du cycle menstruel, avec des applications potentielles dans la gestion de la santé reproductive."
            },
            thumbnail: "https://via.placeholder.com/400x200/667eea/ffffff?text=Hormonal+Control"
        },
        {
            date: "2023-11-15",
            title: "Machine Learning Applications in Biological Systems",
            journal: "Nature Computational Science",
            link: "https://journal-link.com",
            citations: 42,
            summary: {
                en: "A comprehensive review of machine learning techniques applied to biological systems, focusing on predictive modeling and pattern recognition in complex biological data.",
                ko: "복잡한 생물학적 데이터에서의 예측 모델링과 패턴 인식에 중점을 둔 생물학적 시스템에 적용된 기계 학습 기술에 대한 포괄적인 리뷰입니다.",
                fr: "Une revue complète des techniques d'apprentissage automatique appliquées aux systèmes biologiques, en se concentrant sur la modélisation prédictive et la reconnaissance de formes dans les données biologiques complexes."
            },
            thumbnail: "https://via.placeholder.com/400x200/764ba2/ffffff?text=ML+Biology"
        },
        {
            date: "2023-07-20",
            title: "Computational Framework for Disease Modeling",
            journal: "PLOS Computational Biology",
            link: "https://journal-link.com",
            citations: 18,
            summary: {
                en: "Development of a computational framework for modeling disease progression using differential equations and stochastic processes.",
                ko: "미분 방정식과 확률 과정을 사용하여 질병 진행을 모델링하기 위한 계산 프레임워크 개발.",
                fr: "Développement d'un cadre computationnel pour modéliser la progression de la maladie en utilisant des équations différentielles et des processus stochastiques."
            },
            thumbnail: "https://via.placeholder.com/400x200/667eea/ffffff?text=Disease+Modeling"
        }
    ];
}

// Sample projects data
// TODO: Implement dynamic project loading similar to publications
const sampleProjects = [
    {
        title: "BioSim Engine",
        description: {
            en: "A high-performance simulation engine for biological systems, capable of modeling complex cellular interactions and metabolic pathways.",
            ko: "복잡한 세포 상호작용과 대사 경로를 모델링할 수 있는 생물학적 시스템을 위한 고성능 시뮬레이션 엔진.",
            fr: "Un moteur de simulation haute performance pour les systèmes biologiques, capable de modéliser des interactions cellulaires complexes et des voies métaboliques."
        },
        image: "https://via.placeholder.com/400x200/667eea/ffffff?text=BioSim+Engine",
        tags: ["Python", "C++", "Biology", "Simulation"]
    },
    {
        title: "ML Health Predictor",
        description: {
            en: "Machine learning platform for predicting health outcomes based on multimodal patient data, including genomics and clinical records.",
            ko: "유전체학 및 임상 기록을 포함한 다중 모달 환자 데이터를 기반으로 건강 결과를 예측하는 기계 학습 플랫폼.",
            fr: "Plateforme d'apprentissage automatique pour prédire les résultats de santé basés sur des données multimodales de patients, y compris la génomique et les dossiers cliniques."
        },
        image: "https://via.placeholder.com/400x200/764ba2/ffffff?text=ML+Health",
        tags: ["Machine Learning", "Healthcare", "Python", "TensorFlow"]
    },
    {
        title: "Open Science Data Portal",
        description: {
            en: "Web platform for sharing and visualizing scientific data with interactive charts and collaborative features for researchers.",
            ko: "연구자를 위한 대화형 차트 및 협업 기능을 갖춘 과학 데이터 공유 및 시각화 웹 플랫폼.",
            fr: "Plateforme web pour partager et visualiser des données scientifiques avec des graphiques interactifs et des fonctionnalités collaboratives pour les chercheurs."
        },
        image: "https://via.placeholder.com/400x200/667eea/ffffff?text=Data+Portal",
        tags: ["React", "D3.js", "Node.js", "Open Science"]
    }
];

// Render publications
function renderPublications() {
    try {
        const container = document.getElementById('publications-container');
        if (!container) {
            console.error('publications-container element not found');
            return;
        }
        container.innerHTML = '';
    
    publications.forEach((pub, index) => {
        const pubElement = document.createElement('div');
        pubElement.className = 'publication-item';
        pubElement.innerHTML = `
            <div class="publication-header">
                <img src="${pub.thumbnail}" alt="${pub.title}" class="publication-thumbnail">
                <div class="publication-content">
                    <div class="publication-title-wrapper">
                        <h3 class="publication-title">${pub.title}</h3>
                        <a href="${pub.link}" target="_blank" class="journal-icon" title="View Journal Article">
                            <i class="fas fa-external-link-alt"></i>
                        </a>
                    </div>
                    <div class="publication-meta">
                        <span><i class="fas fa-calendar"></i> ${new Date(pub.date).toLocaleDateString(currentLang)}</span>
                        <span><i class="fas fa-book"></i> ${pub.journal}</span>
                        <span><i class="fas fa-quote-right"></i> ${pub.citations} ${translations[currentLang]['citations']}</span>
                    </div>
                </div>
            </div>
            <div class="publication-abstract">
                ${pub.summary[currentLang]}
            </div>
        `;
        
        pubElement.addEventListener('click', function(e) {
            if (!e.target.closest('a') && !e.target.closest('.journal-icon')) {
                this.classList.toggle('expanded');
            }
        });
        
        container.appendChild(pubElement);
    });
    } catch (error) {
        console.error('Error rendering publications:', error);
    }
}

// Render experiences
function renderExperiences() {
    try {
        const container = document.getElementById('experiences-container');
        if (!container) {
            console.error('experiences-container element not found');
            return;
        }
        container.innerHTML = '';
    
        const experiences = config.experiences || [];
        experiences.forEach((exp, index) => {
            const expElement = document.createElement('li');
            expElement.textContent = exp.title;
            container.appendChild(expElement);
        });
    } catch (error) {
        console.error('Error rendering experiences:', error);
    }
}

// Render ongoing project
function renderOngoingProject() {
    try {
        const container = document.getElementById('ongoing-project-container');
        if (!container) {
            console.error('ongoing-project-container element not found');
            return;
        }
        container.innerHTML = '';
    
        const project = config.ongoingProject || {};
        const projectElement = document.createElement('div');
        projectElement.className = 'ongoing-project-item';
        projectElement.innerHTML = `
            <div class="project-name">${project.name || 'No ongoing project'}</div>
            <div class="progress-container">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${project.progress || 0}%"></div>
                </div>
                <span class="progress-text">${project.progress || 0}%</span>
            </div>
        `;
        
        container.appendChild(projectElement);
    } catch (error) {
        console.error('Error rendering ongoing project:', error);
    }
}

// Render achievements
function renderAchievements() {
    try {
        const container = document.getElementById('achievements-container');
        if (!container) {
            console.error('achievements-container element not found');
            return;
        }
        container.innerHTML = '';
    
        const achievements = config.achievements || [];
        achievements.forEach((achievement, index) => {
            const achievementElement = document.createElement('div');
            achievementElement.className = 'achievement-item';
            achievementElement.innerHTML = `
                <div class="achievement-name">${achievement.name}</div>
                <div class="achievement-period">${achievement.period}</div>
                <div class="achievement-where">${achievement.where}</div>
            `;
            container.appendChild(achievementElement);
        });
    } catch (error) {
        console.error('Error rendering achievements:', error);
    }
}

// Render educations
function renderEducations() {
    try {
        const container = document.getElementById('educations-container');
        if (!container) {
            console.error('educations-container element not found');
            return;
        }
        container.innerHTML = '';
    
        const educations = config.educations || [];
        educations.forEach((education, index) => {
            const educationElement = document.createElement('div');
            educationElement.className = 'education-item';
            educationElement.innerHTML = `
                <div class="education-degree">${education.degree}</div>
                <div class="education-university">${education.university}</div>
                <div class="education-period">${education.period}</div>
                <div class="education-gpa">${education.gpa}</div>
            `;
            container.appendChild(educationElement);
        });
    } catch (error) {
        console.error('Error rendering educations:', error);
    }
}

// Sort publications
function sortPublications(by) {
    switch(by) {
        case 'date':
            publications.sort((a, b) => new Date(b.date) - new Date(a.date));
            break;
        case 'citations':
            publications.sort((a, b) => b.citations - a.citations);
            break;
        case 'title':
            publications.sort((a, b) => a.title.localeCompare(b.title));
            break;
    }
    renderPublications();
}

// Visitor counter (simulated)
function updateVisitorCount() {
    try {
        const count = localStorage.getItem('visitorCount') || '0';
        const newCount = parseInt(count) + 1;
        localStorage.setItem('visitorCount', newCount.toString());
        const visitorCountElement = document.getElementById('visitor-count');
        if (visitorCountElement) {
            visitorCountElement.textContent = newCount.toLocaleString();
        } else {
            console.error('visitor-count element not found');
        }
    } catch (error) {
        console.error('Error updating visitor count:', error);
    }
}

// Initialize
async function init() {
    try {
        console.log('Initializing app...');
        await loadTranslations();
        await loadConfig();
        
        // Set initial language
        const detectedLang = detectLanguage();
        console.log('Detected language:', detectedLang);
        applyTranslations(detectedLang);
        
        // Load publication data dynamically
        publications = await loadPublications();
        projects = []; // No projects for now
        
        console.log(`📊 Loaded ${publications.length} publications`);
        
        // Render content
        renderPublications();
        renderExperiences();
        renderOngoingProject();
        renderAchievements();
        renderEducations();
        
        // Update visitor count
        updateVisitorCount();
        
        // Event listeners
        const languageButtons = document.querySelectorAll('.language-selector button');
        console.log('Found language buttons:', languageButtons.length);
        languageButtons.forEach(btn => {
            console.log('Adding event listener to button:', btn.dataset.lang);
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Language button clicked:', btn.dataset.lang);
                applyTranslations(btn.dataset.lang);
            });
        });
        
        const sortSelect = document.getElementById('sort-publications');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                sortPublications(e.target.value);
            });
        }
        
        console.log('App initialization completed successfully');
    } catch (error) {
        console.error('Error during app initialization:', error);
    }
}

// Start the app
document.addEventListener('DOMContentLoaded', init);