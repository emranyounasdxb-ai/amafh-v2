import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { ChoiceField } from './choice-field'

afterEach(cleanup)
const options = [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }, { value: 'c', label: 'Gamma' }]

test('combobox filters and selects with keyboard', () => {
  const change = vi.fn()
  render(<ChoiceField label="Choose item" options={options} value="" onValueChange={change} />)
  const input = screen.getByRole('combobox', { name: 'Choose item' })
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'bet' } })
  expect(screen.queryByRole('option', { name: 'Alpha' })).toBeNull()
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(change).toHaveBeenCalledWith('b')
})

test('multi-select removes selected options and reports no results', () => {
  const change = vi.fn()
  render(<ChoiceField mode="multi-select" label="Choose items" options={options} value={['a', 'b']} onValueChange={change} />)
  const input = screen.getByRole('combobox', { name: 'Choose items' })
  expect((input as HTMLInputElement).value).toBe('Alpha, Beta')
  fireEvent.focus(input)
  fireEvent.click(screen.getByRole('option', { name: 'Alpha' }))
  expect(change).toHaveBeenCalledWith(['b'])
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'nothing' } })
  expect(screen.getByText('No results found.')).toBeTruthy()
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(input.getAttribute('aria-expanded')).toBe('false')
})
