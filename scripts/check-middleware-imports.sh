#!/bin/bash
# Safety check to prevent Edge Runtime crashes in Middleware

RESTRICTED_FILES="src/middleware.ts src/auth.config.ts"
ILLEGAL_IMPORTS=("@prisma/client" "@/lib/prisma" "node:fs" "fs-extra")

EXIT_CODE=0

for file in $RESTRICTED_FILES; do
    if [ ! -f "$file" ]; then continue; fi
    
    for import in "${ILLEGAL_IMPORTS[@]}"; do
        if grep -q "$import" "$file"; then
            echo "❌ ERROR: Illegal import '$import' found in $file"
            echo "   Middleware runs in Edge Runtime and cannot use Node.js-only modules."
            EXIT_CODE=1
        fi
    done
done

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Edge compatibility check passed."
fi

exit $EXIT_CODE
