ALTER TABLE observation_requests
    MODIFY status ENUM(
        'generated', 'approved', 'pending', 'accepted', 'declined',
        'confirmed', 'canceled', 'not_selected', 'expired'
    ) NOT NULL DEFAULT 'approved';
