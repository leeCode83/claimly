#!/bin/bash
# =============================================================================
# SETUP NETWORK SCRIPT
# =============================================================================
# Fungsi: Menyiapkan network Docker dan menghubungkan container yang sudah ada
# Usage: ./scripts/setup-network.sh
# =============================================================================

set -e  # Exit on error

# Nama network yang akan dibuat/digunakan
NETWORK_NAME="claimly_network"

# Warna untuk output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  CLAIMLY NETWORK SETUP SCRIPT${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

# =============================================================================
# STEP 1: Cek apakah network sudah ada
# =============================================================================
echo -e "${YELLOW}Step 1: Checking network...${NC}"

if docker network inspect "$NETWORK_NAME" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Network '$NETWORK_NAME' already exists${NC}"
else
    echo -e "${YELLOW}  Creating network '$NETWORK_NAME'...${NC}"
    docker network create "$NETWORK_NAME"
    echo -e "${GREEN}✓ Network '$NETWORK_NAME' created${NC}"
fi

echo ""

# =============================================================================
# STEP 2: Hubungkan container Supabase ke network
# =============================================================================
echo -e "${YELLOW}Step 2: Connecting Supabase containers...${NC}"

# List container Supabase yang perlu dihubungkan
SUPABASE_CONTAINERS=(
    "supabase_kong_claimly"
    "supabase_db_claimly"
    "supabase_studio_claimly"
    "supabase_auth_claimly"
    "supabase_rest_claimly"
    "supabase_storage_claimly"
    "supabase_realtime_claimly"
)

for container in "${SUPABASE_CONTAINERS[@]}"; do
    if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
        if docker network inspect "$NETWORK_NAME" --format '{{range .Containers}}{{.Name}} {{end}}' | grep -q "$container"; then
            echo -e "${GREEN}✓ $container already connected${NC}"
        else
            docker network connect "$NETWORK_NAME" "$container"
            echo -e "${GREEN}✓ Connected $container${NC}"
        fi
    else
        echo -e "${YELLOW}  - $container not found (skipping)${NC}"
    fi
done

echo ""

# =============================================================================
# STEP 3: Hubungkan container Keycloak ke network
# =============================================================================
echo -e "${YELLOW}Step 3: Connecting Keycloak containers...${NC}"

KEYCLOAK_CONTAINERS=(
    "keycloak"
    "keycloak-db"
)

for container in "${KEYCLOAK_CONTAINERS[@]}"; do
    if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
        if docker network inspect "$NETWORK_NAME" --format '{{range .Containers}}{{.Name}} {{end}}' | grep -q "$container"; then
            echo -e "${GREEN}✓ $container already connected${NC}"
        else
            docker network connect "$NETWORK_NAME" "$container"
            echo -e "${GREEN}✓ Connected $container${NC}"
        fi
    else
        echo -e "${YELLOW}  - $container not found (skipping)${NC}"
    fi
done

echo ""

# =============================================================================
# STEP 4: Hubungkan container Redis ke network
# =============================================================================
echo -e "${YELLOW}Step 4: Connecting Redis container...${NC}"

if docker ps -a --format '{{.Names}}' | grep -q "^redis-stack$"; then
    if docker network inspect "$NETWORK_NAME" --format '{{range .Containers}}{{.Name}} {{end}}' | grep -q "redis-stack"; then
        echo -e "${GREEN}✓ redis-stack already connected${NC}"
    else
        docker network connect "$NETWORK_NAME" redis-stack
        echo -e "${GREEN}✓ Connected redis-stack${NC}"
    fi
else
    echo -e "${YELLOW}  - redis-stack not found (skipping)${NC}"
fi

echo ""

# =============================================================================
# STEP 5: Verifikasi network
# =============================================================================
echo -e "${YELLOW}Step 5: Verifying network...${NC}"
echo -e "${GREEN}Containers in network '$NETWORK_NAME':${NC}"
docker network inspect "$NETWORK_NAME" --format '{{range .Containers}}{{.Name}} {{end}}' | tr ' ' '\n' | sed 's/^/  - /'

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  SETUP COMPLETE!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo -e "  1. Build dan jalankan Claimly:${NC}"
echo -e "     ${YELLOW}docker-compose build claimly${NC}"
echo -e "     ${YELLOW}docker-compose up -d claimly${NC}"
echo ""
echo -e "  2. Untuk melihat logs:${NC}"
echo -e "     ${YELLOW}docker-compose logs -f claimly${NC}"
echo ""
