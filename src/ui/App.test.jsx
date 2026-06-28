import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App.jsx'

describe('App (écran de configuration)', () => {
  it('monte et affiche la marque', () => {
    render(<App />)
    expect(screen.getByText(/Pyro/i)).toBeInTheDocument()
  })

  it('Valider est désactivé sans zone, et activé après bascule DEV', () => {
    render(<App />)
    const valider = screen.getByRole('button', { name: /Valider/i })
    expect(valider).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'DEV' }))
    expect(valider).toBeEnabled()
  })
})
