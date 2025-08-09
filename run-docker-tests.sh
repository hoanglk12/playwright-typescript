#!/bin/bash
# filepath: run-docker-tests.sh

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}🐳 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
    print_success "Docker is running"
}

# Build Docker image
build_image() {
    print_status "Building Docker image..."
    if docker build -t playwright-framework .; then
        print_success "Docker image built successfully"
    else
        print_error "Failed to build Docker image"
        exit 1
    fi
}

# Main execution
main() {
    print_status "Starting Docker Multi-Browser Testing..."
    
    # Check Docker status
    check_docker
    
    # Build image
    build_image
    
    # Load environment
    if [ -f .env.docker ]; then
        export $(cat .env.docker | xargs)
        print_success "Environment variables loaded"
    fi
    
    # Run tests based on argument
    case "$1" in
        "all")
            print_status "Running all browser tests..."
            docker-compose up --abort-on-container-exit --remove-orphans
            ;;
        "chromium")
            print_status "Running Chromium tests..."
            docker-compose run --rm playwright-chromium
            ;;
        "firefox")
            print_status "Running Firefox tests..."
            docker-compose run --rm playwright-firefox
            ;;
        "webkit")
            print_status "Running WebKit tests..."
            docker-compose run --rm playwright-webkit
            ;;
        "api")
            print_status "Running API tests..."
            docker-compose run --rm playwright-api
            ;;
        "parallel")
            print_status "Running UI tests in parallel..."
            docker-compose up playwright-chromium playwright-firefox playwright-webkit --abort-on-container-exit --remove-orphans
            ;;
        "dev")
            print_status "Starting development environment..."
            docker-compose up playwright-dev -d
            print_success "Development container started. Use 'npm run docker:dev:shell' to access shell."
            ;;
        "clean")
            print_status "Cleaning up Docker resources..."
            docker-compose down --volumes --remove-orphans
            docker system prune -f
            print_success "Cleanup completed"
            ;;
        *)
            print_warning "Usage: $0 {all|chromium|firefox|webkit|api|parallel|dev|clean}"
            echo ""
            echo "Examples:"
            echo "  $0 all        - Run all browser tests"
            echo "  $0 chromium   - Run Chromium tests only"
            echo "  $0 firefox    - Run Firefox tests only"
            echo "  $0 webkit     - Run WebKit tests only"
            echo "  $0 api        - Run API tests only"
            echo "  $0 parallel   - Run UI tests in parallel"
            echo "  $0 dev        - Start development environment"
            echo "  $0 clean      - Clean up Docker resources"
            exit 1
            ;;
    esac
    
    if [ $? -eq 0 ]; then
        print_success "Docker tests completed successfully!"
    else
        print_error "Some tests failed. Check the output above."
        exit 1
    fi
}

# Execute main function
main "$@"
