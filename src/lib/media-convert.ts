import { spawn } from 'child_process'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

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
