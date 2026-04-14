-- PrintOps Database Schema (PostgreSQL)

CREATE TABLE machines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    ip VARCHAR(45) NOT NULL,
    type VARCHAR(50) DEFAULT 'Generic',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE machine_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id UUID REFERENCES machines(id) ON DELETE CASCADE,
    counter INTEGER NOT NULL,
    status VARCHAR(20) CHECK (status IN ('running', 'idle', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE consumables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    cost DECIMAL(10, 2) DEFAULT 0
);

CREATE TABLE machine_consumables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id UUID REFERENCES machines(id) ON DELETE CASCADE,
    consumable_id UUID REFERENCES consumables(id),
    name VARCHAR(100), -- Denormalized for quick access
    level INTEGER CHECK (level >= 0 AND level <= 100),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    machine_id UUID REFERENCES machines(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL, -- printing, waiting, error
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_machine_logs_machine_id ON machine_logs(machine_id);
CREATE INDEX idx_machine_logs_created_at ON machine_logs(created_at);
CREATE INDEX idx_jobs_machine_id ON jobs(machine_id);
