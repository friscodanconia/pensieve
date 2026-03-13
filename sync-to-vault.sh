#!/bin/bash
# Sync pensieve-notes from GitHub into Obsidian vault
# Run manually or via cron: */5 * * * * /Users/Soumyo/dear-hermes/sync-to-vault.sh

REPO="friscodanconia/pensieve-notes"
VAULT_NOTES="/Users/Soumyo/Documents/Soumyo's awesome vault/Notes"
TEMP_DIR="/tmp/pensieve-notes-sync"

# Clean temp dir
rm -rf "$TEMP_DIR"

# Clone the repo (shallow, fast)
gh repo clone "$REPO" "$TEMP_DIR" -- --depth 1 --quiet 2>/dev/null

if [ $? -eq 0 ]; then
  # Copy all .md files to vault (overwrite existing)
  cp "$TEMP_DIR"/*.md "$VAULT_NOTES/" 2>/dev/null
  echo "$(date): Synced to vault"
  rm -rf "$TEMP_DIR"
else
  echo "$(date): Sync failed"
fi
