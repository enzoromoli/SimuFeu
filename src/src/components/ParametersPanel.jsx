import { useState, useEffect } from 'react';
import WindCompass from './WindCompass.jsx';
import { getBeaufort } from '../utils/beaufort.js';
import './ParametersPanel.css';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function FreshnessPill({ lastUpdate }) {
  const ageMin = (Date.now() - lastUpdate.getTime()) / 60_000;
  const { bg, color } = ageMin < 30
    ? { bg: 'rgba(59,109,17,0.2)', color: '#7BC244' }
    : ageMin < 60
    ? { bg: 'rgba(240,120,32,0.2)', color: '#F07820' }
    : { bg: 'rgba(163,45,45,0.2)', color: '#F09595' };
  return (
    <span className="freshness-pill" style={{ background: bg, color }}>
      Mis à jour {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
    </span>
  );
}

export default function ParametersPanel({ params, onChange, zone, nameError = false, nameErrorKey = 0, debugMode = false }) {
  const beaufort = getBeaufort(params.windSpeed);

  const [auto, setAuto] = useState(false);
  const [autoStatus, setAutoStatus] = useState('idle');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (autoStatus !== 'success') return;
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [autoStatus]);

  useEffect(() => {
    if (!auto || !zone) {
      setAutoStatus('idle');
      return;
    }

    setAutoStatus('loading');
    const lat = (zone.bounds.north + zone.bounds.south) / 2;
    const lng = (zone.bounds.east + zone.bounds.west) / 2;
    const controller = new AbortController();

    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kmh&timezone=auto`,
      { signal: controller.signal },
    )
      .then((r) => r.json())
      .then((data) => {
        const c = data.current;
        const speed = Math.round(c.wind_speed_10m);
        const gust = Math.max(Math.round(c.wind_gusts_10m), speed);
        onChange('windDirection', Math.round(c.wind_direction_10m));
        onChange('windSpeed', speed);
        onChange('windGust', gust);
        onChange('temperature', Math.round(c.temperature_2m));
        onChange('humidity', Math.round(c.relative_humidity_2m));
        setAutoStatus('success');
        setLastUpdate(new Date());
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setAutoStatus('error');
      });

    return () => controller.abort();
  }, [auto, zone, onChange, refreshKey]);

  return (
    <section className="panel panel--params">
      <div className="panel__header">
        <h2><span className="step">2</span>Paramètres</h2>
      </div>

      {!zone && !debugMode ? (
        <div className="params-gate">
          <div className="params-gate__icon">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <p className="params-gate__title">Zone requise</p>
          <p className="params-gate__desc">
            Dessinez votre zone d'étude sur la carte pour accéder aux paramètres de simulation.
          </p>
          <span className="params-gate__step">
            <span className="step">1</span>
            Choisissez votre zone sur la carte
          </span>
        </div>
      ) : (
      <form className="params-form" onSubmit={(event) => event.preventDefault()}>

        <fieldset className="form-section">
          <legend>Informations générales</legend>

          <label key={nameErrorKey} className={`field${nameError ? ' field--error' : ''}`}>
            <span className="field__label">
              Nom de la simulation <span className="required">*</span>
            </span>
            <input
              type="text"
              value={params.simName}
              onChange={(event) => onChange('simName', event.target.value)}
              placeholder="Ex. Incendie forêt de Cizay — Été 2026"
              required
            />
            {nameError && (
              <span className="field__error-msg">Veuillez saisir un nom avant de lancer la simulation.</span>
            )}
          </label>

          <label className="field">
            <span className="field__label">Date et heure de la simulation</span>
            <input
              type="datetime-local"
              value={params.simDate}
              onChange={(event) => onChange('simDate', event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field__label">Informations complémentaires</span>
            <textarea
              rows={3}
              value={params.simDescription}
              onChange={(event) => onChange('simDescription', event.target.value)}
              placeholder="Contexte, objectifs, hypothèses particulières…"
            />
          </label>
        </fieldset>

        <button
          type="button"
          className={`auto-data-toggle${auto ? ' is-active' : ''}`}
          onClick={() => setAuto((v) => !v)}
        >
          <span className={`auto-data-switch${auto ? ' on' : ''}`} />
          <span className="auto-data-toggle__info">
            <span className="auto-data-toggle__label">Météo en temps réel</span>
            <span className="auto-data-toggle__sub">Vent · Température · Humidité (Open-Meteo)</span>
          </span>
          {auto && (
            autoStatus === 'success' && lastUpdate ? (
              <FreshnessPill lastUpdate={lastUpdate} />
            ) : (
              <span className={`auto-data-status auto-data-status--${autoStatus}`}>
                {autoStatus === 'loading' && 'Chargement…'}
                {autoStatus === 'error' && 'Indisponible'}
              </span>
            )
          )}
          {auto && zone && autoStatus !== 'loading' && (
            <span
              role="button"
              className="auto-data-refresh"
              title="Actualiser les données météo"
              onClick={(e) => { e.stopPropagation(); setRefreshKey((k) => k + 1); }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </span>
          )}
        </button>

        <fieldset className="form-section">
          <legend>
            Vent
            {auto && <span className="auto-badge">AUTO</span>}
          </legend>

          <div className="wind-layout">
            <WindCompass
              value={params.windDirection}
              onChange={(value) => onChange('windDirection', value)}
              disabled={auto}
            />

            <div className="wind-sliders">
              <label className={`field${auto ? ' field--auto' : ''}`}>
                <span className="field__label">Direction du vent (°)</span>
                <input
                  type="number"
                  min={0}
                  max={359}
                  step={1}
                  value={params.windDirection}
                  disabled={auto}
                  onChange={(event) => {
                    const raw = Number(event.target.value);
                    if (Number.isNaN(raw)) return;
                    onChange('windDirection', ((Math.round(raw) % 360) + 360) % 360);
                  }}
                />
              </label>

              <label className={`field field--slider${auto ? ' field--auto' : ''}`}>
                <span className="field__label">
                  Vitesse moyenne
                  <span className="field__value">
                    <input
                      type="number"
                      className="value-input"
                      min={0}
                      max={120}
                      step={1}
                      value={params.windSpeed}
                      disabled={auto}
                      onChange={(event) => {
                        const raw = Number(event.target.value);
                        if (Number.isNaN(raw)) return;
                        const speed = clamp(raw, 0, 120);
                        onChange('windSpeed', speed);
                        if (params.windGust < speed) onChange('windGust', speed);
                      }}
                    />
                    <span className="field__unit">km/h</span>
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={120}
                  step={1}
                  value={params.windSpeed}
                  disabled={auto}
                  onChange={(event) => {
                    const speed = Number(event.target.value);
                    onChange('windSpeed', speed);
                    if (params.windGust < speed) onChange('windGust', speed);
                  }}
                />
              </label>

              <label className={`field field--slider${auto ? ' field--auto' : ''}`}>
                <span className="field__label">
                  Rafales
                  <span className="field__value">
                    <input
                      type="number"
                      className="value-input"
                      min={0}
                      max={160}
                      step={1}
                      value={params.windGust}
                      disabled={auto}
                      onChange={(event) => {
                        const raw = Number(event.target.value);
                        if (Number.isNaN(raw)) return;
                        onChange('windGust', Math.max(clamp(raw, 0, 160), params.windSpeed));
                      }}
                    />
                    <span className="field__unit">km/h</span>
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={160}
                  step={1}
                  value={params.windGust}
                  disabled={auto}
                  onChange={(event) => onChange('windGust', Math.max(Number(event.target.value), params.windSpeed))}
                />
              </label>

              <div className={`beaufort beaufort--${beaufort.level}`}>
                <span className="beaufort__scale">Force {beaufort.force}</span>
                <span className="beaufort__label">{beaufort.label}</span>
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset className="form-section">
          <legend>
            Conditions environnementales
            {auto && <span className="auto-badge">AUTO</span>}
          </legend>

          <label className={`field field--slider${auto ? ' field--auto' : ''}`}>
            <span className="field__label">
              Température
              <span className="field__value">
                <input
                  type="number"
                  className="value-input"
                  min={-10}
                  max={45}
                  step={1}
                  value={params.temperature}
                  disabled={auto}
                  onChange={(event) => {
                    const raw = Number(event.target.value);
                    if (Number.isNaN(raw)) return;
                    onChange('temperature', clamp(raw, -10, 45));
                  }}
                />
                <span className="field__unit">°C</span>
              </span>
            </span>
            <input
              type="range"
              min={-10}
              max={45}
              step={1}
              value={params.temperature}
              disabled={auto}
              onChange={(event) => onChange('temperature', Number(event.target.value))}
            />
            <div className="slider-minmax"><span>−10 °C</span><span>45 °C</span></div>
          </label>

          <label className={`field field--slider${auto ? ' field--auto' : ''}`}>
            <span className="field__label">
              Humidité de l'air
              <span className="field__value">
                <input
                  type="number"
                  className="value-input"
                  min={0}
                  max={100}
                  step={1}
                  value={params.humidity}
                  disabled={auto}
                  onChange={(event) => {
                    const raw = Number(event.target.value);
                    if (Number.isNaN(raw)) return;
                    onChange('humidity', clamp(raw, 0, 100));
                  }}
                />
                <span className="field__unit">%</span>
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={params.humidity}
              disabled={auto}
              onChange={(event) => onChange('humidity', Number(event.target.value))}
            />
            <div className="slider-minmax"><span>0 %</span><span>100 %</span></div>
          </label>

          <label className="field field--slider">
            <span className="field__label">
              Humidité du combustible
              <span className="field__value">
                <input
                  type="number"
                  className="value-input"
                  min={0}
                  max={50}
                  step={1}
                  value={params.fuelMoisture}
                  onChange={(event) => {
                    const raw = Number(event.target.value);
                    if (Number.isNaN(raw)) return;
                    onChange('fuelMoisture', clamp(raw, 0, 50));
                  }}
                />
                <span className="field__unit">%</span>
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={params.fuelMoisture}
              onChange={(event) => onChange('fuelMoisture', Number(event.target.value))}
            />
            <div className="slider-minmax"><span>0 %</span><span>50 %</span></div>
          </label>
        </fieldset>
      </form>
      )}
    </section>
  );
}
