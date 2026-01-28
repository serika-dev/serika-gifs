import { spawn } from 'child_process'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

export interface VideoDimensions {
  width: number
  height: number
  duration?: number
}

/**
 * Get video dimensions and duration using ffprobe
 */
export async function getVideoDimensions(videoBuffer: Buffer, slug: string): Promise<VideoDimensions> {
  const tempDir = join(tmpdir(), 'serika-gifs')
  await mkdir(tempDir, { recursive: true })
  
  const videoPath = join(tempDir, `${slug}-${Date.now()}-probe.mp4`)
  
  try {
    await writeFile(videoPath, videoBuffer)
    
    return await new Promise<VideoDimensions>((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height,duration',
        '-of', 'json',
        videoPath
      ])
      
      let stdout = ''
      let stderr = ''
      ffprobe.stdout.on('data', (data) => { stdout += data.toString() })
      ffprobe.stderr.on('data', (data) => { stderr += data.toString() })
      
      ffprobe.on('close', (code) => {
        if (code === 0) {
          try {
            const parsed = JSON.parse(stdout)
            const stream = parsed.streams?.[0]
            resolve({
              width: stream?.width || 0,
              height: stream?.height || 0,
              duration: stream?.duration ? parseFloat(stream.duration) : undefined,
            })
          } catch {
            reject(new Error(`Failed to parse ffprobe output: ${stdout}`))
          }
        } else {
          reject(new Error(`ffprobe exited with ${code}: ${stderr}`))
        }
      })
      
      ffprobe.on('error', reject)
    })
  } finally {
    try { await unlink(videoPath) } catch {}
  }
}

/**
 * Generate a thumbnail (first frame) from a video using ffmpeg
 */
export async function generateThumbnailFromVideo(videoBuffer: Buffer, slug: string): Promise<Buffer> {
  const tempDir = join(tmpdir(), 'serika-gifs')
  await mkdir(tempDir, { recursive: true })
  
  const videoPath = join(tempDir, `${slug}-${Date.now()}-thumb.mp4`)
  const thumbnailPath = join(tempDir, `${slug}-${Date.now()}-thumb.webp`)
  
  try {
    await writeFile(videoPath, videoBuffer)
    
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', videoPath,
        '-vframes', '1',          // Only one frame
        '-vf', 'scale=320:-1',    // Scale to 320px width
        '-q:v', '80',             // Quality
        thumbnailPath
      ])
      
      let stderr = ''
      ffmpeg.stderr.on('data', (data) => { stderr += data.toString() })
      
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg thumbnail exited with ${code}: ${stderr.slice(-200)}`))
      })
      
      ffmpeg.on('error', reject)
    })
    
    const thumbnailBuffer = await readFile(thumbnailPath)
    return thumbnailBuffer
  } finally {
    try { await unlink(videoPath) } catch {}
    try { await unlink(thumbnailPath) } catch {}
  }
}

/**
 * Generate GIF from MP4 using ffmpeg
 */
export async function generateGifFromMp4(mp4Buffer: Buffer, slug: string): Promise<Buffer> {
  const tempDir = join(tmpdir(), 'serika-gifs')
  await mkdir(tempDir, { recursive: true })
  
  const mp4Path = join(tempDir, `${slug}-${Date.now()}.mp4`)
  const palettePath = join(tempDir, `${slug}-${Date.now()}-palette.png`)
  const gifPath = join(tempDir, `${slug}-${Date.now()}.gif`)
  
  try {
    await writeFile(mp4Path, mp4Buffer)
    
    // First pass: generate palette for better quality
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', mp4Path,
        '-vf', 'fps=15,scale=480:-1:flags=lanczos,palettegen=stats_mode=diff',
        palettePath
      ])
      
      let stderr = ''
      ffmpeg.stderr.on('data', (data) => { stderr += data.toString() })
      
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg palette exited with ${code}: ${stderr.slice(-200)}`))
      })
      
      ffmpeg.on('error', reject)
    })
    
    // Second pass: generate GIF using palette
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', mp4Path,
        '-i', palettePath,
        '-lavfi', 'fps=15,scale=480:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
        '-loop', '0',
        gifPath
      ])
      
      let stderr = ''
      ffmpeg.stderr.on('data', (data) => { stderr += data.toString() })
      
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg gif exited with ${code}: ${stderr.slice(-200)}`))
      })
      
      ffmpeg.on('error', reject)
    })
    
    const gifBuffer = await readFile(gifPath)
    return gifBuffer
  } finally {
    try { await unlink(mp4Path) } catch {}
    try { await unlink(palettePath) } catch {}
    try { await unlink(gifPath) } catch {}
  }
}

/**
 * Generate MP4 from GIF using ffmpeg
 */
export async function generateMp4FromGif(gifBuffer: Buffer, slug: string): Promise<Buffer> {
  const tempDir = join(tmpdir(), 'serika-gifs')
  await mkdir(tempDir, { recursive: true })
  
  const gifPath = join(tempDir, `${slug}-${Date.now()}.gif`)
  const mp4Path = join(tempDir, `${slug}-${Date.now()}.mp4`)
  
  try {
    await writeFile(gifPath, gifBuffer)
    
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', gifPath,
        '-movflags', 'faststart',
        '-pix_fmt', 'yuv420p',
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',  // Ensure even dimensions
        '-c:v', 'libx264',
        '-crf', '23',
        '-preset', 'fast',
        '-an',  // No audio
        mp4Path
      ])
      
      let stderr = ''
      ffmpeg.stderr.on('data', (data) => { stderr += data.toString() })
      
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg exited with ${code}: ${stderr.slice(-200)}`))
      })
      
      ffmpeg.on('error', reject)
    })
    
    const mp4Buffer = await readFile(mp4Path)
    return mp4Buffer
  } finally {
    // Cleanup temp files
    try { await unlink(gifPath) } catch {}
    try { await unlink(mp4Path) } catch {}
  }
}

/**
 * Generate WebM from GIF using ffmpeg
 */
export async function generateWebmFromGif(gifBuffer: Buffer, slug: string): Promise<Buffer> {
  const tempDir = join(tmpdir(), 'serika-gifs')
  await mkdir(tempDir, { recursive: true })
  
  const gifPath = join(tempDir, `${slug}-${Date.now()}.gif`)
  const webmPath = join(tempDir, `${slug}-${Date.now()}.webm`)
  
  try {
    await writeFile(gifPath, gifBuffer)
    
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', gifPath,
        '-c:v', 'libvpx-vp9',
        '-crf', '18',           // High quality (0-63, lower = better)
        '-b:v', '2M',           // Target bitrate 2Mbps
        '-maxrate', '3M',       // Max bitrate
        '-bufsize', '4M',       // Buffer size
        '-deadline', 'good',    // Better quality encoding
        '-cpu-used', '2',       // Slower = better quality (0-5)
        '-row-mt', '1',         // Multi-threaded row encoding
        '-an',                  // No audio
        webmPath
      ])
      
      let stderr = ''
      ffmpeg.stderr.on('data', (data) => { stderr += data.toString() })
      
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg exited with ${code}: ${stderr.slice(-200)}`))
      })
      
      ffmpeg.on('error', reject)
    })
    
    const webmBuffer = await readFile(webmPath)
    return webmBuffer
  } finally {
    // Cleanup temp files
    try { await unlink(gifPath) } catch {}
    try { await unlink(webmPath) } catch {}
  }
}

/**
 * Generate WebM from MP4 using ffmpeg
 */
export async function generateWebmFromMp4(mp4Buffer: Buffer, slug: string): Promise<Buffer> {
  const tempDir = join(tmpdir(), 'serika-gifs')
  await mkdir(tempDir, { recursive: true })
  
  const mp4Path = join(tempDir, `${slug}-${Date.now()}.mp4`)
  const webmPath = join(tempDir, `${slug}-${Date.now()}.webm`)
  
  try {
    await writeFile(mp4Path, mp4Buffer)
    
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', mp4Path,
        '-c:v', 'libvpx-vp9',
        '-crf', '18',
        '-b:v', '2M',
        '-maxrate', '3M',
        '-bufsize', '4M',
        '-deadline', 'good',
        '-cpu-used', '2',
        '-row-mt', '1',
        '-an',
        webmPath
      ])
      
      let stderr = ''
      ffmpeg.stderr.on('data', (data) => { stderr += data.toString() })
      
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg exited with ${code}: ${stderr.slice(-200)}`))
      })
      
      ffmpeg.on('error', reject)
    })
    
    const webmBuffer = await readFile(webmPath)
    return webmBuffer
  } finally {
    try { await unlink(mp4Path) } catch {}
    try { await unlink(webmPath) } catch {}
  }
}
