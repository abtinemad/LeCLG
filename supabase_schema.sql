-- SQL to initialize the Supabase database for 'Le collègue'

-- Table for carnet metadata and analysis
CREATE TABLE IF NOT EXISTS public.carnet (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personal_id TEXT NOT NULL UNIQUE,
    lien_data JSONB,
    affect_data JSONB,
    elan_data JSONB,
    matrice_data JSONB,
    lueurs JSONB,
    annotations JSONB,
    serpentin_state JSONB,
    prismes_unlocked TEXT[],
    last_sync TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table for individual reflection cards (Fragments)
CREATE TABLE IF NOT EXISTS public.cartes (
    id TEXT PRIMARY KEY,
    personal_id TEXT NOT NULL,
    fragment TEXT,
    deplacement TEXT,
    direction TEXT,
    texture_relationnelle TEXT,
    sphere TEXT,
    prisme TEXT,
    date TIMESTAMPTZ,
    user_note TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table for Eclats requests
CREATE TABLE IF NOT EXISTS public.eclats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personal_id TEXT,
    request_text TEXT,
    matrice_snapshot JSONB,
    elan_snapshot JSONB,
    affect_snapshot JSONB,
    lien_snapshot JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table for user sessions/chat records (Optional but used in some parts of the app)
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personal_id TEXT,
    fragment TEXT,
    deplacement TEXT,
    direction TEXT,
    prisme TEXT,
    date TIMESTAMPTZ DEFAULT now(),
    reflection_card JSONB,
    data JSONB
);

-- Table for feedback
CREATE TABLE IF NOT EXISTS public.feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personal_id TEXT,
    content TEXT,
    rating INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS (Row Level Security) - though the proxy uses a Service Key, 
-- it's good practice to have policies or keep it simple for now as requested.
-- For this app's architecture, we assume the server proxy handles security.

ALTER TABLE public.cartes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cartes_isolation_policy ON public.cartes;
CREATE POLICY cartes_isolation_policy ON public.cartes
    FOR ALL
    TO anon, authenticated
    USING (personal_id = COALESCE(nullif(current_setting('app.personal_id', true), ''), current_setting('request.headers', true)::json->>'x-personal-id'))
    WITH CHECK (personal_id = COALESCE(nullif(current_setting('app.personal_id', true), ''), current_setting('request.headers', true)::json->>'x-personal-id'));

ALTER TABLE public.carnet ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS carnet_isolation_policy ON public.carnet;
CREATE POLICY carnet_isolation_policy ON public.carnet
    FOR ALL
    TO anon, authenticated
    USING (personal_id = COALESCE(nullif(current_setting('app.personal_id', true), ''), current_setting('request.headers', true)::json->>'x-personal-id'))
    WITH CHECK (personal_id = COALESCE(nullif(current_setting('app.personal_id', true), ''), current_setting('request.headers', true)::json->>'x-personal-id'));
