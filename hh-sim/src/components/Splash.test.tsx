import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Splash, SPLASH_LOGO_SRC } from './Splash'

describe('Splash', () => {
  it('renders the logo, title and dismiss hint', () => {
    render(<Splash onDismiss={vi.fn()} />)
    expect(screen.getByAltText('Logo institucional')).toHaveAttribute(
      'src',
      SPLASH_LOGO_SRC,
    )
    expect(screen.getByText('Potencial de acción de una neurona')).toBeInTheDocument()
    expect(screen.getByText('Pulsa o espera para continuar')).toBeInTheDocument()
  })

  it('dismisses on click', () => {
    const onDismiss = vi.fn()
    render(<Splash onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('dismisses on Enter and Escape', () => {
    const onDismiss = vi.fn()
    render(<Splash onDismiss={onDismiss} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' })
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalledTimes(2)
  })

  it('auto-dismisses after the timeout', () => {
    vi.useFakeTimers()
    try {
      const onDismiss = vi.fn()
      render(<Splash onDismiss={onDismiss} />)
      expect(onDismiss).not.toHaveBeenCalled()
      vi.advanceTimersByTime(2500)
      expect(onDismiss).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
