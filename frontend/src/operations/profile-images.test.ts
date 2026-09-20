import { expect, test } from 'vitest'
import { validateProfileImage } from './profile-images'

test('rejects unsupported and oversized avatar or banner files before upload', async () => {
  await expect(validateProfileImage(new File(['plain'], 'avatar.txt', { type: 'text/plain' }))).rejects.toThrow('PNG, JPEG or WebP')
  await expect(validateProfileImage(new File([new Uint8Array(1_048_577)], 'banner.png', { type: 'image/png' }))).rejects.toThrow('1 MB or smaller')
})
