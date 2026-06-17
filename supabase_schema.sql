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
    deplacement_type TEXT,      -- catégorie du geste intérieur (décentrement, nomination, mise à distance, approfondissement, appropriation, relâchement, reliement) ; agrège pour le signal (geste récurrent + lecture par l'absence)
    direction TEXT,
    direction_type TEXT,        -- catégorie de la direction (décision, mise en pause, acceptation, clarification, ouverture relationnelle, vigilance, question ouverte) ; agrège pour le signal de récurrence
    texture_relationnelle TEXT,
    sphere TEXT,
    emotion TEXT,
    prisme TEXT,
    date TIMESTAMPTZ,
    image_url TEXT,
    user_note TEXT,
    miroir TEXT,                -- texte chiffré côté serveur, aligné avec les autres champs sensibles de cartes (cf. ENCRYPTED_FIELDS)
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
    validated_steps JSONB,      -- index d'étapes validées [0..4] ; sert à repérer l'endroit de blocage récurrent (forward-only)
    messages JSONB CHECK (messages IS NULL OR messages = '[]'::jsonb), -- garantie DB : jamais de contenu de conversation, seulement vide
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

-- ── epicentre_members : appartenance aux Épicentres (communautés privées) ──
-- Un Épicentre est une communauté privée rejointe par code partagé (QR/lien).
-- Une ligne = une personne membre d'un épicentre. label : nom affiché de
-- l'épicentre (porté à la création, recopié aux membres suivants).
-- La contrainte UNIQUE (epicentre_code, personal_id) garantit l'unicité de
-- l'adhésion et rend effectif l'upsert merge-duplicates du handler de jonction.
-- Cette table N'EST PAS dans TABLE_COLUMNS : inaccessible par le chemin sb_*
-- du front, uniquement par les handlers serveur dédiés (epicentre_create /
-- join / leave / mine / climate), tous gardés par verifyAccess.
CREATE TABLE IF NOT EXISTS public.epicentre_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    epicentre_code TEXT NOT NULL,
    personal_id TEXT NOT NULL,
    label TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (epicentre_code, personal_id)
);

-- Lookup des épicentres d'une personne (handler epicentre_mine).
CREATE INDEX IF NOT EXISTS idx_epicentre_members_personal
  ON public.epicentre_members (personal_id);

-- ── access : contrôle d'accès par personal_id (code à 6 chiffres) ──
-- code_hash : HMAC(personal_id + code, ACCESS_PEPPER) — jamais le code en clair.
-- failed_attempts / locked_until : verrou anti-brute-force, géré côté serveur.
-- Cette table N'EST PAS dans TABLE_COLUMNS : inaccessible par le chemin sb_*
-- du front, uniquement par les handlers serveur dédiés (account_create / verify).
CREATE TABLE IF NOT EXISTS public.access (
    personal_id TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Row Level Security ──
-- ATTENTION : le proxy serveur utilise la Service Key, qui CONTOURNE la RLS.
-- Tant qu'aucune policy n'est définie, la RLS activée ci-dessous ne protège
-- donc PAS le chemin applicatif normal — ce n'est pas une « défense en
-- profondeur » effective. L'isolation réelle des données repose entièrement
-- sur le contrôle d'accès côté serveur (handler sb_read de server.ts) et sur
-- l'imprévisibilité du personal_id.
-- La RLS n'apporte une protection que si la clé `anon` venait à être exposée
-- ET que des policies sont écrites. Si l'isolation par RLS est souhaitée,
-- ajouter des policies explicites et ne plus tout faire transiter par la
-- Service Key.

ALTER TABLE public.carnet    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cartes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eclats    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epicentre_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access    ENABLE ROW LEVEL SECURITY;