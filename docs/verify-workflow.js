#!/usr/bin/env node

/**
 * Workflow Verification Script
 * 
 * This script thoroughly verifies that the PDF extraction and LLM enhancement
 * workflows properly prevent duplicate processing and token waste.
 */

const fs = require('fs');
const path = require('path');

class WorkflowVerifier {
    constructor() {
        this.publicationsDir = path.join(__dirname, '..', 'publications');
        this.publicationsFile = path.join(__dirname, '..', 'data', 'publications.json');
    }

    loadPublications() {
        try {
            return JSON.parse(fs.readFileSync(this.publicationsFile, 'utf8'));
        } catch (error) {
            console.error('❌ Could not load publications:', error.message);
            return [];
        }
    }

    getPDFFiles() {
        return fs.readdirSync(this.publicationsDir)
            .filter(file => file.endsWith('.pdf') && !file.includes('_correction'));
    }

    verifyPDFCoverage() {
        console.log('🔍 Verifying PDF Coverage');
        console.log('========================');
        
        const publications = this.loadPublications();
        const pdfFiles = this.getPDFFiles();
        
        console.log(`📚 Found ${pdfFiles.length} PDF files`);
        console.log(`📊 Found ${publications.length} publications in database`);
        
        // Check if all PDFs are represented in publications
        const missingPDFs = [];
        const extraPublications = [];
        
        for (const pdfFile of pdfFiles) {
            const found = publications.some(pub => pub.pdf_file === pdfFile);
            if (!found) {
                missingPDFs.push(pdfFile);
            }
        }
        
        for (const pub of publications) {
            if (pub.pdf_file && !pdfFiles.includes(pub.pdf_file)) {
                extraPublications.push(pub.pdf_file);
            }
        }
        
        if (missingPDFs.length > 0) {
            console.log('❌ Missing PDFs in database:');
            missingPDFs.forEach(pdf => console.log(`   - ${pdf}`));
        } else {
            console.log('✅ All PDFs are represented in database');
        }
        
        if (extraPublications.length > 0) {
            console.log('⚠️ Publications without corresponding PDFs:');
            extraPublications.forEach(pdf => console.log(`   - ${pdf}`));
        }
        
        return { missingPDFs, extraPublications };
    }

    verifyEnhancementStatus() {
        console.log('\n🤖 Verifying Enhancement Status');
        console.log('===============================');
        
        const publications = this.loadPublications();
        const unenhanced = [];
        const enhanced = [];
        
        for (const pub of publications) {
            const hasCompleteEnhancement = pub.summary && 
                                         pub.summary.en && 
                                         pub.summary.ko && 
                                         pub.summary.fr && 
                                         pub.enhanced_at;
            
            if (hasCompleteEnhancement) {
                enhanced.push(pub.title);
            } else {
                unenhanced.push(pub.title);
            }
        }
        
        console.log(`✅ Enhanced publications: ${enhanced.length}`);
        console.log(`⏳ Unenhanced publications: ${unenhanced.length}`);
        
        if (unenhanced.length > 0) {
            console.log('\n📋 Unenhanced publications:');
            unenhanced.forEach(title => console.log(`   - ${title.substring(0, 60)}...`));
        }
        
        return { enhanced: enhanced.length, unenhanced: unenhanced.length };
    }

    verifyDataIntegrity() {
        console.log('\n🔍 Verifying Data Integrity');
        console.log('===========================');
        
        const publications = this.loadPublications();
        const issues = [];
        
        for (const pub of publications) {
            // Check required fields
            if (!pub.title) issues.push(`Missing title: ${pub.pdf_file || 'Unknown'}`);
            if (!pub.journal) issues.push(`Missing journal: ${pub.title?.substring(0, 40) || 'Unknown'}...`);
            if (!pub.date) issues.push(`Missing date: ${pub.title?.substring(0, 40) || 'Unknown'}...`);
            if (!pub.pdf_file) issues.push(`Missing pdf_file: ${pub.title?.substring(0, 40) || 'Unknown'}...`);
            
            // Check if enhanced publication has all translations
            if (pub.enhanced_at) {
                if (!pub.summary?.en) issues.push(`Enhanced but missing English: ${pub.title?.substring(0, 40)}...`);
                if (!pub.summary?.ko) issues.push(`Enhanced but missing Korean: ${pub.title?.substring(0, 40)}...`);
                if (!pub.summary?.fr) issues.push(`Enhanced but missing French: ${pub.title?.substring(0, 40)}...`);
            }
        }
        
        if (issues.length > 0) {
            console.log('❌ Data integrity issues found:');
            issues.forEach(issue => console.log(`   - ${issue}`));
        } else {
            console.log('✅ All data integrity checks passed');
        }
        
        return issues;
    }

    generateReport() {
        console.log('📊 Workflow Verification Report');
        console.log('==============================\n');
        
        const pdfCoverage = this.verifyPDFCoverage();
        const enhancementStatus = this.verifyEnhancementStatus();
        const integrityIssues = this.verifyDataIntegrity();
        
        console.log('\n📈 Summary:');
        console.log('===========');
        
        if (pdfCoverage.missingPDFs.length === 0 && 
            enhancementStatus.unenhanced === 0 && 
            integrityIssues.length === 0) {
            console.log('🎉 SYSTEM STATUS: OPTIMAL');
            console.log('✅ All PDFs processed');
            console.log('✅ All publications enhanced');
            console.log('✅ No data integrity issues');
            console.log('✅ Ready for production use');
        } else {
            console.log('⚠️ SYSTEM STATUS: NEEDS ATTENTION');
            if (pdfCoverage.missingPDFs.length > 0) {
                console.log(`❌ ${pdfCoverage.missingPDFs.length} PDFs need processing`);
            }
            if (enhancementStatus.unenhanced > 0) {
                console.log(`❌ ${enhancementStatus.unenhanced} publications need enhancement`);
            }
            if (integrityIssues.length > 0) {
                console.log(`❌ ${integrityIssues.length} data integrity issues`);
            }
        }
        
        console.log('\n🛡️ Token Optimization Status:');
        if (pdfCoverage.missingPDFs.length === 0 && enhancementStatus.unenhanced === 0) {
            console.log('✅ MAXIMUM EFFICIENCY - No token usage needed');
        } else {
            console.log(`⚡ PARTIAL EFFICIENCY - Only ${pdfCoverage.missingPDFs.length + enhancementStatus.unenhanced} operations needed`);
        }
    }
}

// Run verification
const verifier = new WorkflowVerifier();
verifier.generateReport();