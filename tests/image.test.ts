import { imageThumb } from '@/lib/image'

const PUB =
  'https://ref.supabase.co/storage/v1/object/public/media/players/abc/def.jpg'

describe('imageThumb', () => {
  it('reescribe una URL pública de Storage al endpoint de render con parámetros', () => {
    const out = imageThumb(PUB, { width: 96, quality: 65, resize: 'cover' })!
    expect(out).toContain('/storage/v1/render/image/public/media/players/abc/def.jpg?')
    expect(out).toContain('width=96')
    expect(out).toContain('quality=65')
    expect(out).toContain('resize=cover')
    expect(out).not.toContain('/object/public/')
  })

  it('redondea el ancho y usa calidad 65 por defecto', () => {
    const out = imageThumb(PUB, { width: 71.6 })!
    expect(out).toContain('width=72')
    expect(out).toContain('quality=65')
  })

  it('deja intactas las URLs externas o data:', () => {
    expect(imageThumb('https://otro.com/x.jpg', { width: 96 })).toBe('https://otro.com/x.jpg')
    expect(imageThumb('data:image/png;base64,AAAA', { width: 96 })).toBe('data:image/png;base64,AAAA')
  })

  it('devuelve null si no hay URL', () => {
    expect(imageThumb(null, { width: 96 })).toBeNull()
    expect(imageThumb(undefined, { width: 96 })).toBeNull()
  })
})
