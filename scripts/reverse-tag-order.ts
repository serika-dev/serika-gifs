#!/usr/bin/env bun
/**
 * Reverse Tag Order Script
 *
 * Reverses the display order of GIFs under a given tag from newest-first to
 * oldest-first. Listings sort by `createdAt desc`, so we cannot change the sort
 * per-tag from the DB alone — instead we reverse the *stored* `createdAt`
 * timestamps within the eligible set: the oldest GIF is given the newest
 * timestamp of the set, the second-oldest the second-newest, and so on.
 *
 * The same set of timestamps is reused, so the reordered GIFs stay inside their
 * original time window (they don't jump to the top of the whole site).
 *
 * GIFs uploaded within the last `--recent-days` (default 14) are LEFT UNTOUCHED,
 * per requirement "unless those gifs are from 2 weeks ago or less".
 *
 * Running the script twice restores the original order (it is its own inverse).
 *
 * Usage:
 *   bun run scripts/reverse-tag-order.ts --tag=kamiina-botan            # dry run
 *   bun run scripts/reverse-tag-order.ts --tag=kamiina-botan --apply    # write
 *
 * Options:
 *   --tag=SLUG           Tag slug to reorder (default: kamiina-botan)
 *   --recent-days=N      Exclude GIFs newer than N days (default: 14)
 *   --apply              Actually write changes (otherwise dry run)
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const match = process.argv.find((a) => a.startsWith(prefix))
  return match ? match.slice(prefix.length) : undefined
}

async function main() {
  const tagSlug = getArg('tag') || 'kamiina-botan'
  const recentDays = parseInt(getArg('recent-days') || '14', 10)
  const apply = process.argv.includes('--apply')

  const cutoff = new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000)

  console.log(`\n🔄 Reverse tag order`)
  console.log(`   tag:          ${tagSlug}`)
  console.log(`   recent-days:  ${recentDays} (excluding GIFs newer than ${cutoff.toISOString()})`)
  console.log(`   mode:         ${apply ? 'APPLY (writing)' : 'DRY RUN (no writes)'}\n`)

  const tag = await prisma.tag.findUnique({ where: { slug: tagSlug } })
  if (!tag) {
    console.error(`❌ Tag "${tagSlug}" not found.`)
    process.exit(1)
  }

  // Eligible GIFs: tagged, older than the cutoff, ordered oldest -> newest.
  const gifs = await prisma.gif.findMany({
    where: {
      createdAt: { lt: cutoff },
      tags: { some: { tagId: tag.id } },
    },
    select: { id: true, slug: true, title: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  if (gifs.length < 2) {
    console.log(`Nothing to do — found ${gifs.length} eligible GIF(s).`)
    return
  }

  // Reversed timestamp assignment: oldest GIF gets the newest timestamp, etc.
  const timestamps = gifs.map((g) => g.createdAt)
  const updates = gifs.map((gif, i) => ({
    id: gif.id,
    slug: gif.slug,
    from: gif.createdAt,
    to: timestamps[timestamps.length - 1 - i],
  }))

  const changed = updates.filter((u) => u.from.getTime() !== u.to.getTime())
  console.log(`Eligible GIFs: ${gifs.length}. Timestamps to change: ${changed.length}\n`)

  for (const u of changed.slice(0, 10)) {
    console.log(`  ${u.slug}: ${u.from.toISOString()} -> ${u.to.toISOString()}`)
  }
  if (changed.length > 10) console.log(`  ... and ${changed.length - 10} more`)

  if (!apply) {
    console.log(`\nDry run complete. Re-run with --apply to write these changes.`)
    return
  }

  // updatedAt is @updatedAt so it will bump; we intentionally only reorder createdAt.
  await prisma.$transaction(
    changed.map((u) =>
      prisma.gif.update({
        where: { id: u.id },
        data: { createdAt: u.to },
      })
    )
  )

  console.log(`\n✅ Updated ${changed.length} GIF(s).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
