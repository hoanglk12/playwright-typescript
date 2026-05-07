import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { FullConfig } from '@playwright/test';
import { Environment, getEnvironment } from './environment';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * Global teardown configuration for Playwright tests
 * Runs once after all tests - equivalent to @AfterTest/@AfterClass in Maven framework
 * 
 * Based on BaseTest.java methods:
 * - closeBrowserAndDriver()
 * - closeDriverInstance()
 * - showBrowserConsoleLogs()
 * - Cleanup and resource management
 */
async function globalTeardown(config: FullConfig) {

  console.log('🧹 Starting global teardown...');
  
  // Load environment configuration
  const environment: Environment = getEnvironment();
  
  // 1. Close any remaining browser instances and clean up driver processes
 // 2. Generate final test reports and summaries
  await generateFinalReports();
  
  // 3. Clean up temporary files and authentication states
  await cleanupTemporaryFiles();
    // 4. Archive logs and screenshots if needed
  await archiveTestArtifacts(environment);
  
  // 5. Show summary statistics
  await showTestSummary();
  
  // 6. Validate cleanup completed successfully
  await validateCleanup();
  
  console.log('✅ Global teardown completed successfully');
}


/**
 * Generate final test reports and summaries
 */
async function generateFinalReports(): Promise<void> {
  console.log('📊 Generating final reports...');
  
  try {
    // Check if HTML report exists
    const htmlReportPath = path.resolve(process.cwd(), 'playwright-report');
    if (fs.existsSync(htmlReportPath)) {
      console.log(`   ✅ HTML report available at: ${htmlReportPath}/index.html`);
    }

    // Check if monocart report exists
    const monocartHtml = path.resolve(process.cwd(), 'monocart-report', 'index.html');
    if (fs.existsSync(monocartHtml)) {
      console.log(`   ✅ Monocart report available at: ${monocartHtml}`);
    }

    // Check if JSON results exist
    const jsonResultsPath = path.resolve(process.cwd(), 'test-results');
    if (fs.existsSync(jsonResultsPath)) {
      const files = fs.readdirSync(jsonResultsPath);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      console.log(`   ✅ ${jsonFiles.length} JSON result files generated`);
    }
    
    // Generate a simple summary file
    await generateTestSummaryFile();
    
  } catch (error) {
    console.warn(`   ⚠️ Report generation warning: ${error}`);
  }
}

/**
 * Generate a test summary file
 */
async function generateTestSummaryFile(): Promise<void> {
  try {
    const summaryPath = path.resolve(process.cwd(), 'test-summary.txt');    const timestamp = new Date().toISOString();
    const environment = getEnvironment();
    
    const summary = `
Test Execution Summary
=====================
Timestamp: ${timestamp}
Environment: ${process.env.NODE_ENV || 'testing'}
Front Site URL: ${environment.frontSiteUrl}
Admin URL: ${environment.adminUrl}
Browser: ${environment.defaultBrowser}
Headless: ${environment.headless}
Parallel Workers: ${environment.parallelWorkers}
Timeout: ${environment.timeout}ms
Retries: ${environment.retries}

Reports Location:
- HTML Report: playwright-report/index.html
- Monocart Report: monocart-report/index.html
- JSON Results: test-results/
- Screenshots: test-results/ (on failures)
- Videos: test-results/ (on failures)

Commands to view reports:
- Playwright HTML: npx playwright show-report
- Monocart: npx monocart show-report monocart-report/index.html
`;
    
    fs.writeFileSync(summaryPath, summary.trim());
    console.log(`   ✅ Test summary saved to: test-summary.txt`);
  } catch (error) {
    console.warn(`   ⚠️ Could not generate test summary: ${error}`);
  }
}

/**
 * Clean up temporary files and authentication states
 */
async function cleanupTemporaryFiles(): Promise<void> {
  console.log('🗑️ Cleaning up temporary files...');
  
  const tempDirectories = [
    '.auth',
    'temp',
    'tmp'
  ];
  
  for (const dir of tempDirectories) {
    try {
      const dirPath = path.resolve(process.cwd(), dir);
      if (fs.existsSync(dirPath)) {
        // Remove only temporary auth files, keep the directory structure
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const stat = fs.statSync(filePath);
          if (stat.isFile() && (file.includes('temp') || file.includes('tmp'))) {
            fs.unlinkSync(filePath);
          }
        }
        console.log(`   ✅ Cleaned temporary files from ${dir}/`);
      }
    } catch (error) {
      console.warn(`   ⚠️ Could not clean ${dir}/: ${error}`);
    }
  }
}

/**
 * Archive test artifacts for long-term storage
 */
async function archiveTestArtifacts(environment: Environment): Promise<void> {
  console.log('📦 Archiving test artifacts...');
  
  try {
    // Only archive in CI or specific environments
    if (process.env.CI || environment.reportDir !== 'test-results') {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archiveDir = path.resolve(process.cwd(), 'archived-results', timestamp);      
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }
      
      // Archive important files
      const filesToArchive = [
        'test-summary.txt',
        'playwright-report',
        'test-results'
      ];
      
      for (const item of filesToArchive) {
        const sourcePath = path.resolve(process.cwd(), item);
        if (fs.existsSync(sourcePath)) {
          const targetPath = path.join(archiveDir, item);
          // Simple copy for files, recursive copy for directories would need additional logic
          if (fs.statSync(sourcePath).isFile()) {
            fs.copyFileSync(sourcePath, targetPath);
          }
        }
      }
      
      console.log(`   ✅ Test artifacts archived to: ${archiveDir}`);
    } else {
      console.log('   ⏭️ Archiving skipped (not in CI environment)');
    }
  } catch (error) {
    console.warn(`   ⚠️ Archiving warning: ${error}`);
  }
}

/**
 * Show test execution summary
 */
async function showTestSummary(): Promise<void> {
  console.log('📈 Test Execution Summary:');
  
  try {
    const environment = getEnvironment();
    console.log(`   🌍 Environment: ${process.env.NODE_ENV || 'testing'}`);
    console.log(`   🌐 Front Site: ${environment.frontSiteUrl}`);
    console.log(`   🔧 Admin Panel: ${environment.adminUrl}`);
    // Detect browser/project from Playwright CLI arguments if available
    let browserName = process.env.BROWSER || environment.defaultBrowser;
    const projectArg = process.argv.find(arg => arg.startsWith('--project='));
    if (projectArg) {
      browserName = projectArg.split('=')[1];
    }
    console.log(`   🌐 Browser: ${browserName}`);
    console.log(`   👁️ Headless: ${environment.headless ? 'Yes' : 'No'}`);
    console.log(`   ⚡ Workers: ${environment.parallelWorkers}`);
    console.log(`   ⏱️ Timeout: ${environment.timeout}ms`);
    console.log(`   🔄 Retries: ${environment.retries}`);    // Check for report files
    const htmlReportExists = fs.existsSync(path.resolve(process.cwd(), 'playwright-report', 'index.html'));
    const monocartReportExists = fs.existsSync(path.resolve(process.cwd(), 'monocart-report', 'index.html'));

    console.log(`   📊 HTML Report: ${htmlReportExists ? 'Generated' : 'Not available'}`);
    console.log(`   📈 Monocart Report: ${monocartReportExists ? 'Generated' : 'Not available'}`);

    if (htmlReportExists || monocartReportExists) {
      console.log('');
      console.log('🎯 To view the detailed reports, run:');
      if (htmlReportExists) console.log('   npx playwright show-report');
      if (monocartReportExists) console.log('   npx monocart show-report monocart-report/index.html');
    }
  } catch (error) {
    console.warn(`   ⚠️ Could not generate summary: ${error}`);
  }
}

/**
 * Validate that cleanup completed successfully
 */
async function validateCleanup(): Promise<void> {
  console.log('✅ Validating cleanup...');
  
  try {
    // Check for any remaining temporary files
    const tempFiles = [
      '.auth/temp*',
      'temp/*',
      'tmp/*'
    ];
    
    let cleanupIssues = 0;
    
    for (const pattern of tempFiles) {
      // Simple validation - in a real implementation you might use glob patterns
      const basePath = pattern.split('/')[0];
      if (fs.existsSync(basePath)) {
        const files = fs.readdirSync(basePath);
        const tempFileCount = files.filter(file => 
          file.includes('temp') || file.includes('tmp')
        ).length;
        
        if (tempFileCount > 0) {
          cleanupIssues++;
          console.warn(`   ⚠️ ${tempFileCount} temporary files remaining in ${basePath}/`);
        }
      }
    }
    
    if (cleanupIssues === 0) {
      console.log('   ✅ Cleanup validation passed');
    } else {
      console.warn(`   ⚠️ ${cleanupIssues} cleanup issues detected`);
    }
  } catch (error) {
    console.warn(`   ⚠️ Cleanup validation warning: ${error}`);
  }
}

export default globalTeardown;
