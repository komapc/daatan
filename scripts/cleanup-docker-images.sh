#!/bin/bash
#
# Prune old daatan-app Docker images so the host does not run out of disk
# during a deploy. Keeps the most recent N app tags and N migrations tags
# (default: 3 of each). Never removes an image currently referenced by a
# running container, because `docker rmi` fails loudly on those.
#
# Usage: cleanup-docker-images.sh [KEEP_COUNT]
# Designed to run on the EC2 host via SSM, before a pull.
#

set -u

KEEP_COUNT="${1:-3}"
ECR_REPO="272007598366.dkr.ecr.eu-central-1.amazonaws.com/daatan-app"

echo "🧹 Cleaning up old Docker images (keeping last $KEEP_COUNT app + $KEEP_COUNT migrations tags)..."
echo "   Disk before:"
df -h / | awk 'NR==2 {print "   " $0}'

# List all tags of the ECR daatan-app repo on this host, sorted by creation date
# (newest first). `-migrations` tags live in the same repo so we split on the suffix.
all_tags=$(docker images "$ECR_REPO" --format '{{.Tag}}|{{.CreatedAt}}' | sort -t'|' -k2 -r)

# App tags: everything that does NOT end in -migrations
app_tags=$(echo "$all_tags" | awk -F'|' '$1 !~ /-migrations$/ {print $1}')
mig_tags=$(echo "$all_tags" | awk -F'|' '$1 ~  /-migrations$/ {print $1}')

# Drop the KEEP_COUNT newest from each list; the rest are candidates for removal.
app_remove=$(echo "$app_tags" | tail -n +$((KEEP_COUNT + 1)))
mig_remove=$(echo "$mig_tags" | tail -n +$((KEEP_COUNT + 1)))

removed=0
for tag in $app_remove $mig_remove; do
    # `docker rmi` fails for images backing a running container, which is
    # exactly what we want — those stay. We swallow the error so one
    # in-use tag doesn't abort the whole pass.
    # -f forces untag even if the image has multiple tags, but Docker still
    # refuses to remove an image backing a RUNNING container, so this stays safe.
    if docker rmi -f "$ECR_REPO:$tag" >/dev/null 2>&1; then
        echo "   removed: $tag"
        removed=$((removed + 1))
    fi
done

echo "   Removed $removed tags."

# Drop dangling layers left behind by the rmi pass.
docker system prune -f >/dev/null 2>&1 || true

echo "   Disk after:"
df -h / | awk 'NR==2 {print "   " $0}'
