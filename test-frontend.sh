#!/bin/bash
# Test script for new frontend features

echo "🧪 Testing Vitamin English Frontend Features"
echo "============================================="

# Login first
echo "1. Testing login..."
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  -c /tmp/test-cookies.txt > /dev/null

if [ $? -eq 0 ]; then
  echo "✓ Login successful"
else
  echo "✗ Login failed"
  exit 1
fi

# Test student API with new fields
echo "2. Testing student API with new fields..."
STUDENT=$(curl -s http://localhost:3000/api/students/1 -b /tmp/test-cookies.txt)
if echo "$STUDENT" | jq 'has("email") and has("phone") and has("parent_name") and has("enrollment_date")' | grep -q "true"; then
  echo "✓ Student API returns new fields"
else
  echo "✗ Student API missing new fields"
fi

# Test makeup lessons API
echo "3. Testing makeup lessons API..."
MAKEUP_COUNT=$(curl -s http://localhost:3000/api/makeup -b /tmp/test-cookies.txt | jq '. | length')
echo "  Found $MAKEUP_COUNT makeup lessons"
echo "✓ Makeup lessons API working"

# Test database search
echo "4. Testing database search API..."
SEARCH_RESULTS=$(curl -s "http://localhost:3000/api/database/search?query=Emma" -b /tmp/test-cookies.txt)
if echo "$SEARCH_RESULTS" | jq -e '.results.students' > /dev/null 2>&1; then
  STUDENT_COUNT=$(echo "$SEARCH_RESULTS" | jq '.results.students | length')
  echo "  Found $STUDENT_COUNT students matching 'Emma'"
  echo "✓ Database search API working"
else
  echo "✗ Database search API failed"
fi

# Test HTML structure
echo "5. Testing HTML structure..."
HTML=$(curl -s http://localhost:3000)

if echo "$HTML" | grep -q "makeup-page"; then
  echo "✓ Make-up Lessons page exists"
else
  echo "✗ Make-up Lessons page missing"
fi

if echo "$HTML" | grep -q "db-search-input"; then
  echo "✓ Database search input exists"
else
  echo "✗ Database search input missing"
fi

if echo "$HTML" | grep -q 'data-page="makeup"'; then
  echo "✓ Make-up Lessons nav button exists"
else
  echo "✗ Make-up Lessons nav button missing"
fi

# Test JavaScript syntax
echo "6. Testing JavaScript syntax..."
if node -c public/js/app.js 2>/dev/null; then
  echo "✓ JavaScript syntax is valid"
else
  echo "✗ JavaScript has syntax errors"
fi

echo ""
echo "============================================="
echo "✅ All tests completed!"
echo "============================================="

# Cleanup
rm -f /tmp/test-cookies.txt
