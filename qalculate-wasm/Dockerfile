# syntax=docker/dockerfile:1
ARG EMSDK_VERSION=6.0.10
FROM emscripten/emsdk:${EMSDK_VERSION} AS dependencies

RUN apt-get update && apt-get install -y --no-install-recommends \
    autoconf automake libtool gettext autopoint pkg-config curl xz-utils \
    && rm -rf /var/lib/apt/lists/*

ARG GMP_VERSION=6.3.0
ARG MPFR_VERSION=4.2.1
ARG LIBXML2_VERSION=2.14.6
ENV CFLAGS="-O2" CXXFLAGS="-O2"
WORKDIR /deps
RUN curl -fL --retry 3 https://ftp.gnu.org/gnu/gmp/gmp-${GMP_VERSION}.tar.xz -o gmp.tar.xz \
    && tar xf gmp.tar.xz && cd gmp-${GMP_VERSION} \
    && emconfigure ./configure --host=none --prefix=/opt/wasm --disable-assembly --disable-shared --enable-static \
    && emmake make -j4 && emmake make install
RUN curl -fL --retry 3 https://ftp.gnu.org/gnu/mpfr/mpfr-${MPFR_VERSION}.tar.xz -o mpfr.tar.xz \
    && tar xf mpfr.tar.xz && cd mpfr-${MPFR_VERSION} \
    && emconfigure ./configure --host=none --prefix=/opt/wasm --with-gmp=/opt/wasm --disable-shared --enable-static --disable-thread-safe \
    && emmake make -j4 && emmake make install
RUN curl -fL --retry 3 https://download.gnome.org/sources/libxml2/2.14/libxml2-${LIBXML2_VERSION}.tar.xz -o libxml2.tar.xz \
    && tar xf libxml2.tar.xz && cd libxml2-${LIBXML2_VERSION} \
    && emconfigure ./configure --host=none --prefix=/opt/wasm --disable-shared --enable-static \
       --without-python --without-programs --without-zlib --without-lzma --without-iconv --without-http \
    && emmake make -j4 && emmake make install

FROM dependencies AS build
WORKDIR /src
ARG LIBQALCULATE_COMMIT=b245c4194a1a8dc14ba7ecf1e811e6d0b60592aa
RUN curl -fL --retry 3 https://codeload.github.com/Qalculate/libqalculate/tar.gz/${LIBQALCULATE_COMMIT} -o /deps/libqalculate.tar.gz \
    && tar xf /deps/libqalculate.tar.gz --strip-components=1 -C /src
# Archive pristine corresponding sources, dependencies, bindings, and the build recipe.
COPY bindings.cc qalculate.d.mts Dockerfile /recipe/
RUN mkdir -p /out \
    && tar czf /out/qalculate-sources.tar.gz -C / deps/gmp.tar.xz deps/mpfr.tar.xz deps/libxml2.tar.xz deps/libqalculate.tar.gz recipe
# Regenerate in the container; never consume host configure output or libraries.
RUN autoreconf -fi \
    && PKG_CONFIG_LIBDIR=/opt/wasm/lib/pkgconfig \
       LIBXML_CFLAGS="-I/opt/wasm/include/libxml2" LIBXML_LIBS="-L/opt/wasm/lib -lxml2" \
       CPPFLAGS="-I/opt/wasm/include" LDFLAGS="-L/opt/wasm/lib" \
       emconfigure ./configure --host=wasm32-unknown-emscripten --prefix=/opt/wasm \
       --disable-shared --enable-static --disable-nls --disable-textport --disable-unittests \
       --without-libcurl --without-icu --without-gnuplot-call --disable-insecure --enable-compiled-definitions \
    && emmake make -C data -j4 \
    && emmake make -C libqalculate -j4 \
    && emmake make -C libqalculate install
COPY bindings.cc qalculate.d.mts wasm/
RUN mkdir -p /out \
    && em++ wasm/bindings.cc -I/opt/wasm/include \
       /opt/wasm/lib/libqalculate.a /opt/wasm/lib/libmpfr.a /opt/wasm/lib/libgmp.a /opt/wasm/lib/libxml2.a \
       --bind -O2 -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,worker \
       -sINCOMING_MODULE_JS_API='["locateFile","wasmBinary"]' \
       -sALLOW_MEMORY_GROWTH=1 -sSTACK_SIZE=16777216 -sSTACK_OVERFLOW_CHECK=2 \
       -sFILESYSTEM=1 -sDYNAMIC_EXECUTION=0 -sASSERTIONS=1 \
       -o /out/qalculate.mjs \
    && cp wasm/qalculate.d.mts /out/ \
    && cp COPYING /out/qalculate-COPYING

FROM scratch AS wasm
COPY --from=build /out/ /
