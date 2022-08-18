#!/bin/bash

set -xe

if [ -f "/config/pelias.json" ]; then
    echo "Nothing to do, already have pelias config"
elif [ -f "${PELIAS_CONFIG_ARTIFACT_SOURCE_PATH}" ]; then
    echo "Copying artifact."
    cp "${PELIAS_CONFIG_ARTIFACT_SOURCE_PATH}" /config/pelias.json
else
    echo "Downloading artifact."
    wget -O /config/pelias "${PELIAS_CONFIG_ARTIFACT_URL}"
fi