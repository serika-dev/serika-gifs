import { PrismaClient } from '@prisma/client'
import imageSize from 'image-size'

const prisma = new PrismaClient()

async function fixDimensions() {
  console.log('Fetching GIFs with missing dimensions...')
  
  const gifs = await prisma.gif.findMany({
    where: {
      OR: [
        { width: 0 },
        { height: 0 },
      ],
    },
  })

  console.log(`Found ${gifs.length} GIFs to fix`)

  let fixed = 0
  let failed = 0

  for (const gif of gifs) {
    try {
      console.log(`Processing: ${gif.slug} - ${gif.url}`)
      
      // Fetch the image from the URL
      const response = await fetch(gif.url)
      if (!response.ok) {
        console.error(`  Failed to fetch: ${response.status}`)
        failed++
        continue
      }

      const buffer = Buffer.from(await response.arrayBuffer())
      const dimensions = imageSize(buffer)

      if (dimensions.width && dimensions.height) {
        await prisma.gif.update({
          where: { id: gif.id },
          data: {
            width: dimensions.width,
            height: dimensions.height,
          },
        })
        console.log(`  Fixed: ${dimensions.width}×${dimensions.height}`)
        fixed++
      } else {
        console.error(`  Could not determine dimensions`)
        failed++
      }
    } catch (error) {
      console.error(`  Error:`, error)
      failed++
    }
  }

  console.log(`\nDone! Fixed: ${fixed}, Failed: ${failed}`)
}

fixDimensions()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
