/**
 * MIT License
 * 
 * Copyright (c) 2025 Claude Code API
 * Original repository: https://github.com/vaderyang/claudecode-api
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export interface ReasoningTip {
  summary: string;
  details?: {
    category: string;
    confidence: number;
    keyWords: string[];
  };
}

export interface PromptAnalysis {
  category: string;
  intent: string;
  keywords: string[];
  confidence: number;
}

/**
 * Instantly analyzes a prompt to determine its intent and category
 */
export function analyzePrompt(prompt: string): PromptAnalysis {
  const lowerPrompt = prompt.toLowerCase();
  
  // File operations keywords
  const fileKeywords = ['create', 'write', 'make', 'generate', 'build', 'file', 'component', 'class', 'function'];
  const editKeywords = ['edit', 'modify', 'update', 'change', 'fix', 'refactor', 'improve'];
  const debugKeywords = ['debug', 'error', 'bug', 'issue', 'problem', 'troubleshoot', 'fix'];
  const explainKeywords = ['explain', 'how', 'what', 'why', 'understand', 'help', 'describe'];
  const reviewKeywords = ['review', 'analyze', 'check', 'examine', 'evaluate', 'assess'];
  
  // Count matches for each category
  const fileMatches = fileKeywords.filter(keyword => lowerPrompt.includes(keyword)).length;
  const editMatches = editKeywords.filter(keyword => lowerPrompt.includes(keyword)).length;
  const debugMatches = debugKeywords.filter(keyword => lowerPrompt.includes(keyword)).length;
  const explainMatches = explainKeywords.filter(keyword => lowerPrompt.includes(keyword)).length;
  const reviewMatches = reviewKeywords.filter(keyword => lowerPrompt.includes(keyword)).length;
  
  // Determine primary category
  const maxMatches = Math.max(fileMatches, editMatches, debugMatches, explainMatches, reviewMatches);
  let category = 'general';
  let intent = 'processing request';
  let matchedKeywords: string[] = [];
  
  if (maxMatches > 0) {
    if (fileMatches === maxMatches) {
      category = 'file_creation';
      intent = 'creating or generating files';
      matchedKeywords = fileKeywords.filter(keyword => lowerPrompt.includes(keyword));
    } else if (editMatches === maxMatches) {
      category = 'code_editing';
      intent = 'editing or modifying code';
      matchedKeywords = editKeywords.filter(keyword => lowerPrompt.includes(keyword));
    } else if (debugMatches === maxMatches) {
      category = 'debugging';
      intent = 'debugging or fixing issues';
      matchedKeywords = debugKeywords.filter(keyword => lowerPrompt.includes(keyword));
    } else if (explainMatches === maxMatches) {
      category = 'explanation';
      intent = 'explaining or providing guidance';
      matchedKeywords = explainKeywords.filter(keyword => lowerPrompt.includes(keyword));
    } else if (reviewMatches === maxMatches) {
      category = 'code_review';
      intent = 'reviewing or analyzing code';
      matchedKeywords = reviewKeywords.filter(keyword => lowerPrompt.includes(keyword));
    }
  }
  
  // Calculate confidence based on number of matches and prompt length
  const confidence = Math.min(0.95, (maxMatches / Math.sqrt(prompt.length / 50)) * 0.8 + 0.2);
  
  return {
    category,
    intent,
    keywords: matchedKeywords,
    confidence
  };
}

/**
 * Generates instant reasoning tips based on prompt analysis
 */
export function generateInstantReasoningTips(prompt: string): ReasoningTip[] {
  const analysis = analyzePrompt(prompt);
  const tips: ReasoningTip[] = [];
  
  // Add initial processing tip
  tips.push({
    summary: "Analyzing your request...",
    details: {
      category: "initialization",
      confidence: 1.0,
      keyWords: []
    }
  });
  
  // Add category-specific tips
  switch (analysis.category) {
    case 'file_creation':
      tips.push({
        summary: "Planning file structure and content organization...",
        details: {
          category: analysis.category,
          confidence: analysis.confidence,
          keyWords: analysis.keywords
        }
      });
      tips.push({
        summary: "Setting up development environment for file operations...",
        details: {
          category: analysis.category,
          confidence: analysis.confidence,
          keyWords: analysis.keywords
        }
      });
      break;
      
    case 'code_editing':
      tips.push({
        summary: "Reading existing code to understand current implementation...",
        details: {
          category: analysis.category,
          confidence: analysis.confidence,
          keyWords: analysis.keywords
        }
      });
      tips.push({
        summary: "Identifying areas for modification and improvement...",
        details: {
          category: analysis.category,
          confidence: analysis.confidence,
          keyWords: analysis.keywords
        }
      });
      break;
      
    case 'debugging':
      tips.push({
        summary: "Analyzing error patterns and potential root causes...",
        details: {
          category: analysis.category,
          confidence: analysis.confidence,
          keyWords: analysis.keywords
        }
      });
      tips.push({
        summary: "Preparing diagnostic tools and troubleshooting strategies...",
        details: {
          category: analysis.category,
          confidence: analysis.confidence,
          keyWords: analysis.keywords
        }
      });
      break;
      
    case 'explanation':
      tips.push({
        summary: "Gathering relevant context and examples for explanation...",
        details: {
          category: analysis.category,
          confidence: analysis.confidence,
          keyWords: analysis.keywords
        }
      });
      tips.push({
        summary: "Structuring explanation for clarity and comprehension...",
        details: {
          category: analysis.category,
          confidence: analysis.confidence,
          keyWords: analysis.keywords
        }
      });
      break;
      
    case 'code_review':
      tips.push({
        summary: "Examining code for quality, performance, and best practices...",
        details: {
          category: analysis.category,
          confidence: analysis.confidence,
          keyWords: analysis.keywords
        }
      });
      tips.push({
        summary: "Preparing comprehensive analysis and recommendations...",
        details: {
          category: analysis.category,
          confidence: analysis.confidence,
          keyWords: analysis.keywords
        }
      });
      break;
      
    default:
      tips.push({
        summary: "Understanding the context and requirements...",
        details: {
          category: "general",
          confidence: analysis.confidence,
          keyWords: analysis.keywords
        }
      });
      tips.push({
        summary: "Preparing comprehensive response strategy...",
        details: {
          category: "general",
          confidence: analysis.confidence,
          keyWords: analysis.keywords
        }
      });
  }
  
  // Add final preparation tip
  tips.push({
    summary: "Initializing Claude Code environment and tools...",
    details: {
      category: "system",
      confidence: 1.0,
      keyWords: ["claude-code", "tools", "environment"]
    }
  });
  
  return tips;
}

/**
 * Generates progressive reasoning tips that can be streamed over time
 */
export async function* generateProgressiveReasoningTips(prompt: string): AsyncGenerator<ReasoningTip, void, unknown> {
  const tips = generateInstantReasoningTips(prompt);
  
  for (const tip of tips) {
    yield tip;
    
    // Add realistic delay between tips (50-200ms to simulate thinking)
    const delay = Math.random() * 150 + 50;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

/**
 * Creates additional contextual reasoning based on prompt content
 */
export function generateContextualReasoningTip(prompt: string): ReasoningTip {
  const lowerPrompt = prompt.toLowerCase();
  
  // Technology-specific tips
  if (lowerPrompt.includes('react') || lowerPrompt.includes('jsx') || lowerPrompt.includes('tsx')) {
    return {
      summary: "Configuring React development environment and component structure...",
      details: {
        category: "technology",
        confidence: 0.9,
        keyWords: ["react", "jsx", "tsx", "component"]
      }
    };
  }
  
  if (lowerPrompt.includes('python') || lowerPrompt.includes('.py')) {
    return {
      summary: "Setting up Python environment and analyzing project structure...",
      details: {
        category: "technology",
        confidence: 0.9,
        keyWords: ["python", "py", "script"]
      }
    };
  }
  
  if (lowerPrompt.includes('typescript') || lowerPrompt.includes('ts')) {
    return {
      summary: "Configuring TypeScript compiler and type definitions...",
      details: {
        category: "technology",
        confidence: 0.9,
        keyWords: ["typescript", "ts", "types"]
      }
    };
  }
  
  if (lowerPrompt.includes('api') || lowerPrompt.includes('backend') || lowerPrompt.includes('server')) {
    return {
      summary: "Planning API structure and server-side implementation...",
      details: {
        category: "architecture",
        confidence: 0.8,
        keyWords: ["api", "backend", "server"]
      }
    };
  }
  
  if (lowerPrompt.includes('database') || lowerPrompt.includes('sql')) {
    return {
      summary: "Analyzing database schema and query optimization...",
      details: {
        category: "database",
        confidence: 0.8,
        keyWords: ["database", "sql", "query"]
      }
    };
  }
  
  // Default contextual tip
  return {
    summary: "Analyzing specific requirements and technical constraints...",
    details: {
      category: "analysis",
      confidence: 0.7,
      keyWords: []
    }
  };
}
