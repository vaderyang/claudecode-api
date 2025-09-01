# Test Scenarios for Claude Code API

## Scenario 1: Basic Text Generation (Chat Completions)

### Non-Streaming
```bash
node index.js --api chat test "Write a short poem about programming"
```

### Streaming  
```bash
node index.js --api chat --stream test "Write a short poem about programming"
```

**Expected Output:**
- Streaming text tokens appearing word by word
- Token usage statistics at the end

---

## Scenario 2: File Creation with Reasoning (Responses API)

### With Reasoning Display
```bash
node index.js --api responses --reasoning --stream test "Create a simple HTML page with a contact form"
```

**Expected Output:**
- 🧠 Reasoning tokens: "Planning HTML structure...", "Creating form elements...", "Adding styling..."
- 📝 Normal text tokens: The actual response content
- Event-based streaming with proper event types

### Without Reasoning
```bash
node index.js --api responses --stream test "Create a simple HTML page with a contact form"
```

**Expected Output:**
- Only normal text tokens
- No reasoning events

---

## Scenario 3: Code Explanation (Both APIs)

### Chat Completions
```bash
node index.js --api chat --stream test "Explain this JavaScript function: const factorial = n => n <= 1 ? 1 : n * factorial(n - 1)"
```

### Responses API
```bash
node index.js --api responses --reasoning --stream test "Explain this JavaScript function: const factorial = n => n <= 1 ? 1 : n * factorial(n - 1)"
```

**Compare:**
- Chat API: Standard streaming text
- Responses API: May include reasoning about the explanation process

---

## Scenario 4: Complex Multi-Step Task

```bash
node index.js --api responses --reasoning --stream test "Create a Python script that reads a CSV file, analyzes the data, and creates a bar chart using matplotlib"
```

**Expected Reasoning Tokens:**
- "Breaking down the task into steps..."
- "Setting up CSV reading functionality..."  
- "Implementing data analysis..."
- "Creating matplotlib visualization..."

---

## Scenario 5: Interactive Mode Testing

```bash
node index.js
# or
npm start
```

**Test Sequence:**
1. Start with default settings
2. Type: `config` - Change to Responses API with reasoning
3. Ask: "Write a simple web server in Node.js"
4. Type: `config` - Switch to Chat API  
5. Ask the same question
6. Compare the outputs

---

## Scenario 6: Token Usage Comparison

### Short Response
```bash
node index.js test "Hello"
```

### Long Response
```bash
node index.js test "Write a comprehensive guide to machine learning algorithms including supervised learning, unsupervised learning, and deep learning approaches"
```

**Observe:**
- Token usage differences
- Streaming behavior with different content lengths
- Response timing

---

## Scenario 7: Error Handling

### Invalid API Key
```bash
node index.js --key invalid-key test "Hello"
```

### Server Down
```bash
node index.js --url http://localhost:9999 test "Hello"
```

### Malformed Request
```bash
node index.js --model invalid-model test "Hello"
```

**Expected:**
- Proper error messages
- Graceful failure handling

---

## Scenario 8: Model Comparison

### Claude Sonnet
```bash
node index.js --model claude-sonnet --stream test "Explain quantum computing in simple terms"
```

### Claude 4 Sonnet  
```bash
node index.js --model claude-4-sonnet --stream test "Explain quantum computing in simple terms"
```

**Compare:**
- Response quality
- Streaming speed
- Token usage

---

## Scenario 9: Health Check

```bash
node index.js health
```

**Expected Output:**
- API health status
- Server information
- Connection confirmation

---

## Scenario 10: Reasoning-Heavy Tasks (Responses API Only)

```bash
node index.js --api responses --reasoning --stream test "Design a database schema for an e-commerce website and explain your design decisions"
```

**Expected Reasoning Events:**
- "Analyzing e-commerce requirements..."
- "Designing user tables..."
- "Planning product catalog structure..."
- "Considering relationships and constraints..."
- "Optimizing for performance..."

---

## Performance Testing

### Rapid Fire Tests
```bash
# Test multiple requests quickly
for i in {1..5}; do
  node index.js test "Count to $i" &
done
wait
```

### Long Content Generation
```bash
node index.js --stream test "Write a 1000-word essay about the future of artificial intelligence"
```

## Debugging Tips

1. **Enable detailed logging** by modifying the client code
2. **Use network inspection tools** to see raw HTTP requests/responses  
3. **Test with different message lengths** to see token behavior
4. **Compare API responses** between Chat Completions and Responses APIs
5. **Monitor server logs** while running tests

## Expected Differences Between APIs

| Feature | Chat Completions | Responses API |
|---------|------------------|---------------|
| Streaming Format | `data: {...}` SSE | `event: type\ndata: {...}` |
| Reasoning Tokens | ❌ Not available | ✅ Available with `--reasoning` |
| Event Types | Simple deltas | Multiple event types |
| Token Display | Content only | Content + reasoning |
| Usage Stats | End of stream | Multiple events |