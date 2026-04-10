# =============================================================================
# DOCKERFILE FOR CLAIMLY - Using Local Build
# =============================================================================
# Penjelasan:
# - Build dilakukan di lokal (host machine) terlebih dahulu
# - Docker hanya menyalin hasil build dari lokal
# - Ini menghindari error karena Redis/Supabase tidak tersedia saat build
# =============================================================================

# =============================================================================
# STAGE 1: Dependencies
# - Install node_modules untuk production runtime
# =============================================================================
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies (hanya production dependencies)
RUN npm ci --omit=dev --legacy-peer-deps

# =============================================================================
# STAGE 2: Production Runner
# - Hanya menyalin file yang sudah di-build dari lokal
# - Tidak perlu build di dalam container
# =============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Set environment untuk production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Ubah user dari root ke node (best practice untuk security)
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy package files untuk dependencies
COPY --from=deps /app/node_modules ./node_modules

# =============================================================================
# Copy hasil build dari lokal
# ============================================================================
# File-file ini dihasilkan dari `npm run build:docker` di host machine:
# - .next/standalone/    : Next.js production build (standalone mode)
# - .next/static/        : Static assets
# - public/             : Static public files
# - scripts/             : Worker scripts (jika ada)
# - .env.docker         : Environment variables dari lokal
# =============================================================================
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public
COPY .env.docker ./.env.production

# Copy snarkjs dari deps stage ke dalam standalone/node_modules
# Diperlukan karena snarkjs ada di serverExternalPackages (tidak di-bundle),
# sehingga Next.js standalone tidak otomatis menyertakannya.
COPY --from=deps /app/node_modules/snarkjs ./node_modules/snarkjs

# Copy scripts jika ada ( Workers )
COPY --chown=nextjs:nodejs scripts ./scripts

# Set ownership ke nextjs user
RUN chown nextjs:nodejs /app


# Switch ke user nextjs (tidak bisa akses root)
USER nextjs

# Expose port 3000 (default Next.js)
EXPOSE 3000

# Command untuk menjalankan Next.js
# server.js ada di folder standalone
CMD ["node", "server.js"]
