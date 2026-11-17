ALTER TABLE evaluations
    ADD COLUMN observer_signed_by INT NULL,
    ADD COLUMN observer_signature_name VARCHAR(100) NULL,
    ADD COLUMN observer_signed_at DATETIME NULL,
    ADD COLUMN observee_signed_by INT NULL,
    ADD COLUMN observee_signature_name VARCHAR(100) NULL,
    ADD COLUMN observee_signed_at DATETIME NULL,
    ADD COLUMN observee_response TEXT NULL,
    ADD CONSTRAINT fk_evaluations_observer_signed_by
        FOREIGN KEY (observer_signed_by) REFERENCES users(id),
    ADD CONSTRAINT fk_evaluations_observee_signed_by
        FOREIGN KEY (observee_signed_by) REFERENCES users(id);
