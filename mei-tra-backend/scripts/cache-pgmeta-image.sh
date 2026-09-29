#!/usr/bin/env bash
set -euo pipefail

# Supabase CLI 2.116.0 runs postgres-meta from public ECR directly during
# `gen types --local`, even when setup-cli selects GHCR. GitHub runners can
# exhaust the public ECR download limit. Keep this tag in sync with the CLI.
if [[ "$(<.supabase-cli-version)" != '2.116.0' ]]; then
  echo 'Update the postgres-meta image tag for the pinned Supabase CLI version.' >&2
  exit 1
fi

readonly pgmeta_tag='v0.98.0'
readonly ghcr_image="ghcr.io/supabase/postgres-meta:${pgmeta_tag}"
readonly ecr_image="public.ecr.aws/supabase/postgres-meta:${pgmeta_tag}"

docker pull "$ghcr_image"
docker tag "$ghcr_image" "$ecr_image"
