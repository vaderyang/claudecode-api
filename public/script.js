// Function to calculate the factorial of a number
function factorial(n) {
    // Handle edge cases
    if (n < 0) {
        throw new Error("Factorial is not defined for negative numbers");
    }
    if (n === 0 || n === 1) {
        return 1;
    }
    
    // Calculate factorial using recursion
    return n * factorial(n - 1);
}

// Example usage
console.log("Factorial of 5:", factorial(5)); // Output: 120
console.log("Factorial of 0:", factorial(0)); // Output: 1
console.log("Factorial of 3:", factorial(3)); // Output: 6