import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ParametersPanel from './ParametersPanel'

const baseParams = {
  simName: '',
  simDate: '2026-06-28T12:00',
  simDescription: '',
  windDirection: 45,
  windSpeed: 15,
  windGust: 30,
  temperature: 22,
  humidity: 40,
  vegetation: 'conifere',
  fuelMoisture: 12,
}

function renderPanel(overrides = {}) {
  const onChange = vi.fn()
  // debugMode=true affiche le formulaire sans exiger de zone dessinée.
  render(
    <ParametersPanel
      params={baseParams}
      onChange={onChange}
      zone={null}
      debugMode
      {...overrides}
    />,
  )
  return { onChange }
}

describe('ParametersPanel', () => {
  it('saisir le nom déclenche onChange(simName)', () => {
    const { onChange } = renderPanel()
    const input = screen.getByPlaceholderText(/Incendie forêt/i)
    fireEvent.change(input, { target: { value: 'Test feu' } })
    expect(onChange).toHaveBeenCalledWith('simName', 'Test feu')
  })

  it('affiche le message d’erreur quand nameError est vrai', () => {
    renderPanel({ nameError: true })
    expect(screen.getByText(/Veuillez saisir un nom/i)).toBeInTheDocument()
  })

  it('borne la vitesse du vent à 120 km/h (clamp haut)', () => {
    const { onChange } = renderPanel()
    const windSpeed = document.querySelector('input[type="number"][max="120"]')
    fireEvent.change(windSpeed, { target: { value: '999' } })
    expect(onChange).toHaveBeenCalledWith('windSpeed', 120)
  })

  it('borne l’humidité du combustible à 50 % (clamp haut)', () => {
    const { onChange } = renderPanel()
    const fuel = document.querySelector('input[type="number"][max="50"]')
    fireEvent.change(fuel, { target: { value: '200' } })
    expect(onChange).toHaveBeenCalledWith('fuelMoisture', 50)
  })

  it('sans zone ni debug, affiche la barrière « Zone requise »', () => {
    const onChange = vi.fn()
    render(<ParametersPanel params={baseParams} onChange={onChange} zone={null} />)
    expect(screen.getByText(/Zone requise/i)).toBeInTheDocument()
  })
})
