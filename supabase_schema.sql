-- Schéma Supabase pour « Le collègue »
-- Régénéré à partir de la base de production réelle (information_schema).
-- Source de vérité : ce fichier doit refléter exactement les tables Supabase.

-- ── carnet : métadonnées et analyses du Carnet, une ligne par personne ──
CREATE TABLE IF NOT EXISTS public.carnet (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personal_id TEXT NOT NULL UNIQUE,
    plan TEXT,
    lien_data JSONB,
    affect_data JSONB,
    elan_data JSONB,
    matrice_data JSONB,
    lueurs JSONB,
    songes JSONB,
    serpentin_state JSONB,
    prismes_unlocked TEXT[],
    last_sync TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ── cartes : les fragments, une carte par conversation ──
CREATE TABLE IF NOT EXISTS public.cartes (
    id TEXT PRIMARY KEY,
    personal_id TEXT NOT NULL,
    fragment TEXT,
    deplacement TEXT,
    direction TEXT,
    texture_relationnelle TEXT,
    sphere TEXT,
    emotion TEXT,
    prisme TEXT,
    date TIMESTAMPTZ,
    image_url TEXT,
    user_note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ── eclats : requêtes d'Éclat, avec instantanés des couches du Carnet ──
CREATE TABLE IF NOT EXISTS public.eclats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personal_id TEXT,
    type TEXT,
    request_text TEXT,
    matrice_snapshot JSONB,
    elan_snapshot JSONB,
    affect_snapshot JSONB,
    lien_snapshot JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ── sessions : enregistrements de conversation ──
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personal_id TEXT,
    started_at TIMESTAMPTZ DEFAULT now(),
    ended_at TIMESTAMPTZ,
    step_reached INTEGER,
    messages JSONB,
    reflection_card JSONB
);

-- ── feedbacks : retours des personnes ──
CREATE TABLE IF NOT EXISTS public.feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personal_id TEXT,
    content TEXT,
    rating INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Row Level Security ──
-- Le proxy serveur utilise la Service Key, mais la RLS est activée sur les
-- 5 tables par défense en profondeur. L'isolation se fait par personal_id.

ALTER TABLE public.carnet    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cartes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eclats    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;