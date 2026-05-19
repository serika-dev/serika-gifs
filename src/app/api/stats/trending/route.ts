import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const now = new Date()
    const todayStart = new Date(now.setHours(0, 0, 0, 0))
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    // GIFs uploaded today
    const trendingToday = await prisma.gif.count({
      where: { createdAt: { gte: todayStart } }
    })
    
    // Total views across all GIFs
    const viewsAggr = await prisma.gif.aggregate({
      _sum: { views: true }
    })
    
    // Favorites today
    const favoritesToday = await prisma.favorite.count({
      where: { createdAt: { gte: todayStart } }
    })
    
    // Growth this week vs last week
    const thisWeekUploads = await prisma.gif.count({
      where: { createdAt: { gte: weekStart } }
    })
    const lastWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000)
    const lastWeekUploads = await prisma.gif.count({
      where: { createdAt: { gte: lastWeekStart, lt: weekStart } }
    })
    
    let growth = 0
    if (lastWeekUploads > 0) {
      growth = Math.round(((thisWeekUploads - lastWeekUploads) / lastWeekUploads) * 100)
    } else if (thisWeekUploads > 0) {
      growth = 100
    }
    
    return NextResponse.json({
      trendingToday,
      totalViews: viewsAggr._sum.views || 0,
      favoritesToday,
      growth: `${growth > 0 ? '+' : ''}${growth}%`
    })
  } catch (error) {
    console.error('Error fetching trending stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trending stats' },
      { status: 500 }
    )
  }
}
