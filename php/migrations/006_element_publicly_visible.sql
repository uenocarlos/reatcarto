-- Visibilidade do elemento em mapas publicados (galeria pública).
-- true = aparece no mapa público; false = só no mapa do dono.
ALTER TABLE map_elements
    ADD COLUMN IF NOT EXISTS is_publicly_visible BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS map_elements_map_publicly_visible_idx
    ON map_elements (map_id)
    WHERE is_publicly_visible = true;
