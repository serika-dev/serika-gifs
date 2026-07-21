#!/usr/bin/env bun
/**
 * Deduplicate GIFs Script
 * 
 * This script finds and removes duplicate GIFs based on source ID.
 * It keeps the oldest GIF and removes duplicates, transferring favorites,
 * collections, and tags to the original.
 * 
 * Usage:
 *   bun run scripts/deduplicate-gifs.ts [--dry-run] [--verbose]
 * 
 * Options:
 *   --dry-run   Show what would be deleted without actually deleting
 *   --verbose   Show detailed information about each duplicate
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

interface GifRecord {
  id: string
  slug: string
  url: string
  sourceId: string | null
  source: string
  createdAt: Date
}

interface DuplicateGroup {
  key: string
  original: {
    id: string
    slug: string
    url: string
    createdAt: Date
  }
  duplicates: Array<{
    id: string
    slug: string
    url: string
    createdAt: Date
  }>
}

async function findDuplicates(): Promise<DuplicateGroup[]> {
  console.log('🔍 Finding duplicate GIFs...\n')

  // Find GIFs with the same sourceId (grouped by source + sourceId)
  const gifsWithSource: GifRecord[] = await prisma.gif.findMany({
    where: {
      sourceId: { not: null },
    },
    select: {
      id: true,
      slug: true,
      url: true,
      sourceId: true,
      source: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  // Group by source + sourceId
  const groups = new Map<string, GifRecord[]>()

  for (const gif of gifsWithSource) {
    const key = `${gif.source}:${gif.sourceId}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(gif)
  }

  // Find groups with more than one entry
  const duplicateGroups: DuplicateGroup[] = []

  for (const [key, gifs] of groups) {
    if (gifs.length > 1) {
      // Keep the oldest as original
      const [original, ...duplicates] = gifs
      duplicateGroups.push({
        key,
        original: {
          id: original.id,
          slug: original.slug,
          url: original.url,
          createdAt: original.createdAt,
        },
        duplicates: duplicates.map((d: GifRecord) => ({
          id: d.id,
          slug: d.slug,
          url: d.url,
          createdAt: d.createdAt,
        })),
      })
    }
  }

  return duplicateGroups
}

async function mergeDuplicateData(originalId: string, duplicateIds: string[]): Promise<{
  favoritesMerged: number
  collectionsMerged: number
  tagsMerged: number
}> {
  let favoritesMerged = 0
  let collectionsMerged = 0
  let tagsMerged = 0

  for (const dupId of duplicateIds) {
    // Get existing relations on the original
    const [originalFavorites, originalCollections, originalTags] = await Promise.all([
      prisma.favorite.findMany({ where: { gifId: originalId }, select: { userId: true } }),
      prisma.gifOnCollection.findMany({ where: { gifId: originalId }, select: { collectionId: true } }),
      prisma.tagOnGif.findMany({ where: { gifId: originalId }, select: { tagId: true } }),
    ])

    const existingFavoriteUsers = new Set(originalFavorites.map((f: { userId: string }) => f.userId))
    const existingCollections = new Set(originalCollections.map((c: { collectionId: string }) => c.collectionId))
    const existingTags = new Set(originalTags.map((t: { tagId: string }) => t.tagId))

    // Get relations from duplicate
    const [dupFavorites, dupCollections, dupTags] = await Promise.all([
      prisma.favorite.findMany({ where: { gifId: dupId } }),
      prisma.gifOnCollection.findMany({ where: { gifId: dupId } }),
      prisma.tagOnGif.findMany({ where: { gifId: dupId } }),
    ])

    // Transfer favorites (if user hasn't already favorited the original)
    for (const fav of dupFavorites) {
      if (!existingFavoriteUsers.has(fav.userId)) {
        try {
          await prisma.favorite.create({
            data: {
              userId: fav.userId,
              gifId: originalId,
              createdAt: fav.createdAt,
            },
          })
          favoritesMerged++
        } catch {
          // Already exists, skip
        }
      }
    }

    // Transfer collection memberships
    for (const col of dupCollections) {
      if (!existingCollections.has(col.collectionId)) {
        try {
          await prisma.gifOnCollection.create({
            data: {
              gifId: originalId,
              collectionId: col.collectionId,
              addedAt: col.addedAt,
            },
          })
          collectionsMerged++
        } catch {
          // Already exists, skip
        }
      }
    }

    // Transfer tags
    for (const tag of dupTags) {
      if (!existingTags.has(tag.tagId)) {
        try {
          await prisma.tagOnGif.create({
            data: {
              gifId: originalId,
              tagId: tag.tagId,
            },
          })
          tagsMerged++
        } catch {
          // Already exists, skip
        }
      }
    }
  }

  return { favoritesMerged, collectionsMerged, tagsMerged }
}

async function deleteDuplicates(duplicateIds: string[]): Promise<void> {
  // Delete relations first (cascading should handle this, but let's be explicit)
  await prisma.favorite.deleteMany({ where: { gifId: { in: duplicateIds } } })
  await prisma.gifOnCollection.deleteMany({ where: { gifId: { in: duplicateIds } } })
  await prisma.tagOnGif.deleteMany({ where: { gifId: { in: duplicateIds } } })
  
  // Delete the GIFs
  await prisma.gif.deleteMany({ where: { id: { in: duplicateIds } } })
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const verbose = args.includes('--verbose')

  console.log('═══════════════════════════════════════════════════')
  console.log('        GIF Deduplication Script')
  console.log('═══════════════════════════════════════════════════')
  if (dryRun) {
    console.log('🔸 DRY RUN MODE - No changes will be made\n')
  }

  const duplicateGroups = await findDuplicates()

  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicates found!')
    return
  }

  console.log(`Found ${duplicateGroups.length} duplicate groups\n`)

  let totalDuplicates = 0
  let totalFavoritesMerged = 0
  let totalCollectionsMerged = 0
  let totalTagsMerged = 0

  for (const group of duplicateGroups) {
    const duplicateCount = group.duplicates.length
    totalDuplicates += duplicateCount

    if (verbose) {
      console.log(`\n📦 ${group.key}`)
      console.log(`   Original: ${group.original.slug} (${group.original.createdAt.toISOString()})`)
      for (const dup of group.duplicates) {
        console.log(`   Duplicate: ${dup.slug} (${dup.createdAt.toISOString()})`)
      }
    }

    if (!dryRun) {
      // Merge data from duplicates to original
      const duplicateIds = group.duplicates.map(d => d.id)
      const merged = await mergeDuplicateData(group.original.id, duplicateIds)
      
      totalFavoritesMerged += merged.favoritesMerged
      totalCollectionsMerged += merged.collectionsMerged
      totalTagsMerged += merged.tagsMerged

      if (verbose && (merged.favoritesMerged > 0 || merged.collectionsMerged > 0 || merged.tagsMerged > 0)) {
        console.log(`   Merged: ${merged.favoritesMerged} favorites, ${merged.collectionsMerged} collections, ${merged.tagsMerged} tags`)
      }

      // Delete duplicates
      await deleteDuplicates(duplicateIds)
    }
  }

  console.log('\n═══════════════════════════════════════════════════')
  console.log('                    Summary')
  console.log('═══════════════════════════════════════════════════')
  console.log(`Duplicate groups: ${duplicateGroups.length}`)
  console.log(`Total duplicates: ${totalDuplicates}`)
  
  if (!dryRun) {
    console.log(`Favorites merged: ${totalFavoritesMerged}`)
    console.log(`Collections merged: ${totalCollectionsMerged}`)
    console.log(`Tags merged: ${totalTagsMerged}`)
    console.log(`\n✅ Deleted ${totalDuplicates} duplicate GIFs`)
  } else {
    console.log(`\n🔸 Would delete ${totalDuplicates} duplicate GIFs`)
    console.log('   Run without --dry-run to actually delete')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
