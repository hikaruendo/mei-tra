#!/bin/bash

# Create test users for local development
# This script creates 4 test users using the Supabase Admin API

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Supabase local configuration
SUPABASE_URL="http://127.0.0.1:54321"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

echo -e "${YELLOW}🚀 Creating test users for Mei-Tra development...${NC}"
echo ""

# Check if Supabase is running
if ! curl -s "$SUPABASE_URL/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Supabase is not running! Please start it with 'supabase start'${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Supabase is running${NC}"
echo ""

# Create test users
users=(
  "example1@example.com Player1"
  "example2@example.com Player2"
  "example3@example.com Player3"
  "example4@example.com Player4"
)

created_count=0

for user_info in "${users[@]}"; do
  IFS=' ' read -r email username <<< "$user_info"

  echo -n "Creating user: $email ($username)... "

  response=$(curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -d "{
      \"email\": \"$email\",
      \"password\": \"password\",
      \"email_confirm\": true,
      \"user_metadata\": {
        \"username\": \"$username\",
        \"display_name\": \"$username\"
      }
    }")

  # Check if creation was successful
  if echo "$response" | grep -q "\"id\""; then
    echo -e "${GREEN}✅${NC}"
    ((created_count++))
  elif echo "$response" | grep -q "email_exists"; then
    echo -e "${YELLOW}⚠️  (already exists)${NC}"
    ((created_count++))
  else
    echo -e "${RED}❌${NC}"
    echo "   Error: $response"
  fi
done

echo ""
echo -e "${GREEN}🎉 Test user setup completed! ($created_count/4 users ready)${NC}"
echo ""
echo -e "${YELLOW}📝 You can now login with these credentials:${NC}"
echo "  example1@example.com / password"
echo "  example2@example.com / password"
echo "  example3@example.com / password"
echo "  example4@example.com / password"
echo ""
echo -e "${YELLOW}💡 For multi-tab testing, open multiple browser tabs and login with different accounts${NC}"