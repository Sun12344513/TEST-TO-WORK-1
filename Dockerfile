# Moon Studio - Kotlin Android VM Control Panel
# Build with Render's Docker environment.

FROM eclipse-temurin:17-jdk-jammy

ENV DEBIAN_FRONTEND=noninteractive
ENV KOTLIN_VERSION=2.2.21
ENV PATH="/opt/kotlin/kotlinc/bin:/root/.bun/bin:${PATH}"

WORKDIR /app

# Runtime tools required by the Kotlin VM engine.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    unzip \
    qemu-system-x86 \
    adb \
    aapt \
    netpbm \
    netcat-openbsd \
    p7zip-full \
    file \
    && rm -rf /var/lib/apt/lists/*

# Install Kotlin compiler.
RUN mkdir -p /opt/kotlin \
    && curl -fsSL \
       "https://github.com/JetBrains/kotlin/releases/download/v${KOTLIN_VERSION}/kotlin-compiler-${KOTLIN_VERSION}.zip" \
       -o /tmp/kotlin-compiler.zip \
    && unzip -q /tmp/kotlin-compiler.zip -d /opt/kotlin \
    && rm /tmp/kotlin-compiler.zip \
    && mkdir -p /usr/share/kotlin \
    && ln -s /opt/kotlin/kotlinc /usr/share/kotlin/kotlinc

# Install Bun.
RUN curl -fsSL https://bun.sh/install | bash

# Install JS dependencies first for better Docker layer caching.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy application source and bundled Android boot files.
COPY . .

# The Kotlin daemon is compiled from the project's actual Kotlin sources.
RUN mkdir -p /opt/android-vm/classes /opt/android-vm/logs \
    && cp -a opt/android-vm/images /opt/android-vm/ \
    && kotlinc $(find /app/opt/android-vm/kotlin/src -type f -name '*.kt' | sort) \
       -jvm-target 17 \
       -d /opt/android-vm/classes \
    && test -f /opt/android-vm/classes/com/androidvm/Main.class

# Build the Vite frontend.
RUN bun run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "run", "start"]
