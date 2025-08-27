#!/usr/bin/env node

/**
 * Performance and Load Testing Suite for Claude Code API
 * Tests response times, throughput, and system behavior under load
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Test configuration
const CONFIG = {
  host: 'localhost',
  port: 3000,
  timeout: 60000, // 60 seconds for load tests
  authToken: 'test-key',
  loadTest: {
    concurrency: 10,     // Number of concurrent requests
    duration: 30000,     // 30 seconds
    rampUp: 5000        // 5 seconds ramp-up time
  }
};

// Performance metrics tracking
let performanceMetrics = {
  requests: {
    total: 0,
    successful: 0,
    failed: 0,
    errors: []
  },
  timing: {
    min: Infinity,
    max: 0,
    total: 0,
    average: 0,
    p95: 0,
    p99: 0,
    responseTimes: []
  },
  throughput: {
    requestsPerSecond: 0,
    peakRps: 0
  },
  memory: {
    initial: process.memoryUsage(),
    peak: process.memoryUsage(),
    final: process.memoryUsage()
  }
};

// Utility function to make HTTP requests with timing
async function makeTimedRequest(path, method = 'GET', data = null, headers = {}) {
  const startTime = process.hrtime();
  const startMemory = process.memoryUsage();
  
  try {
    const response = await makeRequest(path, method, data, headers);
    const endTime = process.hrtime(startTime);
    const responseTime = endTime[0] * 1000 + endTime[1] / 1000000; // Convert to milliseconds
    
    // Update performance metrics
    performanceMetrics.requests.total++;
    if (response.status >= 200 && response.status < 400) {
      performanceMetrics.requests.successful++;
    } else {
      performanceMetrics.requests.failed++;
    }
    
    // Update timing metrics
    performanceMetrics.timing.responseTimes.push(responseTime);
    performanceMetrics.timing.min = Math.min(performanceMetrics.timing.min, responseTime);
    performanceMetrics.timing.max = Math.max(performanceMetrics.timing.max, responseTime);
    performanceMetrics.timing.total += responseTime;
    
    // Update memory peak
    const currentMemory = process.memoryUsage();
    if (currentMemory.heapUsed > performanceMetrics.memory.peak.heapUsed) {
      performanceMetrics.memory.peak = currentMemory;
    }
    
    return { ...response, responseTime, memoryDelta: currentMemory.heapUsed - startMemory.heapUsed };
    
  } catch (error) {
    const endTime = process.hrtime(startTime);
    const responseTime = endTime[0] * 1000 + endTime[1] / 1000000;
    
    performanceMetrics.requests.total++;
    performanceMetrics.requests.failed++;
    performanceMetrics.requests.errors.push({
      error: error.message,
      timestamp: new Date().toISOString(),
      responseTime
    });
    
    throw error;
  }
}

// Base HTTP request function
async function makeRequest(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.authToken}`,
      ...headers
    };

    const options = {
      hostname: CONFIG.host,
      port: CONFIG.port,
      path,
      method,
      headers: defaultHeaders,
      timeout: CONFIG.timeout
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = responseData ? JSON.parse(responseData) : null;
          resolve({ 
            status: res.statusCode, 
            headers: res.headers,
            data: parsed,
            raw: responseData 
          });
        } catch (e) {
          resolve({ 
            status: res.statusCode, 
            headers: res.headers,
            data: null,
            raw: responseData 
          });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${CONFIG.timeout}ms`));
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Performance test suites
async function testResponseTimes() {
  console.log('⏱️  Testing Response Times...');
  
  const endpoints = [
    { path: '/health', name: 'Health Check' },
    { path: '/v1/models', name: 'Models List' },
    { path: '/health/auth', name: 'Auth Status' }
  ];
  
  const iterations = 10;
  const results = [];
  
  for (const endpoint of endpoints) {
    console.log(`    Testing ${endpoint.name} (${iterations} requests)...`);
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      try {
        const result = await makeTimedRequest(endpoint.path);
        times.push(result.responseTime);
      } catch (error) {
        console.log(`    Error in ${endpoint.name}: ${error.message}`);
      }
    }
    
    if (times.length > 0) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      const sorted = times.sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      
      results.push({
        endpoint: endpoint.name,
        average: avg.toFixed(2),
        min: min.toFixed(2),
        max: max.toFixed(2),
        p95: p95.toFixed(2),
        requests: times.length
      });
      
      console.log(`    ${endpoint.name}: avg=${avg.toFixed(2)}ms, min=${min.toFixed(2)}ms, max=${max.toFixed(2)}ms, p95=${p95.toFixed(2)}ms`);
    }
  }
  
  return results;
}

async function testConcurrentRequests() {
  console.log('🔄 Testing Concurrent Requests...');
  
  const concurrencyLevels = [1, 5, 10, 20];
  const requestsPerLevel = 20;
  const results = [];
  
  for (const concurrency of concurrencyLevels) {
    console.log(`    Testing concurrency level: ${concurrency}`);
    
    const startTime = Date.now();
    const promises = [];
    
    // Create concurrent requests
    for (let i = 0; i < requestsPerLevel; i++) {
      // Spread requests across different endpoints
      const endpoints = ['/health', '/v1/models', '/health/auth'];
      const endpoint = endpoints[i % endpoints.length];
      
      const promise = makeTimedRequest(endpoint).catch(error => ({
        error: error.message,
        responseTime: 0
      }));
      
      promises.push(promise);
      
      // Stagger the requests slightly to simulate real-world conditions
      if (concurrency > 1 && i > 0 && i % concurrency === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    const responses = await Promise.all(promises);
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    const successful = responses.filter(r => !r.error).length;
    const failed = responses.filter(r => r.error).length;
    const avgResponseTime = responses
      .filter(r => !r.error && r.responseTime)
      .reduce((sum, r) => sum + r.responseTime, 0) / successful;
    
    const result = {
      concurrency,
      totalRequests: requestsPerLevel,
      successful,
      failed,
      totalTime,
      avgResponseTime: avgResponseTime.toFixed(2),
      requestsPerSecond: ((successful / totalTime) * 1000).toFixed(2)
    };
    
    results.push(result);
    
    console.log(`    Concurrency ${concurrency}: ${successful}/${requestsPerLevel} successful, avg=${result.avgResponseTime}ms, ${result.requestsPerSecond} req/s`);
    
    // Allow system to recover between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

async function testMemoryUsage() {
  console.log('🧠 Testing Memory Usage...');
  
  const initialMemory = process.memoryUsage();
  const iterations = 50;
  const memorySnapshots = [];
  
  console.log(`    Initial memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  
  // Perform requests and monitor memory
  for (let i = 0; i < iterations; i++) {
    await makeTimedRequest('/health');
    
    if (i % 10 === 0) {
      const currentMemory = process.memoryUsage();
      memorySnapshots.push({
        iteration: i,
        heapUsed: currentMemory.heapUsed,
        heapTotal: currentMemory.heapTotal,
        external: currentMemory.external
      });
    }
  }
  
  const finalMemory = process.memoryUsage();
  const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
  
  console.log(`    Final memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`    Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
  
  return {
    initial: initialMemory,
    final: finalMemory,
    increase: memoryIncrease,
    snapshots: memorySnapshots
  };
}

async function testLoadCapacity() {
  console.log('🚀 Testing Load Capacity...');
  
  const { concurrency, duration, rampUp } = CONFIG.loadTest;
  console.log(`    Load test: ${concurrency} concurrent requests for ${duration/1000}s with ${rampUp/1000}s ramp-up`);
  
  const startTime = Date.now();
  let requestsStarted = 0;
  let requestsCompleted = 0;
  const errors = [];
  const responseTimes = [];
  
  // Function to make a single request
  const makeLoadRequest = async () => {
    requestsStarted++;
    try {
      const result = await makeTimedRequest('/health');
      requestsCompleted++;
      responseTimes.push(result.responseTime);
    } catch (error) {
      errors.push(error.message);
    }
  };
  
  // Start load test
  const interval = rampUp / concurrency;
  const workers = [];
  
  // Ramp up workers
  for (let i = 0; i < concurrency; i++) {
    setTimeout(() => {
      const worker = async () => {
        while (Date.now() - startTime < duration) {
          await makeLoadRequest();
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between requests
        }
      };
      workers.push(worker());
    }, i * interval);
  }
  
  // Wait for test duration
  await new Promise(resolve => setTimeout(resolve, duration + rampUp));
  
  // Wait for all workers to complete
  await Promise.all(workers);
  
  const totalTime = Date.now() - startTime;
  const avgResponseTime = responseTimes.length > 0 
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
    : 0;
  
  const result = {
    duration: totalTime,
    requestsStarted,
    requestsCompleted,
    errors: errors.length,
    avgResponseTime: avgResponseTime.toFixed(2),
    requestsPerSecond: ((requestsCompleted / totalTime) * 1000).toFixed(2),
    errorRate: ((errors.length / requestsStarted) * 100).toFixed(2)
  };
  
  console.log(`    Load test results:`);
  console.log(`      Requests: ${result.requestsCompleted}/${result.requestsStarted} completed`);
  console.log(`      Average response time: ${result.avgResponseTime}ms`);
  console.log(`      Throughput: ${result.requestsPerSecond} req/s`);
  console.log(`      Error rate: ${result.errorRate}%`);
  
  return result;
}

async function calculatePerformanceMetrics() {
  if (performanceMetrics.timing.responseTimes.length === 0) return;
  
  const times = performanceMetrics.timing.responseTimes.sort((a, b) => a - b);
  performanceMetrics.timing.average = performanceMetrics.timing.total / times.length;
  performanceMetrics.timing.p95 = times[Math.floor(times.length * 0.95)];
  performanceMetrics.timing.p99 = times[Math.floor(times.length * 0.99)];
}

async function generatePerformanceReport(testResults) {
  console.log('📊 Generating Performance Report...');
  
  await calculatePerformanceMetrics();
  
  const report = {
    summary: {
      timestamp: new Date().toISOString(),
      totalRequests: performanceMetrics.requests.total,
      successfulRequests: performanceMetrics.requests.successful,
      failedRequests: performanceMetrics.requests.failed,
      errorRate: ((performanceMetrics.requests.failed / performanceMetrics.requests.total) * 100).toFixed(2) + '%'
    },
    timing: {
      averageResponseTime: performanceMetrics.timing.average.toFixed(2) + 'ms',
      minResponseTime: performanceMetrics.timing.min.toFixed(2) + 'ms',
      maxResponseTime: performanceMetrics.timing.max.toFixed(2) + 'ms',
      p95ResponseTime: performanceMetrics.timing.p95.toFixed(2) + 'ms',
      p99ResponseTime: performanceMetrics.timing.p99.toFixed(2) + 'ms'
    },
    testResults,
    errors: performanceMetrics.requests.errors,
    environment: {
      host: CONFIG.host,
      port: CONFIG.port,
      nodeVersion: process.version,
      platform: process.platform,
      memory: performanceMetrics.memory
    }
  };
  
  // Write detailed report to file
  const reportPath = path.join(__dirname, 'performance-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log('📄 Performance report saved to: performance-report.json');
  return report;
}

// Main performance test execution
async function runPerformanceTests() {
  console.log('⚡ Claude Code API - Performance Test Suite');
  console.log('='.repeat(80));
  console.log(`Testing API at: http://${CONFIG.host}:${CONFIG.port}`);
  console.log(`Load test config: ${CONFIG.loadTest.concurrency} concurrent, ${CONFIG.loadTest.duration/1000}s duration`);
  console.log('='.repeat(80));

  performanceMetrics.memory.initial = process.memoryUsage();
  const startTime = Date.now();

  try {
    const testResults = {
      responseTimeTests: await testResponseTimes(),
      concurrencyTests: await testConcurrentRequests(),
      memoryTests: await testMemoryUsage(),
      loadTests: await testLoadCapacity()
    };

    performanceMetrics.memory.final = process.memoryUsage();
    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Generate and display final results
    console.log('\n' + '='.repeat(80));
    console.log('🎯 PERFORMANCE TEST RESULTS');
    console.log('='.repeat(80));
    
    const report = await generatePerformanceReport(testResults);
    
    console.log(`📊 Total Requests: ${report.summary.totalRequests}`);
    console.log(`✅ Successful: ${report.summary.successfulRequests}`);
    console.log(`❌ Failed: ${report.summary.failedRequests}`);
    console.log(`📈 Error Rate: ${report.summary.errorRate}`);
    console.log(`⏱️  Average Response Time: ${report.timing.averageResponseTime}`);
    console.log(`📊 95th Percentile: ${report.timing.p95ResponseTime}`);
    console.log(`⏱️  Total Test Time: ${totalTime}ms`);
    console.log('');
    
    console.log('💡 Performance Tips:');
    console.log('   • Response times under 100ms are excellent');
    console.log('   • Response times under 500ms are acceptable');
    console.log('   • Error rates under 1% indicate good stability');
    console.log('   • Monitor memory usage for potential leaks');
    
  } catch (error) {
    console.error('❌ Performance test error:', error.message);
    process.exit(1);
  }
}

// Handle command line execution
if (require.main === module) {
  runPerformanceTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  runPerformanceTests,
  makeTimedRequest,
  performanceMetrics
};
