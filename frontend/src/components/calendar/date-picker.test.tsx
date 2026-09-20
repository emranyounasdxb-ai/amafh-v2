import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { DatePicker } from './date-picker'

afterEach(cleanup)

describe('DatePicker', () => {
  test('keeps display format separate from the ISO value and rejects impossible dates', () => {
    const onValueChange = vi.fn()
    render(<DatePicker label="Start date" value="2026-09-19" onValueChange={onValueChange} />)
    const input = screen.getByRole('textbox', { name: 'Start date' })
    expect((input as HTMLInputElement).value).toBe('19 Sep 2026')
    fireEvent.change(input, { target: { value: '31 Feb 2026' } })
    fireEvent.blur(input)
    expect(screen.getByText('Use DD MMM YYYY within the allowed range.')).toBeTruthy()
    expect(onValueChange).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '20 Sep 2026' } })
    fireEvent.blur(input)
    expect(onValueChange).toHaveBeenLastCalledWith('2026-09-20')
  })

  test('selects a calendar day and honors date limits', () => {
    const onValueChange = vi.fn()
    render(<DatePicker label="Start date" value="2026-09-19" min="2026-09-18" max="2026-09-20" onValueChange={onValueChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Choose start date' }))
    expect(screen.getByRole('button', { name: 'Thursday, September 17, 2026' }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Sunday, September 20, 2026' }))
    expect(onValueChange).toHaveBeenLastCalledWith('2026-09-20')
    expect(screen.queryByRole('group', { name: 'Start date calendar' })).toBeNull()
  })
})
