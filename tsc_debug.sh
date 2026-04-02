#!/bin/bash
export PATH="/home/unoShin/.nvm/versions/node/v22.17.0/bin:$PATH"
npx tsc --noEmit > tsc_errors.log 2>&1
