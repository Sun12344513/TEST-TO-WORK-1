FROM eclipse-temurin:17-jdk-jammy

ENV DEBIAN_FRONTEND=noninteractive
ENV KOTLIN_VERSION=2.2.21
ENV PATH="/opt/kotlin/kotlinc/bin:/root/.bun/bin:${PATH}"

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl unzip git \
    qemu-system-x86 adb aapt netpbm netcat-openbsd p7zip-full file \
    && rm -rf /var/lib/apt/lists/*

# Install Kotlin
RUN mkdir -p /opt/kotlin \
    && curl -fsSL \
    "https://github.com/JetBrains/kotlin/releases/download/v${KOTLIN_VERSION}/kotlin-compiler-${KOTLIN_VERSION}.zip" \
    -o /tmp/kotlin.zip \
    && unzip -q /tmp/kotlin.zip -d /opt/kotlin \
    && rm /tmp/kotlin.zip \
    && mkdir -p /usr/share/kotlin \
    && ln -s /opt/kotlin/kotlinc /usr/share/kotlin/kotlinc

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Fix Kotlin deprecated functions
RUN find /app/opt/android-vm/kotlin/src -type f -name '*.kt' \
    -exec sed -i \
    -e 's/toLowerCase()/lowercase()/g' \
    -e 's/toUpperCase()/uppercase()/g' {} + \
    && if grep -R -n -E 'toLowerCase\(\)|toUpperCase\(\)' \
    /app/opt/android-vm/kotlin/src --include='*.kt'; then \
    echo "Deprecated Kotlin functions remain"; exit 1; \
    fi

# Compile Kotlin VM
RUN mkdir -p /opt/android-vm/classes /opt/android-vm/logs \
    && cp -a /app/opt/android-vm/images /opt/android-vm/ \
    && kotlinc $(find /app/opt/android-vm/kotlin/src -type f -name '*.kt' | sort) \
    -jvm-target 17 \
    -d /opt/android-vm/classes \
    && test -f /opt/android-vm/classes/com/androidvm/Main.class

# Build frontend
RUN bun run build

ENV NODE_ENV=production

EXPOSE 3000 4000

CMD ["bun", "run", "start"]
