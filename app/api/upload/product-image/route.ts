import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { uploadFile } from '@/lib/blob-upload'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

export async function POST(request: NextRequest) {
  try {
    // Admin check
    const session = await auth()
    if (!session?.user || !isAdmin(session.user.email, (session.user as Record<string, unknown>).isAdmin as boolean | undefined)) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ message: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { message: 'Invalid file type. Please upload an image (JPEG, PNG, or WebP)' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      )
    }

    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/heic': 'heic',
      'image/heif': 'heif',
    }
    const extension = mimeToExt[file.type] || 'jpg'

    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 8)
    const filename = `shop-products/product-${timestamp}-${randomString}.${extension}`

    const blob = await uploadFile(file, filename)

    return NextResponse.json({
      success: true,
      url: blob.url,
    })
  } catch (error) {
    console.error('Error uploading product image:', error)
    return NextResponse.json(
      { message: 'Failed to upload image' },
      { status: 500 }
    )
  }
}
