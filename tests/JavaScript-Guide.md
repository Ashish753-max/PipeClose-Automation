# 📖 JavaScript Complete Documentation & Guide

**Date Created:** June 29, 2026  
**Framework:** JavaScript (CommonJS & ES6+)  
**Purpose:** Comprehensive guide for Playwright automation testing  
**Version:** 1.0.0

---

## 📚 Table of Contents
1. [JavaScript Fundamentals](#javascript-fundamentals)
2. [Variables & Data Types](#variables--data-types)
3. [Operators](#operators)
4. [Control Flow](#control-flow)
5. [Functions](#functions)
6. [Objects & Arrays](#objects--arrays)
7. [ES6+ Features](#es6-features)
8. [Async/Await & Promises](#asyncawait--promises)
9. [Error Handling](#error-handling)
10. [CommonJS vs ES6 Modules](#commonjs-vs-es6-modules)
11. [Working with Strings](#working-with-strings)
12. [Important Concepts](#important-concepts)
13. [Classes & Object-Oriented Programming](#classes--object-oriented-programming)
14. [Your Project Analysis](#your-project-analysis)
15. [Common JavaScript Mistakes](#common-javascript-mistakes)
16. [Best Practices](#best-practices)
17. [Real Examples from Your Code](#real-examples-from-your-code)
18. [Quick Reference](#quick-reference)

---

## 1. JavaScript Fundamentals

### What is JavaScript?

**JavaScript** is a versatile, dynamic programming language that:
- Runs in browsers (client-side)
- Runs on servers with Node.js (server-side)
- Is interpreted, not compiled
- Is dynamically typed
- Supports both procedural and object-oriented programming

### Why JavaScript for Testing?

✅ **Node.js Runtime** - Run JavaScript outside browser  
✅ **Playwright Compatible** - Native support, no language translation  
✅ **JSON Native** - Perfect for test data, API responses  
✅ **Event-Driven** - Natural fit for async operations  
✅ **Large Ecosystem** - npm packages, tools, frameworks  
✅ **Easy Learning Curve** - Flexible, forgiving syntax  

### JavaScript Execution Model

```
┌─────────────────────────────────────────┐
│     JavaScript Code (Your Test)         │
│     const login = require('./auth.js'); │
│     await login(page);                  │
└─────────────────────┬───────────────────┘
                      │
                      ▼
        ┌──────────────────────────┐
        │   JavaScript Engine      │
        │  (V8 in Node.js)         │
        │                          │
        │ ┌────────────────────┐   │
        │ │ Parser             │   │
        │ │ (Convert to AST)   │   │
        │ └────────────────────┘   │
        │           │              │
        │           ▼              │
        │ ┌────────────────────┐   │
        │ │ Compiler           │   │
        │ │ (JIT Compilation)  │   │
        │ └────────────────────┘   │
        │           │              │
        │           ▼              │
        │ ┌────────────────────┐   │
        │ │ Execution Engine   │   │
        │ │ (Run Machine Code) │   │
        │ └────────────────────┘   │
        └──────────────────────────┘
                      │
                      ▼
        Result / Output / Effects
```

---

## 2. Variables & Data Types

### Variable Declaration

```javascript
// ============================================
// VAR (❌ AVOID - OLD WAY)
// ============================================
var name = "John";  // Function-scoped
var name = "Jane";  // Can redeclare - BAD!
console.log(name);  // "Jane"

// Problems with var:
// - Function-scoped (not block-scoped)
// - Can be redeclared (confusing)
// - Hoisted (can cause issues)

// ============================================
// LET (✅ RECOMMENDED)
// ============================================
let email = "john@example.com";  // Block-scoped
email = "jane@example.com";       // Can reassign
// let email = "new@example.com";  // ❌ Can't redeclare in same scope

// ============================================
// CONST (✅ RECOMMENDED FOR CONSTANTS)
// ============================================
const API_URL = "https://staging.pipeclose.com";  // Block-scoped
const MAX_RETRIES = 3;
// const API_URL = "new-url";  // ❌ Can't reassign

// For objects/arrays, can modify properties (but not reassign)
const user = { name: "John" };
user.name = "Jane";  // ✅ OK - modify property
// user = {};  // ❌ Can't reassign object

// Best practice:
// 1. Use CONST by default
// 2. Use LET when reassignment needed
// 3. Never use VAR
```

### Primitive Data Types

```javascript
// ============================================
// STRING
// ============================================
const name = "John Doe";
const email = 'john@example.com';
const multiline = `Hello
World`;  // Template literal (backticks)

// Template literals (most powerful)
const age = 25;
const message = `My name is ${name} and I am ${age} years old`;
console.log(message);  // "My name is John Doe and I am 25 years old"

// String methods (your tests use these)
const text = "Log in";
console.log(text.toLowerCase());       // "log in"
console.log(text.toUpperCase());       // "LOG IN"
console.log(text.includes('in'));      // true
console.log(text.startsWith('Log'));   // true
console.log(text.split(' '));          // ["Log", "in"]
console.log(text.trim());              // Removes whitespace

// ============================================
// NUMBER
// ============================================
const count = 42;
const price = 99.99;
const negative = -10;
const infinity = Infinity;
const notANumber = NaN;

// Number methods
console.log(parseInt("42"));           // 42
console.log(parseFloat("99.99"));      // 99.99
console.log((3.14159).toFixed(2));     // "3.14"

// ============================================
// BOOLEAN
// ============================================
const isLoggedIn = true;
const isAdmin = false;

// Falsy values in JavaScript
// false, 0, "", null, undefined, NaN
if (!0) console.log("Zero is falsy");
if (!"") console.log("Empty string is falsy");
if (!null) console.log("Null is falsy");

// Truthy values
if ("string") console.log("Non-empty string is truthy");
if (1) console.log("Non-zero number is truthy");

// ============================================
// NULL & UNDEFINED
// ============================================
let notAssigned;  // undefined - no value assigned
console.log(notAssigned);  // undefined

let empty = null;  // null - intentionally empty
console.log(empty);  // null

// Difference:
// undefined = variable declared but not initialized
// null = intentionally set to no value

// ============================================
// OBJECT
// ============================================
const user = {
  name: "John",
  email: "john@example.com",
  age: 25,
  isAdmin: false
};

// Access properties
console.log(user.name);           // "John"
console.log(user['email']);       // "john@example.com"

// Modify properties
user.name = "Jane";
user.phone = "123-456-7890";      // Add new property

// Delete property
delete user.phone;

// ============================================
// ARRAY
// ============================================
const fruits = ["apple", "banana", "orange"];
const numbers = [1, 2, 3, 4, 5];
const mixed = [1, "two", true, null];

// Access elements
console.log(fruits[0]);           // "apple"
console.log(fruits.length);       // 3

// Array methods (very important!)
fruits.push("grape");             // Add to end
fruits.pop();                     // Remove from end
fruits.unshift("mango");          // Add to start
fruits.shift();                   // Remove from start
fruits.includes("banana");        // true
fruits.indexOf("banana");         // 1
fruits.reverse();                 // Reverse in place
fruits.sort();                    // Sort alphabetically
```

### Type Checking

```javascript
// Using typeof
console.log(typeof "string");     // "string"
console.log(typeof 42);           // "number"
console.log(typeof true);         // "boolean"
console.log(typeof undefined);    // "undefined"
console.log(typeof null);         // "object" (quirk!)
console.log(typeof {});           // "object"
console.log(typeof []);           // "object" (arrays are objects)
console.log(typeof function() {}); // "function"

// Better way to check for array
console.log(Array.isArray([]));   // true
console.log(Array.isArray({}));   // false

// Checking if variable exists
if (typeof variable !== 'undefined') {
  console.log("Variable exists");
}

// Checking if object has property
const user = { name: "John" };
console.log('name' in user);                    // true
console.log(user.hasOwnProperty('name'));       // true
```

---

## 3. Operators

### Arithmetic Operators

```javascript
const a = 10;
const b = 3;

console.log(a + b);       // 13 (addition)
console.log(a - b);       // 7 (subtraction)
console.log(a * b);       // 30 (multiplication)
console.log(a / b);       // 3.333... (division)
console.log(a % b);       // 1 (modulo/remainder)
console.log(a ** 2);      // 100 (exponentiation)

// Increment/Decrement
let count = 0;
count++;                  // count = 1
count--;                  // count = 0
++count;                  // count = 1 (pre-increment)
--count;                  // count = 0 (pre-decrement)
```

### Comparison Operators

```javascript
const x = 5;
const y = "5";

// Loose equality (type coercion) - AVOID
console.log(x == y);      // true (converts types)
console.log(x != y);      // false

// Strict equality (no type coercion) - RECOMMENDED
console.log(x === y);     // false (different types)
console.log(x !== y);     // true

// Other comparisons
console.log(x > 3);       // true
console.log(x < 10);      // true
console.log(x >= 5);      // true
console.log(x <= 5);      // true
```

### Logical Operators

```javascript
const isLoggedIn = true;
const isAdmin = false;

// AND operator
if (isLoggedIn && isAdmin) {
  console.log("User is logged in admin");
}

// OR operator
if (isLoggedIn || isAdmin) {
  console.log("User is logged in OR admin");
}

// NOT operator
if (!isAdmin) {
  console.log("User is not admin");
}

// Short-circuit evaluation
let result = true || false;  // true (doesn't check second)
let value = false && error();  // false (doesn't call error)
```

### Assignment Operators

```javascript
let x = 10;

x += 5;   // x = x + 5  (15)
x -= 3;   // x = x - 3  (12)
x *= 2;   // x = x * 2  (24)
x /= 4;   // x = x / 4  (6)

// Ternary operator (conditional)
const age = 25;
const status = age >= 18 ? "Adult" : "Minor";
console.log(status);  // "Adult"

// Nullish coalescing (??)
const name = null ?? "Guest";  // "Guest"
const count = 0 ?? 5;  // 0 (only null/undefined use right side)

// Optional chaining (?.)
const user = { profile: { name: "John" } };
console.log(user?.profile?.name);     // "John"
console.log(user?.phone?.number);     // undefined (safe)
```

---

## 4. Control Flow

### If/Else Statements

```javascript
const age = 20;

// Simple if
if (age >= 18) {
  console.log("Adult");
}

// If-else
if (age >= 18) {
  console.log("Adult");
} else {
  console.log("Minor");
}

// If-else if-else
if (age < 13) {
  console.log("Child");
} else if (age < 18) {
  console.log("Teen");
} else if (age < 65) {
  console.log("Adult");
} else {
  console.log("Senior");
}
```

### Switch Statements

```javascript
const role = "admin";

switch (role) {
  case "admin":
    console.log("Full access");
    break;  // Important! Prevents fall-through
  case "user":
    console.log("Limited access");
    break;
  default:
    console.log("No access");
}

// Better than multiple if-else when checking single value
```

### Loops

```javascript
// ============================================
// FOR LOOP
// ============================================
for (let i = 0; i < 5; i++) {
  console.log(i);  // 0, 1, 2, 3, 4
}

// ============================================
// WHILE LOOP
// ============================================
let count = 0;
while (count < 5) {
  console.log(count);
  count++;
}

// ============================================
// DO-WHILE LOOP (runs at least once)
// ============================================
let i = 0;
do {
  console.log(i);
  i++;
} while (i < 5);

// ============================================
// FOR-OF LOOP (iterate values)
// ============================================
const fruits = ["apple", "banana", "orange"];
for (const fruit of fruits) {
  console.log(fruit);  // "apple", "banana", "orange"
}

// ============================================
// FOR-IN LOOP (iterate keys)
// ============================================
const user = { name: "John", age: 25, email: "john@example.com" };
for (const key in user) {
  console.log(`${key}: ${user[key]}`);
}

// ============================================
// ARRAY METHODS (PREFERRED)
// ============================================
// forEach - execute function for each element
fruits.forEach((fruit, index) => {
  console.log(`${index}: ${fruit}`);
});

// map - transform each element
const upperFruits = fruits.map(fruit => fruit.toUpperCase());
console.log(upperFruits);  // ["APPLE", "BANANA", "ORANGE"]

// filter - keep elements that match condition
const numbers = [1, 2, 3, 4, 5];
const evens = numbers.filter(n => n % 2 === 0);
console.log(evens);  // [2, 4]

// find - get first element matching condition
const firstEven = numbers.find(n => n % 2 === 0);
console.log(firstEven);  // 2

// some - check if any element matches
const hasEven = numbers.some(n => n % 2 === 0);
console.log(hasEven);  // true

// every - check if all elements match
const allPositive = numbers.every(n => n > 0);
console.log(allPositive);  // true

// reduce - combine elements into single value
const sum = numbers.reduce((acc, n) => acc + n, 0);
console.log(sum);  // 15 (1+2+3+4+5)
```

### Breaking & Continuing

```javascript
// BREAK - exit loop
for (let i = 0; i < 10; i++) {
  if (i === 5) break;  // Stop at 5
  console.log(i);      // 0, 1, 2, 3, 4
}

// CONTINUE - skip iteration
for (let i = 0; i < 5; i++) {
  if (i === 2) continue;  // Skip 2
  console.log(i);  // 0, 1, 3, 4
}
```

---

## 5. Functions

### Function Declaration

```javascript
// ============================================
// FUNCTION DECLARATION
// ============================================
function greet(name) {
  return `Hello, ${name}!`;
}

console.log(greet("John"));  // "Hello, John!"

// Function with multiple parameters
function add(a, b) {
  return a + b;
}

console.log(add(5, 3));  // 8

// Function with default parameters
function login(email, password = "default123") {
  console.log(`Logging in ${email} with ${password}`);
}

login("john@example.com");  // Uses default password

// ============================================
// FUNCTION EXPRESSION
// ============================================
const multiply = function(a, b) {
  return a * b;
};

console.log(multiply(4, 5));  // 20

// Anonymous function assigned to variable
const square = function(n) {
  return n * n;
};

console.log(square(5));  // 25

// ============================================
// ARROW FUNCTIONS (ES6 - MODERN)
// ============================================
// Single parameter
const double = n => n * 2;
console.log(double(5));  // 10

// Multiple parameters
const addNumbers = (a, b) => a + b;
console.log(addNumbers(3, 4));  // 7

// Multiple lines (need braces and return)
const calculate = (x, y) => {
  const sum = x + y;
  const product = x * y;
  return sum * product;
};

console.log(calculate(2, 3));  // 5 * 6 = 30

// Returns object (need parentheses)
const createUser = (name, age) => ({ name, age });
console.log(createUser("John", 25));  // { name: "John", age: 25 }
```

### Reusable Functions (Important for Your Tests)

```javascript
// ✅ GOOD - Reusable login function
async function login(page, email, password) {
  await page.goto('https://staging.pipeclose.com/');
  await page.getByText('Log in').click();
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.locator("//button[@type='submit']").click();
  await page.waitForLoadState('networkidle');
}

// Use in multiple tests
test('Test 1', async ({ page }) => {
  await login(page, 'test@example.com', 'password123');
  // Continue with test
});

test('Test 2', async ({ page }) => {
  await login(page, 'test@example.com', 'password123');
  // Continue with test
});

// ============================================
// HIGHER-ORDER FUNCTIONS
// ============================================
// Function that takes another function as parameter
function executeAction(action, data) {
  console.log('Executing action...');
  return action(data);
}

const getMessage = (name) => `Hello, ${name}`;
const result = executeAction(getMessage, 'John');
console.log(result);  // "Hello, John"

// Function that returns another function
function createMultiplier(factor) {
  return (number) => number * factor;
}

const double = createMultiplier(2);
const triple = createMultiplier(3);

console.log(double(5));   // 10
console.log(triple(5));   // 15
```

### Variable Scope

```javascript
const globalVar = 'I am global';

function myFunction() {
  const localVar = 'I am local';
  console.log(globalVar);  // ✅ Can access global
  console.log(localVar);   // ✅ Can access local
}

console.log(globalVar);    // ✅ "I am global"
// console.log(localVar);   // ❌ Error - undefined

// ============================================
// CLOSURE - Function remembers outer scope
// ============================================
function createCounter() {
  let count = 0;  // Private variable
  
  return {
    increment: () => {
      count++;
      return count;
    },
    decrement: () => {
      count--;
      return count;
    },
    getCount: () => count
  };
}

const counter = createCounter();
console.log(counter.increment());  // 1
console.log(counter.increment());  // 2
console.log(counter.decrement());  // 1
console.log(counter.getCount());   // 1
// counter.count is NOT accessible (private)
```

---

## 6. Objects & Arrays

### Objects

```javascript
// ============================================
// OBJECT CREATION
// ============================================
// Literal notation
const user = {
  name: 'John Doe',
  email: 'john@example.com',
  age: 25,
  isAdmin: false,
  skills: ['JavaScript', 'Playwright', 'React'],
  address: {
    street: '123 Main St',
    city: 'New York',
    zip: '10001'
  }
};

// ============================================
// ACCESSING PROPERTIES
// ============================================
// Dot notation
console.log(user.name);                // 'John Doe'
console.log(user.address.city);        // 'New York'

// Bracket notation (useful for dynamic keys)
console.log(user['email']);            // 'john@example.com'
const key = 'age';
console.log(user[key]);                // 25

// ============================================
// MODIFYING PROPERTIES
// ============================================
user.name = 'Jane Doe';                // Update
user.phone = '555-0100';               // Add new
delete user.age;                       // Remove

// ============================================
// OBJECT METHODS
// ============================================
// Get all keys
console.log(Object.keys(user));        // ['name', 'email', ...]

// Get all values
console.log(Object.values(user));      // ['John Doe', 'john@example.com', ...]

// Get key-value pairs
console.log(Object.entries(user));     // [['name', 'John Doe'], ['email', ...]]

// Merge objects
const defaults = { role: 'user', active: true };
const merged = { ...user, ...defaults };  // user spreads first, then defaults override

// Freeze object (make immutable)
const frozen = Object.freeze(user);
// frozen.name = 'Jane';  // ❌ Won't work

// ============================================
// DESTRUCTURING (Extract properties)
// ============================================
const { name, email, age } = user;
console.log(name);        // 'John Doe'
console.log(email);       // 'john@example.com'

// Rename while destructuring
const { name: userName, email: userEmail } = user;
console.log(userName);    // 'John Doe'

// Nested destructuring
const { address: { city, zip } } = user;
console.log(city);        // 'New York'

// Default values
const { role = 'user', active = true } = user;
console.log(role);        // 'user' (default)
```

### Arrays - Advanced

```javascript
const numbers = [1, 2, 3, 4, 5];

// ============================================
// ARRAY METHODS (MUTATING - change original)
// ============================================
const arr = [1, 2, 3];
arr.push(4);              // [1, 2, 3, 4]
arr.pop();                // [1, 2, 3] - removes 4
arr.unshift(0);           // [0, 1, 2, 3] - add to start
arr.shift();              // [1, 2, 3] - remove first
arr.splice(1, 1);         // [1, 3] - remove 1 item at index 1
arr.reverse();            // [3, 2, 1]
arr.sort();               // [1, 2, 3]

// ============================================
// ARRAY METHODS (NON-MUTATING - return new array)
// ============================================
const original = [1, 2, 3, 4, 5];

// map - transform each element
const doubled = original.map(n => n * 2);
console.log(doubled);     // [2, 4, 6, 8, 10]

// filter - keep matching elements
const evens = original.filter(n => n % 2 === 0);
console.log(evens);       // [2, 4]

// slice - extract portion (doesn't mutate)
const slice = original.slice(1, 3);
console.log(slice);       // [2, 3]

// concat - combine arrays
const combined = original.concat([6, 7]);
console.log(combined);    // [1, 2, 3, 4, 5, 6, 7]

// ============================================
// ARRAY SEARCH
// ============================================
console.log(original.includes(3));           // true
console.log(original.indexOf(3));            // 2 (index)
console.log(original.find(n => n > 3));      // 4 (first match)
console.log(original.findIndex(n => n > 3)); // 3 (index of first match)

// ============================================
// ARRAY REDUCTION
// ============================================
const sum = original.reduce((acc, n) => acc + n, 0);
console.log(sum);  // 15

const product = original.reduce((acc, n) => acc * n, 1);
console.log(product);  // 120

// ============================================
// ARRAY DESTRUCTURING
// ============================================
const [first, second, ...rest] = [1, 2, 3, 4, 5];
console.log(first);   // 1
console.log(second);  // 2
console.log(rest);    // [3, 4, 5]

// Swapping variables
let a = 5, b = 10;
[a, b] = [b, a];
console.log(a, b);  // 10, 5

// ============================================
// SPREAD OPERATOR (...)
// ============================================
const arr1 = [1, 2, 3];
const arr2 = [4, 5, 6];
const combined2 = [...arr1, ...arr2];
console.log(combined2);  // [1, 2, 3, 4, 5, 6]

// Create copy
const copy = [...arr1];
copy[0] = 999;
console.log(arr1);  // [1, 2, 3] - original unchanged
```

---

## 7. ES6+ Features

### Template Literals

```javascript
const name = 'John';
const age = 25;

// ❌ OLD WAY - String concatenation
const message1 = 'My name is ' + name + ' and I am ' + age + ' years old';

// ✅ MODERN - Template literals (backticks)
const message2 = `My name is ${name} and I am ${age} years old`;

console.log(message2);  // "My name is John and I am 25 years old"

// Expressions inside ${}
console.log(`Next year I'll be ${age + 1}`);  // "Next year I'll be 26"

// Multi-line strings
const html = `
  <div class="user">
    <p>Name: ${name}</p>
    <p>Age: ${age}</p>
  </div>
`;

console.log(html);
```

### Destructuring

```javascript
// ============================================
// OBJECT DESTRUCTURING
// ============================================
const user = { name: 'John', email: 'john@example.com', age: 25 };

// Instead of:
// const name = user.name;
// const email = user.email;

// Do this:
const { name, email } = user;

// ============================================
// ARRAY DESTRUCTURING
// ============================================
const colors = ['red', 'green', 'blue'];

// Instead of:
// const first = colors[0];
// const second = colors[1];

// Do this:
const [first, second] = colors;

// Skip elements
const [primary, , tertiary] = colors;  // primary='red', tertiary='blue'

// ============================================
// FUNCTION PARAMETER DESTRUCTURING
// ============================================
// Instead of:
function printUser(user) {
  console.log(user.name, user.email);
}

// Do this:
function printUser({ name, email }) {
  console.log(name, email);
}

printUser({ name: 'John', email: 'john@example.com' });
```

### Default Parameters

```javascript
// ❌ OLD WAY
function greet(name) {
  if (name === undefined) {
    name = 'Guest';
  }
  console.log(`Hello, ${name}`);
}

// ✅ MODERN WAY
function greet(name = 'Guest') {
  console.log(`Hello, ${name}`);
}

greet();           // "Hello, Guest"
greet('John');     // "Hello, John"

// Works with destructuring too
function createUser({ name = 'John', age = 25 } = {}) {
  console.log(`${name} is ${age} years old`);
}

createUser();                          // "John is 25 years old"
createUser({ name: 'Jane' });          // "Jane is 25 years old"
createUser({ name: 'Bob', age: 30 });  // "Bob is 30 years old"
```

### Rest & Spread Operators

```javascript
// ============================================
// REST OPERATOR (in function parameters)
// ============================================
function sum(...numbers) {
  return numbers.reduce((acc, n) => acc + n, 0);
}

console.log(sum(1, 2, 3));        // 6
console.log(sum(1, 2, 3, 4, 5));  // 15

// Combine first param with rest
function greetMany(greeting, ...names) {
  names.forEach(name => console.log(`${greeting}, ${name}`));
}

greetMany('Hello', 'John', 'Jane', 'Bob');

// ============================================
// SPREAD OPERATOR (in literals/calls)
// ============================================
// Spread array
const arr1 = [1, 2, 3];
const arr2 = [...arr1, 4, 5];
console.log(arr2);  // [1, 2, 3, 4, 5]

// Spread object
const user = { name: 'John', age: 25 };
const updatedUser = { ...user, age: 26, email: 'john@example.com' };
console.log(updatedUser);  // { name: 'John', age: 26, email: '...' }

// Function call with spread
const numbers = [1, 2, 3];
Math.max(...numbers);  // Same as Math.max(1, 2, 3)
```

### Shorthand Properties & Methods

```javascript
// ============================================
// PROPERTY SHORTHAND
// ============================================
const name = 'John';
const age = 25;

// ❌ OLD WAY
const user1 = {
  name: name,
  age: age
};

// ✅ NEW WAY
const user2 = {
  name,  // Same as name: name
  age    // Same as age: age
};

// ============================================
// METHOD SHORTHAND
// ============================================
// ❌ OLD WAY
const obj1 = {
  name: 'John',
  greet: function() {
    console.log(`Hello, ${this.name}`);
  }
};

// ✅ NEW WAY
const obj2 = {
  name: 'John',
  greet() {
    console.log(`Hello, ${this.name}`);
  }
};

obj2.greet();  // "Hello, John"

// ============================================
// COMPUTED PROPERTY NAMES
// ============================================
const key = 'email';
const user = {
  name: 'John',
  [key]: 'john@example.com',  // email: 'john@example.com'
  [key.toUpperCase()]: 'JOHN@EXAMPLE.COM'  // EMAIL: 'JOHN@EXAMPLE.COM'
};

console.log(user.email);  // 'john@example.com'
```

---

## 8. Async/Await & Promises

### Understanding Promises

```javascript
// ============================================
// PROMISE CREATION
// ============================================
const myPromise = new Promise((resolve, reject) => {
  // Simulate async operation
  setTimeout(() => {
    const success = Math.random() > 0.5;
    if (success) {
      resolve('Operation successful!');  // Success case
    } else {
      reject('Operation failed!');       // Error case
    }
  }, 1000);
});

// ============================================
// PROMISE STATES
// ============================================
// 1. PENDING - operation not yet complete
// 2. FULFILLED - operation succeeded
// 3. REJECTED - operation failed

// ============================================
// CONSUMING PROMISES - .then() / .catch()
// ============================================
myPromise
  .then(result => {
    console.log(result);  // Handles success
  })
  .catch(error => {
    console.log(error);   // Handles error
  })
  .finally(() => {
    console.log('Done');  // Runs always
  });

// ============================================
// PROMISE CHAINING
// ============================================
function fetchUser(userId) {
  return new Promise(resolve => {
    setTimeout(() => resolve({ id: userId, name: 'John' }), 500);
  });
}

function fetchPosts(userId) {
  return new Promise(resolve => {
    setTimeout(() => resolve([
      { id: 1, title: 'Post 1', userId },
      { id: 2, title: 'Post 2', userId }
    ]), 500);
  });
}

fetchUser(1)
  .then(user => {
    console.log('User:', user);
    return fetchPosts(user.id);  // Chain promises
  })
  .then(posts => {
    console.log('Posts:', posts);
  })
  .catch(error => {
    console.log('Error:', error);
  });
```

### Async/Await (Modern Approach)

```javascript
// ============================================
// ASYNC FUNCTION BASICS
// ============================================
async function getUser() {
  // Inside async function, can use await
  const response = await fetch('https://api.example.com/user');
  const data = await response.json();
  return data;
}

// Calling async function
getUser().then(user => {
  console.log(user);
});

// ============================================
// ASYNC/AWAIT WITH TRY/CATCH
// ============================================
async function login(email, password) {
  try {
    // Await waits for promise to resolve
    const response = await fetch('https://api.example.com/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const user = await response.json();
    return user;
    
  } catch (error) {
    // Catch rejects or thrown errors
    console.error('Login failed:', error.message);
    throw error;  // Re-throw to propagate error
  } finally {
    // Always runs
    console.log('Login attempt complete');
  }
}

// Usage
await login('john@example.com', 'password123');

// ============================================
// CONCURRENT ASYNC OPERATIONS
// ============================================
// Sequential - one after another
async function fetchSequential() {
  const user = await fetchUser(1);      // Wait
  const posts = await fetchPosts(user.id);  // Then wait
  return { user, posts };
}

// Concurrent - parallel
async function fetchConcurrent() {
  // Start both requests simultaneously
  const [user, posts] = await Promise.all([
    fetchUser(1),
    fetchPosts(1)
  ]);
  return { user, posts };
}

// ============================================
// YOUR PLAYWRIGHT TESTS USE ASYNC/AWAIT
// ============================================
test('Login test', async ({ page }) => {
  // This is an async function automatically
  await page.goto('https://staging.pipeclose.com/');      // Wait for navigation
  await page.getByText('Log in').click();          // Wait for click
  await page.getByPlaceholder('Email').fill('test@example.com');  // Wait
  await page.getByPlaceholder('Password').fill('password');       // Wait
  await page.locator("//button[@type='submit']").click();  // Wait
  
  // Await ensures each step completes before next
});
```

### Promise.all() & Promise.race()

```javascript
// ============================================
// PROMISE.ALL() - Wait for all
// ============================================
async function fetchAllData() {
  try {
    const [user, posts, comments] = await Promise.all([
      fetchUser(1),
      fetchPosts(1),
      fetchComments(1)
    ]);
    return { user, posts, comments };
  } catch (error) {
    console.log('One or more requests failed');
  }
}

// If any promise rejects, whole thing rejects

// ============================================
// PROMISE.RACE() - First to resolve
// ============================================
async function fetchWithTimeout() {
  const timeout = new Promise((resolve, reject) => {
    setTimeout(() => reject('Timeout!'), 5000);
  });
  
  try {
    const result = await Promise.race([
      fetchUser(1),
      timeout
    ]);
    return result;
  } catch (error) {
    console.log(error);  // Might be timeout
  }
}

// Returns first promise to settle (resolve or reject)
```

---

## 9. Error Handling

### Try/Catch/Finally

```javascript
// ============================================
// BASIC TRY/CATCH
// ============================================
try {
  // Code that might throw error
  const result = riskyOperation();
  console.log(result);
} catch (error) {
  // Handle error
  console.error('Error occurred:', error.message);
} finally {
  // Always runs (cleanup)
  console.log('Done');
}

// ============================================
// WITH ASYNC/AWAIT
// ============================================
async function asyncTask() {
  try {
    const data = await fetchData();
    return data;
  } catch (error) {
    console.error('Failed to fetch:', error);
    throw error;  // Re-throw if needed
  }
}

// ============================================
// NESTED TRY/CATCH
// ============================================
async function complexOperation() {
  try {
    const user = await fetchUser(1);
    
    try {
      const posts = await fetchPosts(user.id);
      console.log(posts);
    } catch (postError) {
      console.log('Failed to fetch posts:', postError);
      // Don't re-throw - continue with user data only
    }
    
    return user;
  } catch (userError) {
    console.error('Failed to fetch user:', userError);
    throw userError;  // Re-throw main error
  }
}

// ============================================
// ERROR OBJECT
// ============================================
try {
  throw new Error('Something went wrong!');
} catch (error) {
  console.log(error.message);   // 'Something went wrong!'
  console.log(error.name);      // 'Error'
  console.log(error.stack);     // Stack trace
}

// ============================================
// CUSTOM ERRORS
// ============================================
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

try {
  throw new ValidationError('Email is required');
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Validation issue:', error.message);
  }
}
```

### Error Handling in Your Tests

```javascript
// ✅ GOOD ERROR HANDLING
test('Login with error handling', async ({ page }) => {
  try {
    // Navigation
    try {
      await page.goto("https://staging.pipeclose.com/", { 
        waitUntil: 'domcontentloaded' 
      });
    } catch (error) {
      throw new Error(`Navigation failed: ${error.message}`);
    }

    // Login
    try {
      const emailField = page.getByPlaceholder("Email");
      if (!await emailField.isVisible({ timeout: 5000 })) {
        throw new Error("Email field not visible");
      }
      await emailField.fill("ashishappnox1@gmail.com");
      
      const submitButton = page.locator("//button[@type='submit']");
      await submitButton.click();
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }

    // Verify success
    const dashboard = page.locator('.dashboard');
    if (!await dashboard.isVisible({ timeout: 5000 })) {
      throw new Error('Dashboard not visible after login');
    }
  } catch (error) {
    console.error(`Test failed: ${error.message}`);
    throw error;
  }
});
```

---

## 10. CommonJS vs ES6 Modules

### CommonJS (Your Project Uses This)

```javascript
// ============================================
// EXPORTING
// ============================================
// Export single function
module.exports = function login(page) {
  // Implementation
};

// Export object with multiple exports
module.exports = {
  login: async function(page, email, password) { ... },
  logout: async function(page) { ... },
  verifyLogin: async function(page) { ... }
};

// Export variables/constants
module.exports = {
  API_URL: 'https://staging.pipeclose.com',
  MAX_RETRIES: 3,
  TIMEOUT: 30000
};

// ============================================
// IMPORTING
// ============================================
// Import entire module
const auth = require('./auth.js');
await auth.login(page, 'test@example.com', 'password123');

// Import with destructuring
const { login, logout } = require('./auth.js');
await login(page, 'test@example.com', 'password123');

// Import file without extension (looks for .js)
const loginConfig = require('./loginConfig');

// ============================================
// YOUR PROJECT STRUCTURE
// ============================================
// tests/common/auth.js
module.exports = async function login(page) {
  // Shared login logic
};

// tests/common/loginConfig.js
module.exports = {
  email: 'ashishappnox1@gmail.com',
  password: 'Ashish@567'
};

// tests/Lead/Lead1.spec.js
const { test, expect } = require('@playwright/test');
const login = require('../common/auth.js');  // Import with require

test('Lead test', async ({ page }) => {
  await login(page);  // Use imported function
});
```

### ES6 Modules (Modern, but requires config)

```javascript
// ============================================
// EXPORTING (ES6)
// ============================================
// Named export
export function login(page) {
  // Implementation
}

export function logout(page) {
  // Implementation
}

// Default export
export default function login(page) {
  // Implementation
}

// Re-export
export * from './auth.js';

// ============================================
// IMPORTING (ES6)
// ============================================
// Named import
import { login, logout } from './auth.js';
await login(page);

// Default import
import login from './auth.js';
await login(page);

// Namespace import
import * as auth from './auth.js';
await auth.login(page);

// ============================================
// WHY YOUR PROJECT USES COMMONJS
// ============================================
// In package.json:
{
  "type": "commonjs"  // Uses require/module.exports
  // OR not specified (default is commonjs)
}

// For ES6, would need:
{
  "type": "module"  // Uses import/export
}
```

---

## 11. Working with Strings

### String Methods Used in Your Tests

```javascript
// ============================================
// BASIC STRING METHODS
// ============================================
const text = "Log in";

// Case conversion
console.log(text.toLowerCase());      // "log in"
console.log(text.toUpperCase());      // "LOG IN"

// Searching
console.log(text.includes('Log'));    // true
console.log(text.startsWith('Log'));  // true
console.log(text.endsWith('in'));     // true
console.log(text.indexOf('o'));       // 1
console.log(text.lastIndexOf('n'));   // 5

// Extraction
console.log(text.slice(0, 3));        // "Log"
console.log(text.substring(0, 3));    // "Log"
console.log(text.substr(0, 3));       // "Log" (deprecated)
console.log(text.charAt(0));          // "L"
console.log(text.charCodeAt(0));      // 76 (ASCII code)

// Modification
console.log(text.replace('Log', 'Sign'));  // "Sign in"
console.log(text.replaceAll('i', 'I'));   // "Log In"
console.log(text.split(' '));             // ["Log", "in"]

// Trimming whitespace
console.log("  hello  ".trim());      // "hello"
console.log("  hello  ".trimStart()); // "hello  "
console.log("  hello  ".trimEnd());   // "  hello"

// Repeating
console.log("ab".repeat(3));          // "ababab"

// Padding
console.log("5".padStart(3, '0'));    // "005"
console.log("5".padEnd(3, '0'));      // "500"

// ============================================
// TEMPLATE LITERALS (Most useful for tests)
// ============================================
const email = 'test@example.com';
const password = 'password123';

const message = `
Email: ${email}
Password: ${password}
Length: ${email.length}
`;

console.log(message);
// Email: test@example.com
// Password: password123
// Length: 17
```

---

## 12. Important Concepts

### this Keyword

```javascript
// ============================================
// THIS IN OBJECT METHODS
// ============================================
const user = {
  name: 'John',
  age: 25,
  greet() {
    console.log(`Hello, I'm ${this.name}`);  // this = user object
  }
};

user.greet();  // "Hello, I'm John"

// ============================================
// THIS IN REGULAR FUNCTIONS
// ============================================
const user2 = {
  name: 'Jane',
  greet: function() {
    function inner() {
      console.log(this.name);  // this = undefined (in strict mode)
    }
    inner();
  }
};

user2.greet();  // undefined (or error)

// Fix: use arrow function or bind
const user3 = {
  name: 'Bob',
  greet() {
    const inner = () => {
      console.log(this.name);  // this = user3 (inherited from outer)
    };
    inner();
  }
};

user3.greet();  // "Bob"

// ============================================
// THIS IN ARROW FUNCTIONS
// ============================================
// Arrow functions DON'T have their own 'this'
// They inherit 'this' from parent scope

const obj = {
  name: 'Test',
  method: () => {
    console.log(this);  // THIS = global object (not obj)
  }
};

// Prefer regular functions in object methods
const obj2 = {
  name: 'Test',
  method() {  // Regular function
    console.log(this);  // THIS = obj2
  }
};
```

### call(), apply(), bind()

```javascript
// ============================================
// call() - Execute function with specific 'this'
// ============================================
function greet() {
  console.log(`Hello, ${this.name}`);
}

const user1 = { name: 'John' };
const user2 = { name: 'Jane' };

greet.call(user1);      // "Hello, John"
greet.call(user2);      // "Hello, Jane"

// With arguments
function introduce(age, city) {
  console.log(`${this.name} is ${age} and lives in ${city}`);
}

introduce.call(user1, 25, 'New York');  // "John is 25 and lives in New York"

// ============================================
// apply() - Like call but arguments as array
// ============================================
introduce.apply(user1, [25, 'New York']);  // Same as call

// Useful for spreading arrays
Math.max(1, 2, 3);           // 3
Math.max(...[1, 2, 3]);       // 3
Math.max.apply(null, [1, 2, 3]);  // 3 (pre-spread syntax)

// ============================================
// bind() - Create new function with specific 'this'
// ============================================
const boundGreet = greet.bind(user1);
boundGreet();  // "Hello, John" (remembers user1)

// With arguments
const boundIntroduce = introduce.bind(user1);
boundIntroduce(25, 'New York');  // "John is 25 and lives in New York"

// Partial application
const boundIntroduce2 = introduce.bind(user1, 25);  // Age preset
boundIntroduce2('New York');  // "John is 25 and lives in New York"
```

### Callback Functions

```javascript
// ============================================
// SIMPLE CALLBACK
// ============================================
function readFile(filename, callback) {
  // Simulate reading file
  setTimeout(() => {
    callback(null, 'File contents');  // Call callback
  }, 1000);
}

readFile('test.txt', (error, data) => {
  if (error) {
    console.error(error);
  } else {
    console.log(data);  // "File contents"
  }
});

// ============================================
// ARRAY CALLBACKS
// ============================================
const numbers = [1, 2, 3, 4, 5];

// map uses callback for each element
numbers.map(n => n * 2);  // [2, 4, 6, 8, 10]

// filter uses callback as condition
numbers.filter(n => n > 2);  // [3, 4, 5]

// forEach uses callback for side effects
numbers.forEach(n => console.log(n));

// ============================================
// CALLBACK HELL (AVOID)
// ============================================
// ❌ Nested callbacks - hard to read
readFile('file1.txt', (err, data1) => {
  readFile('file2.txt', (err, data2) => {
    readFile('file3.txt', (err, data3) => {
      console.log(data1, data2, data3);
    });
  });
});

// ✅ BETTER - Use Promises or async/await
const data1 = await readFilePromise('file1.txt');
const data2 = await readFilePromise('file2.txt');
const data3 = await readFilePromise('file3.txt');
console.log(data1, data2, data3);
```

---

## 13. Classes & Object-Oriented Programming

### Class Basics

```javascript
// ============================================
// CLASS DEFINITION
// ============================================
class User {
  // Constructor - runs when creating instance
  constructor(name, email) {
    this.name = name;
    this.email = email;
  }

  // Method
  greet() {
    console.log(`Hello, ${this.name}`);
  }

  // Another method
  getInfo() {
    return `${this.name} (${this.email})`;
  }

  // Static method (belongs to class, not instance)
  static createGuest() {
    return new User('Guest', 'guest@example.com');
  }
}

// ============================================
// CREATING INSTANCES
// ============================================
const user1 = new User('John', 'john@example.com');
const user2 = new User('Jane', 'jane@example.com');

user1.greet();                    // "Hello, John"
console.log(user1.getInfo());     // "John (john@example.com)"

const guest = User.createGuest(); // Static method
console.log(guest.name);          // "Guest"

// ============================================
// INHERITANCE
// ============================================
class Admin extends User {
  constructor(name, email, role) {
    super(name, email);  // Call parent constructor
    this.role = role;
  }

  greet() {
    console.log(`Hello Admin, ${this.name}`);  // Override parent method
  }

  getPermissions() {
    return ['read', 'write', 'delete'];
  }
}

const admin = new Admin('Alice', 'alice@example.com', 'superadmin');
admin.greet();              // "Hello Admin, Alice"
console.log(admin.getInfo()); // "Alice (alice@example.com)" - inherited

// ============================================
// GETTERS & SETTERS
// ============================================
class Person {
  constructor(firstName, lastName) {
    this._firstName = firstName;
    this._lastName = lastName;
  }

  // Getter - access like property
  get fullName() {
    return `${this._firstName} ${this._lastName}`;
  }

  // Setter - assign like property
  set fullName(name) {
    const [first, last] = name.split(' ');
    this._firstName = first;
    this._lastName = last;
  }
}

const person = new Person('John', 'Doe');
console.log(person.fullName);  // "John Doe" - getter
person.fullName = 'Jane Smith';  // setter
console.log(person.fullName);  // "Jane Smith"
```

### Page Object Model Pattern (For Your Tests)

```javascript
// ============================================
// PAGE OBJECT PATTERN
// ============================================
class LoginPage {
  constructor(page) {
    this.page = page;
    
    // Define locators as properties
    this.emailInput = page.getByPlaceholder('Email');
    this.passwordInput = page.getByPlaceholder('Password');
    this.submitButton = page.locator("//button[@type='submit']");
    this.loginLink = page.getByText('Log in');
  }

  // Methods for actions
  async goto() {
    await this.page.goto('https://staging.pipeclose.com/');
  }

  async clickLogin() {
    await this.loginLink.click();
  }

  async fillEmail(email) {
    await this.emailInput.fill(email);
  }

  async fillPassword(password) {
    await this.passwordInput.fill(password);
  }

  async submit() {
    await this.submitButton.click();
  }

  // Compound action
  async login(email, password) {
    await this.goto();
    await this.clickLogin();
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
    await this.page.waitForLoadState('networkidle');
  }
}

// ============================================
// USAGE IN TEST
// ============================================
test('Create Lead', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.login('test@example.com', 'password123');
  
  // Continue with test after login
  const leadButton = page.getByText('Lead');
  await leadButton.click();
});

// ============================================
// MULTIPLE PAGE OBJECTS
// ============================================
class LeadPage {
  constructor(page) {
    this.page = page;
  }

  async createLead(leadData) {
    // Implementation
  }
}

class DealPage {
  constructor(page) {
    this.page = page;
  }

  async createDeal(dealData) {
    // Implementation
  }
}

// ============================================
// TEST USING MULTIPLE PAGE OBJECTS
// ============================================
test('Create Lead and Convert to Deal', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const leadPage = new LeadPage(page);
  const dealPage = new DealPage(page);

  await loginPage.login('test@example.com', 'password123');
  await leadPage.createLead({ name: 'John', email: 'john@example.com' });
  await dealPage.createDeal({ value: 50000, stage: 'Negotiation' });
});
```

---

## 14. Your Project Analysis

### Your Current JavaScript Usage

**Good Practices Found:**
✅ Using `require()` correctly for imports  
✅ Using async/await in tests  
✅ Using try/catch for error handling (some files)  
✅ Template literals in some places  
✅ Destructuring in some tests  

**Issues Found:**

1. **Inconsistent String Methods**
```javascript
// ❌ USING TYPE()
await page.getByPlaceholder("Email").type("test@example.com");

// ✅ SHOULD USE FILL()
await page.getByPlaceholder("Email").fill("test@example.com");
```

2. **Hard-coded Values Everywhere**
```javascript
// ❌ REPEATED IN MULTIPLE TESTS
await page.getByPlaceholder("Email").fill("ashishappnox1@gmail.com");
await page.getByPlaceholder("Password").fill("Ashish@567");

// ✅ SHOULD USE CONFIG
const { email, password } = require('../common/loginConfig');
await page.getByPlaceholder("Email").fill(email);
await page.getByPlaceholder("Password").fill(password);
```

3. **No Reusable Functions**
```javascript
// ❌ DUPLICATE LOGIC ACROSS TESTS
test('Test 1', async ({ page }) => {
  await page.goto('https://staging.pipeclose.com/');
  await page.getByText('Log in').click();
  await page.getByPlaceholder("Email").fill("email");
  await page.getByPlaceholder("Password").fill("password");
  await page.locator("//button[@type='submit']").click();
});

test('Test 2', async ({ page }) => {
  await page.goto('https://staging.pipeclose.com/');
  await page.getByText('Log in').click();
  // ... same as above
});

// ✅ SHOULD EXTRACT TO FUNCTION
async function login(page, email, password) {
  await page.goto('https://staging.pipeclose.com/');
  await page.getByText('Log in').click();
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.locator("//button[@type='submit']").click();
}
```

4. **Missing Null/Undefined Checks**
```javascript
// ❌ MIGHT BE UNDEFINED
const element = elements.find(el => el.name === 'search');
element.click();  // Error if not found

// ✅ SHOULD CHECK
const element = elements.find(el => el.name === 'search');
if (!element) {
  throw new Error('Element not found');
}
element.click();
```

---

## 15. Common JavaScript Mistakes

### Mistake 1: Using == Instead of ===

```javascript
// ❌ WRONG - Type coercion causes unexpected results
if (5 == "5") {      // true - string "5" converted to number
  console.log("Equal");
}

if (0 == false) {    // true - false converted to 0
  console.log("Equal");
}

// ✅ CORRECT - Strict equality
if (5 === "5") {     // false
  console.log("Equal");
}

if (0 === false) {   // false
  console.log("Equal");
}

// Always use === and !==
```

### Mistake 2: Forgetting to Use await

```javascript
// ❌ WRONG - Forgot await
test('Login', async ({ page }) => {
  page.goto('https://staging.pipeclose.com/');  // Returns promise, not awaited!
  page.getByText('Log in').click();      // Runs before navigation completes
});

// ✅ CORRECT - Use await
test('Login', async ({ page }) => {
  await page.goto('https://staging.pipeclose.com/');
  await page.getByText('Log in').click();
});
```

### Mistake 3: Confusing this

```javascript
// ❌ WRONG - this loses context
const user = {
  name: 'John',
  greet: function() {
    setTimeout(function() {
      console.log(this.name);  // this = undefined (in strict mode)
    }, 1000);
  }
};

user.greet();  // undefined

// ✅ CORRECT - Use arrow function
const user2 = {
  name: 'John',
  greet: function() {
    setTimeout(() => {
      console.log(this.name);  // this = user2 (inherited)
    }, 1000);
  }
};

user2.greet();  // "John"
```

### Mistake 4: Mutating Objects/Arrays Unintentionally

```javascript
// ❌ WRONG - Mutates original
const users = [
  { name: 'John', age: 25 },
  { name: 'Jane', age: 30 }
];

users[0].age = 26;  // Modifies original!

// ✅ CORRECT - Create new array
const updatedUsers = users.map(user => 
  user.name === 'John' ? { ...user, age: 26 } : user
);
// Original unchanged
```

### Mistake 5: Accessing Nested Properties Without Checking

```javascript
// ❌ WRONG - Error if any level is undefined
const city = user.address.city;  // Error if address doesn't exist

// ✅ CORRECT - Use optional chaining
const city = user?.address?.city;  // undefined if any level missing

// OR check each level
if (user && user.address && user.address.city) {
  const city = user.address.city;
}
```

### Mistake 6: Callback Hell

```javascript
// ❌ WRONG - Deeply nested callbacks
readFile('file1.txt', (err, data1) => {
  readFile('file2.txt', (err, data2) => {
    readFile('file3.txt', (err, data3) => {
      console.log(data1, data2, data3);
    });
  });
});

// ✅ CORRECT - Use async/await
const data1 = await readFile('file1.txt');
const data2 = await readFile('file2.txt');
const data3 = await readFile('file3.txt');
console.log(data1, data2, data3);
```

### Mistake 7: Not Handling Promise Rejections

```javascript
// ❌ WRONG - Unhandled rejection
const promise = fetchData();
// If it rejects and not caught -> error!

// ✅ CORRECT - Handle rejection
try {
  const data = await fetchData();
} catch (error) {
  console.error('Failed:', error);
}
```

### Mistake 8: Using var Instead of const/let

```javascript
// ❌ OLD - var causes scope issues
var x = 1;
{
  var x = 2;
}
console.log(x);  // 2 - var is function-scoped!

// ✅ NEW - const/let are block-scoped
const x = 1;
{
  const x = 2;
}
console.log(x);  // 1 - block scope preserved

// Also var can be redeclared
var name = "John";
var name = "Jane";  // Accidentally overwrite - bad!

const email = "john@example.com";
// const email = "jane@example.com";  // Error - can't redeclare
```

---

## 16. Best Practices

### Naming Conventions

```javascript
// ✅ GOOD NAMES
const MAX_RETRIES = 3;           // Constants in UPPER_CASE
const userEmail = 'john@example.com';  // Variables camelCase
const calculateTotal = () => {};  // Functions camelCase

class User {}                     // Classes PascalCase
class LoginPage {}                // Classes PascalCase

const users = [];                 // Arrays plural
const isValid = true;             // Booleans: is/has prefix

// ❌ BAD NAMES
const x = 3;                      // Too vague
const temp = "string";            // No context
const data = {a: 1, b: 2};        // Single letter keys

// ============================================
// DESCRIPTIVE VARIABLE NAMES
// ============================================
// ❌ BAD
const d = 30000;
const c = 'https://staging.pipeclose.com/';

// ✅ GOOD
const DEFAULT_TIMEOUT = 30000;
const BASE_URL = 'https://staging.pipeclose.com/';
```

### Code Organization

```javascript
// ============================================
// SINGLE RESPONSIBILITY
// ============================================
// ❌ BAD - Mixing concerns
async function loginAndCreateLead(page, email, password, leadName) {
  // Login logic
  // Lead creation logic
  // Mixed together - hard to test/reuse
}

// ✅ GOOD - Separate concerns
async function login(page, email, password) {
  // Only login logic
}

async function createLead(page, leadName) {
  // Only lead creation logic
}

// Usage
await login(page, email, password);
await createLead(page, leadName);

// ============================================
// DRY (Don't Repeat Yourself)
// ============================================
// ❌ BAD - Repeated code
test('Create Lead', async ({ page }) => {
  await page.goto('https://staging.pipeclose.com/');
  await page.getByText('Log in').click();
  // ... login steps
});

test('Create Deal', async ({ page }) => {
  await page.goto('https://staging.pipeclose.com/');
  await page.getByText('Log in').click();
  // ... login steps (REPEATED)
});

// ✅ GOOD - Reusable function
const login = require('./common/auth');

test('Create Lead', async ({ page }) => {
  await login(page, 'test@example.com', 'password123');
});

test('Create Deal', async ({ page }) => {
  await login(page, 'test@example.com', 'password123');
});
```

### Comments & Documentation

```javascript
// ============================================
// GOOD COMMENTS
// ============================================
/**
 * Logs in a user to the PipeClose application
 * @param {Page} page - Playwright page object
 * @param {string} email - User email address
 * @param {string} password - User password
 * @returns {Promise<void>}
 * 
 * @example
 * await login(page, 'test@example.com', 'password123');
 */
async function login(page, email, password) {
  // Implementation
}

// ✅ GOOD - Explain WHY, not WHAT
// Wait for network idle because deal creation triggers multiple API calls
await page.waitForLoadState('networkidle');

// ❌ BAD - Obvious comment
// Check if email contains @
if (email.includes('@')) {

// ============================================
// DEBUGGING
// ============================================
// Temporary console logs for debugging
console.log('User:', user);  // DEBUG

// Better: Use debug flag
const DEBUG = true;
if (DEBUG) {
  console.log('User:', user);
}
```

### Performance Tips

```javascript
// ============================================
// EFFICIENT ARRAY OPERATIONS
// ============================================
const numbers = [1, 2, 3, 4, 5];

// ❌ SLOW - Multiple iterations
const doubled = numbers.map(n => n * 2);
const evens = doubled.filter(n => n % 2 === 0);

// ✅ FAST - Single iteration
const result = numbers
  .filter(n => n % 2 === 0)
  .map(n => n * 2);

// ============================================
// ASYNC OPERATIONS
// ============================================
// ❌ SLOW - Sequential (total: 3 seconds)
const user = await fetchUser();
const posts = await fetchPosts(user.id);
const comments = await fetchComments(posts[0].id);

// ✅ FAST - Parallel (total: 1 second)
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments()
]);

// ============================================
// STRING OPERATIONS
// ============================================
// ❌ SLOW - Concatenation in loop
let result = '';
for (let i = 0; i < 1000; i++) {
  result += `Item ${i}, `;
}

// ✅ FAST - Array join
const items = [];
for (let i = 0; i < 1000; i++) {
  items.push(`Item ${i}`);
}
const result = items.join(', ');
```

---

## 17. Real Examples from Your Code

### Example 1: Current Login Code Issues

```javascript
// ❌ CURRENT VERSION - With Issues
const { test, expect } = require('@playwright/test');

test("valid login", async ({ page }) => {
  try {
    await page.goto("https://staging.pipeclose.com/", { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
  } catch (error) {
    throw new Error(`Failed to navigate to website: ${error.message}`);
  }

    await page.getByText('Log in').click();
    await page.waitForTimeout(1000);  // Hard wait

    try {
      const emailField = page.getByPlaceholder("Email");
      if (!await emailField.isVisible({ timeout: 5000 })) {
        throw new Error("Email field not visible on login page");
      }
      // Issue: Hardcoded email
      await emailField.fill("ashishappnox1@gmail.com");
      await page.waitForTimeout(500);

      const passwordField = page.getByPlaceholder("Password");
      if (!await passwordField.isVisible({ timeout: 5000 })) {
        throw new Error("Password field not visible on login page");
      }
      // Issue: Hardcoded password
      await passwordField.fill("Ashish@567");
      await page.waitForTimeout(500);

      const submitButton = page.locator("//button[@type='submit']");
      if (!await submitButton.isVisible()) {
        throw new Error("Submit button not found");
      }
      await submitButton.click();
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
    // Issue: No assertion to verify login worked
});

// ============================================
// ✅ IMPROVED VERSION
// ============================================
const { test, expect } = require('@playwright/test');
const loginConfig = require('../common/loginConfig');

async function login(page, email = loginConfig.email, password = loginConfig.password) {
  await page.goto('https://staging.pipeclose.com/', { waitUntil: 'domcontentloaded' });
  await page.getByText('Log in').click();
  
  const emailField = page.getByPlaceholder('Email');
  await emailField.waitFor({ state: 'visible', timeout: 5000 });
  await emailField.fill(email);
  
  const passwordField = page.getByPlaceholder('Password');
  await passwordField.waitFor({ state: 'visible', timeout: 5000 });
  await passwordField.fill(password);
  
  const submitButton = page.locator("//button[@type='submit']");
  await submitButton.click();
  await page.waitForLoadState('networkidle');
}

test("[Login] should successfully authenticate user", async ({ page }) => {
  await login(page);
  
  // Verify success
  const dashboard = page.locator('.dashboard');
  await expect(dashboard).toBeVisible();
});
```

### Example 2: Deal Creation - Before & After

```javascript
// ❌ CURRENT - Multiple Issues
test("Deal Creation", async function ({page, context}) {
  await page.goto("https://staging.pipeclose.com/");
  await page.getByText('Log in').click();
  await page.waitForTimeout(1000);

  // Issue 1: Using type() instead of fill()
  await page.getByPlaceholder("Email").type("ashishappnox14@gmail.com");
  await page.waitForTimeout(1000);
  // Issue 2: Hardcoded values
  await page.getByPlaceholder("Password").type("Ashish@567");
  await page.waitForTimeout(1000);

  // Issue 3: XPath with space
  await page.locator("//button[@type ='submit']").click();
  
  // Issue 4: Hard wait
  await page.locator("//button[normalize-space()='Deal']").click();

  // Issue 5: Using getByPlaceholder twice without distinction
  await page.getByPlaceholder('name').first().fill('Ashish Rai');

  const orgField = page.getByPlaceholder('name').nth(1);
  await orgField.click();
  // Issue 6: Using type() again
  await orgField.type('Appnox Technologies Pvt. Ltd.');
  
  // NO ASSERTIONS - Test doesn't verify anything!
});

// ✅ IMPROVED VERSION
const { test, expect } = require('@playwright/test');
const loginConfig = require('../common/loginConfig');

class DealPage {
  constructor(page) {
    this.page = page;
  }

  async openDealForm() {
    await this.page.getByText('Deal').click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async fillPersonName(name) {
    const nameField = this.page.getByPlaceholder('name').first();
    await nameField.waitFor({ state: 'visible' });
    await nameField.fill(name);
  }

  async fillOrganization(org) {
    const orgField = this.page.getByPlaceholder('name').nth(1);
    await orgField.waitFor({ state: 'visible' });
    await orgField.fill(org);
  }

  async submit() {
    await this.page.getByRole('button', { name: 'Save' }).click();
    await this.page.waitForLoadState('networkidle');
  }
}

test("[Deal] should create deal with valid information", async ({ page }) => {
  // Setup
  const dealPage = new DealPage(page);
  
  // Login
  await page.goto('https://staging.pipeclose.com/');
  await page.getByText('Log in').click();
  await page.getByPlaceholder('Email').fill(loginConfig.email);
  await page.getByPlaceholder('Password').fill(loginConfig.password);
  await page.locator("//button[@type='submit']").click();
  
  // Create deal
  await dealPage.openDealForm();
  await dealPage.fillPersonName('Ashish Rai');
  await dealPage.fillOrganization('Appnox Technologies Pvt. Ltd.');
  await dealPage.submit();
  
  // Verify
  const successMsg = page.getByText('Deal created successfully');
  await expect(successMsg).toBeVisible();
});
```

---

## 18. Quick Reference

### Essential JavaScript Commands

```javascript
// Variables
const name = 'value';      // Constant (preferred)
let count = 0;             // Variable (when reassignment needed)

// Functions
async function myFunc(param) { }           // Regular
const arrow = (param) => { };              // Arrow
const reusable = require('./file');        // Import

// Strings
'text'.toLowerCase()       // to lowercase
'text'.toUpperCase()       // to UPPERCASE
'text'.includes('e')       // contains
`${variable} text`         // template literal

// Arrays
[1, 2, 3].map(n => n * 2)  // transform
[1, 2, 3].filter(n => n > 1)  // filter
[1, 2, 3].forEach(n => {}) // iterate

// Objects
{ name: 'value' }          // create
obj.name                   // access
Object.keys(obj)           // get keys

// Conditionals
if (condition) { }         // if
condition ? true : false   // ternary

// Async
await asyncFunc()          // wait for promise
try { } catch(e) { }       // error handling

// CommonJS
require('./file')          // import
module.exports = {}        // export
```

---

## Summary

### Key JavaScript Concepts for Your Tests:
1. ✅ **async/await** - Essential for Playwright tests
2. ✅ **Promises** - Understand async operations
3. ✅ **Functions** - Reusable components
4. ✅ **Objects & Arrays** - Data structures
5. ✅ **Error Handling** - try/catch for robustness
6. ✅ **ES6 Features** - Template literals, destructuring, arrow functions
7. ✅ **Classes** - Page Object Model pattern
8. ✅ **CommonJS** - require/module.exports for imports

### Your Quick Wins:
- [ ] Replace `.type()` with `.fill()` everywhere
- [ ] Extract login to reusable function
- [ ] Use loginConfig instead of hardcoded credentials
- [ ] Add assertions to all tests
- [ ] Implement Page Object Model for major pages

---

**Document Version:** 1.0  
**Last Updated:** June 29, 2026  
**Framework:** Playwright + JavaScript (CommonJS)
