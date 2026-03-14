#!/usr/bin/env bash
# parse-frontmatter.sh — Extract YAML frontmatter fields from a markdown file.
# Usage: source this file, then call get_field <file> <field>

get_field() {
  local file="$1"
  local field="$2"
  sed -n '/^---$/,/^---$/p' "$file" | grep "^${field}:" | head -1 | sed "s/^${field}: *//; s/^\"//; s/\"$//"
}

get_all_frontmatter() {
  local file="$1"
  sed -n '/^---$/,/^---$/{ /^---$/d; p; }' "$file"
}
