CREATE TABLE IF NOT EXISTS dape_lead_sources (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  contact_id INTEGER,
  source_type VARCHAR(50) CHECK (source_type IN ('whatsapp', 'instagram', 'facebook', 'landing_page', 'radar', 'manual')),
  campaign_name VARCHAR(255),
  utm_source VARCHAR(255),
  utm_medium VARCHAR(255),
  utm_campaign VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dape_deals (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  contact_id INTEGER,
  title VARCHAR(255) NOT NULL,
  value DECIMAL(15, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
  stage VARCHAR(50) DEFAULT 'prospecting' CHECK (stage IN ('prospecting', 'qualification', 'proposal', 'negotiation', 'closing')),
  expected_close_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
