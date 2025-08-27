#!/usr/bin/env node

/**
 * Main Test Runner for Claude Code API
 * Orchestrates all test suites and provides unified reporting
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Test configuration
const TESTS_DIR = __dirname;
const AVAILABLE_TESTS = {
  'auth': {
    file: 'test-auth-refresh.js',
    name: 'Authentication Refresh Tests',
    description: 'Tests automatic authentication refresh functionality'
  },
  'api': {
    file: 'api-test-suite.js',
    name: 'API Test Suite',
    description: 'Comprehensive tests for all API endpoints'
  },
  'performance': {
    file: 'performance-tests.js',
    name: 'Performance Tests',
    description: 'Load testing and performance benchmarking'
  }
};

// Command line argument parsing
function parseArguments() {
  const args = process.argv.slice(2);
  const config = {
    tests: [],
    verbose: false,
    generateReport: true,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      config.help = true;
    } else if (arg === '--verbose' || arg === '-v') {
      config.verbose = true;
    } else if (arg === '--no-report') {
      config.generateReport = false;
    } else if (arg === '--all') {
      config.tests = Object.keys(AVAILABLE_TESTS);
    } else if (AVAILABLE_TESTS[arg]) {
      config.tests.push(arg);
    } else {
      console.error(`❌ Unknown test or option: ${arg}`);
      process.exit(1);
    }
  }

  // Default to all tests if none specified
  if (config.tests.length === 0 && !config.help) {
    config.tests = Object.keys(AVAILABLE_TESTS);
  }

  return config;
}

// Display help information
function showHelp() {
  console.log('🧪 Claude Code API Test Runner');
  console.log('');
  console.log('Usage: ./run-tests.js [options] [test-names]');
  console.log('');
  console.log('Available Tests:');
  Object.entries(AVAILABLE_TESTS).forEach(([key, test]) => {
    console.log(`  ${key.padEnd(12)} - ${test.name}`);
    console.log(`${''.padEnd(17)}${test.description}`);
  });
  console.log('');
  console.log('Options:');
  console.log('  --all           Run all available tests (default)');
  console.log('  --verbose, -v   Enable verbose output');
  console.log('  --no-report     Skip generating unified test report');
  console.log('  --help, -h      Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  ./run-tests.js                    # Run all tests');
  console.log('  ./run-tests.js api performance    # Run specific tests');
  console.log('  ./run-tests.js --verbose auth     # Run auth tests with verbose output');
}

// Check if server is running
async function checkServerHealth() {
  const http = require('http');
  
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/health',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

// Execute a single test suite
async function runTestSuite(testKey, config) {
  const test = AVAILABLE_TESTS[testKey];
  const testPath = path.join(TESTS_DIR, test.file);
  
  console.log(`\n🧪 Running: ${test.name}`);
  console.log('─'.repeat(80));
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const child = spawn('node', [testPath], {
      stdio: config.verbose ? 'inherit' : 'pipe',
      cwd: TESTS_DIR
    });

    let output = '';
    let errorOutput = '';
    
    if (!config.verbose) {
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });
    }

    child.on('close', (code) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const result = {
        testKey,
        name: test.name,
        passed: code === 0,
        exitCode: code,
        duration,
        output: config.verbose ? '' : output,
        errorOutput: config.verbose ? '' : errorOutput
      };

      if (!config.verbose) {
        if (code === 0) {
          console.log(`✅ ${test.name} - PASSED (${duration}ms)`);
        } else {
          console.log(`❌ ${test.name} - FAILED (${duration}ms)`);
          if (errorOutput) {
            console.log('Error output:');
            console.log(errorOutput);
          }
        }
      }

      resolve(result);
    });

    child.on('error', (error) => {
      console.error(`❌ Failed to start test: ${error.message}`);
      resolve({
        testKey,
        name: test.name,
        passed: false,
        exitCode: -1,
        duration: Date.now() - startTime,
        output: '',
        errorOutput: error.message
      });
    });
  });
}

// Generate unified test report
async function generateUnifiedReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
      passRate: results.length > 0 ? ((results.filter(r => r.passed).length / results.length) * 100).toFixed(2) + '%' : '0%'
    },
    results,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd()
    }
  };

  // Write unified report
  const reportPath = path.join(TESTS_DIR, 'unified-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log('\n📊 Unified test report saved to: unified-test-report.json');
  return report;
}

// Main execution function
async function main() {
  const config = parseArguments();

  if (config.help) {
    showHelp();
    return;
  }

  console.log('🧪 Claude Code API - Test Runner');
  console.log('='.repeat(80));
  console.log(`Node.js: ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
  console.log(`Tests to run: ${config.tests.join(', ')}`);
  console.log('='.repeat(80));

  // Check if server is running
  console.log('🔍 Checking server status...');
  const serverRunning = await checkServerHealth();
  
  if (!serverRunning) {
    console.log('⚠️  Warning: Server may not be running at http://localhost:3000');
    console.log('   Start the server with: npm run dev');
    console.log('   Some tests may fail without a running server.');
    console.log('');
  } else {
    console.log('✅ Server is running and healthy');
  }

  // Run all selected tests
  const startTime = Date.now();
  const results = [];

  for (const testKey of config.tests) {
    try {
      const result = await runTestSuite(testKey, config);
      results.push(result);
    } catch (error) {
      console.error(`❌ Error running test ${testKey}:`, error.message);
      results.push({
        testKey,
        name: AVAILABLE_TESTS[testKey].name,
        passed: false,
        exitCode: -1,
        duration: 0,
        output: '',
        errorOutput: error.message
      });
    }
  }

  const totalTime = Date.now() - startTime;

  // Generate unified report
  let report = null;
  if (config.generateReport) {
    try {
      report = await generateUnifiedReport(results);
    } catch (error) {
      console.error('❌ Failed to generate unified report:', error.message);
    }
  }

  // Display final summary
  console.log('\n' + '='.repeat(80));
  console.log('🎯 TEST EXECUTION SUMMARY');
  console.log('='.repeat(80));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`📊 Total Test Suites: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Pass Rate: ${report?.summary?.passRate || '0%'}`);
  console.log(`⏱️  Total Time: ${totalTime}ms`);
  console.log('');

  // Show failed tests
  if (failed > 0) {
    console.log('❌ Failed Test Suites:');
    results.filter(r => !r.passed).forEach(result => {
      console.log(`   • ${result.name} (exit code: ${result.exitCode})`);
    });
    console.log('');
  }

  // Additional reports information
  const reportFiles = ['test-report.json', 'performance-report.json', 'unified-test-report.json'];
  const existingReports = reportFiles.filter(file => fs.existsSync(path.join(TESTS_DIR, file)));
  
  if (existingReports.length > 0) {
    console.log('📄 Generated Reports:');
    existingReports.forEach(file => {
      console.log(`   • ${file}`);
    });
    console.log('');
  }

  console.log('💡 Tips:');
  console.log('   • Use --verbose for detailed test output');
  console.log('   • Check individual report files for detailed analysis');
  console.log('   • Ensure server is running for all tests to pass');

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Handle command line execution
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  main,
  runTestSuite,
  AVAILABLE_TESTS
};
