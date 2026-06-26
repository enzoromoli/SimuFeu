import './Modal.css';

export default function Modal({ open, title, onClose, onConfirm, confirmLabel, cancelLabel, confirmDanger, children }) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        {title && <h2 className="modal-card__title">{title}</h2>}
        <p className="modal-card__body">{children}</p>
        <div className="modal-card__actions">
          {onConfirm && (
            <button type="button" className="btn-secondary" onClick={onClose}>
              {cancelLabel || 'Annuler'}
            </button>
          )}
          <button
            type="button"
            className={`btn-primary${confirmDanger ? ' btn-primary--danger' : ''}`}
            onClick={onConfirm || onClose}
          >
            {confirmLabel || 'Fermer'}
          </button>
        </div>
      </div>
    </div>
  );
}
