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
-- response_text / answered_at portent la réponse humaine, écrite depuis
-- l'Admin. answered_at nul = demande en attente, renseigné = Éclat répondu.
-- replies : réponses de la personne (tableau {text, at}). replies_closed :
-- l'admin a clôturé la possibilité de répondre.
CREATE TABLE IF NOT EXISTS public.eclats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personal_id TEXT,
    type TEXT,
    request_text TEXT,
    matrice_snapshot JSONB,
    elan_snapshot JSONB,
    affect_snapshot JSONB,
    lien_snapshot JSONB,
    response_text TEXT,
    answered_at TIMESTAMPTZ,
    replies JSONB DEFAULT '[]'::jsonb,
    replies_closed BOOLEAN DEFAULT false,
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
    reflection_card JSONB,
    status TEXT,                -- "abandoned" si l'onglet se ferme en pleine conversation
    user_message_count INTEGER  -- nb de messages utilisateur ; distingue "ouvert sans rien dire" (0) d'un abandon
);

-- ── feedbacks : retours libres des personnes (+ réponse éventuelle) ──
CREATE TABLE IF NOT EXISTS public.feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personal_id TEXT,
    message TEXT,
    response_text TEXT,
    answered_at TIMESTAMPTZ,
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