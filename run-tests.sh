#!/bin/bash

echo "🧪 Running Jest Tests for iPhone Inventory Management System"
echo "============================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to run tests
run_tests() {
    local dir=$1
    local name=$2
    local color=$3
    
    echo -e "\n${color}📁 Running $name Tests...${NC}"
    echo "----------------------------------------"
    
    cd "$dir"
    
    if [ -f "package.json" ]; then
        if npm test; then
            echo -e "${GREEN}✅ $name tests passed!${NC}"
            return 0
        else
            echo -e "${RED}❌ $name tests failed!${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  No package.json found in $dir${NC}"
        return 1
    fi
    
    cd ..
}

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ Please run this script from the project root directory${NC}"
    exit 1
fi

# Run backend tests
run_tests "backend" "Backend" "$BLUE"
BACKEND_RESULT=$?

# Run frontend tests
run_tests "./iphone-inventory" "Frontend" "$YELLOW"
FRONTEND_RESULT=$?

# Summary
echo -e "\n${BLUE}📊 Test Summary${NC}"
echo "=================="

if [ $BACKEND_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ Backend tests: PASSED${NC}"
else
    echo -e "${RED}❌ Backend tests: FAILED${NC}"
fi

if [ $FRONTEND_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend tests: PASSED${NC}"
else
    echo -e "${RED}❌ Frontend tests: FAILED${NC}"
fi

# Overall result
if [ $BACKEND_RESULT -eq 0 ] && [ $FRONTEND_RESULT -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}💥 Some tests failed!${NC}"
    exit 1
fi
