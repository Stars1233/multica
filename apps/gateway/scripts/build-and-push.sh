#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GATEWAY_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(cd "$GATEWAY_DIR/../.." && pwd)"

REPO="085931705009.dkr.ecr.us-west-2.amazonaws.com/super-multica/gateway"
BRANCH="$(git symbolic-ref --short -q HEAD | tr '/' '-')"
IMAGE_TAG="$(date +%F_%H-%M-%S)-${BRANCH}-$(git rev-parse --short HEAD)"
IMAGE="$REPO:$IMAGE_TAG"
IMAGE_LATEST="$REPO:latest"

# Determine if sudo is needed for docker commands
if [[ "$(uname -s)" == "Linux" ]]; then
    DOCKER_CMD="sudo docker"
else
    DOCKER_CMD="docker"
fi

echo "Building image: $IMAGE"
echo "Using Dockerfile: $GATEWAY_DIR/Dockerfile"
echo "Build context: $PROJECT_ROOT"
echo ""

# Login to ECR
aws ecr get-login-password --region us-west-2 | $DOCKER_CMD login --username AWS --password-stdin 085931705009.dkr.ecr.us-west-2.amazonaws.com

# Build from project root with gateway Dockerfile
START_TIME=$(date +%s)
$DOCKER_CMD build \
    -f "$GATEWAY_DIR/Dockerfile" \
    -t "$IMAGE" \
    -t "$IMAGE_LATEST" \
    "$PROJECT_ROOT"
END_TIME=$(date +%s)
echo ""
echo "Build completed in $((END_TIME - START_TIME))s"

# Push both tags
$DOCKER_CMD push "$IMAGE"
$DOCKER_CMD push "$IMAGE_LATEST"

echo ""
echo "Successfully pushed:"
echo "  $IMAGE"
echo "  $IMAGE_LATEST"
