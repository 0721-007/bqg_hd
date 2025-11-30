-- 内容类型表
CREATE TABLE content_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    metadata_schema JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE contents (
    id SERIAL PRIMARY KEY,
    content_type_id INTEGER REFERENCES content_types(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    cover_image VARCHAR(500),
    metadata JSONB,
    status VARCHAR(20) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chapters (
    id SERIAL PRIMARY KEY,
    content_id INTEGER REFERENCES contents(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    content_data JSONB,
    metadata JSONB,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(content_id, chapter_number)
);

CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    color VARCHAR(7) DEFAULT '#007bff'
);

CREATE TABLE content_tags (
    content_id INTEGER REFERENCES contents(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (content_id, tag_id)
);

CREATE INDEX idx_contents_type ON contents(content_type_id);
CREATE INDEX idx_contents_status ON contents(status);
CREATE INDEX idx_chapters_content ON chapters(content_id);
CREATE INDEX idx_chapters_number ON chapters(chapter_number);

INSERT INTO content_types (name, display_name, description, metadata_schema) VALUES 
('novel', '小说', '文字小说内容', '{
  "author": {"type": "string", "required": true},
  "genre": {"type": "string", "required": false},
  "total_chapters": {"type": "number", "required": false}
}'),
('comic', '漫画', '图像漫画内容', '{
  "author": {"type": "string", "required": true},
  "artist": {"type": "string", "required": true},
  "total_episodes": {"type": "number", "required": false}
}'),
('audio', '音频', '音频内容', '{
  "narrator": {"type": "string", "required": true},
  "duration": {"type": "number", "required": false},
  "file_format": {"type": "string", "required": false}
}');

INSERT INTO tags (name, color) VALUES 
('玄幻', '#9b59b6'),
('都市', '#3498db'),
('科幻', '#e74c3c'),
('言情', '#e91e63'),
('历史', '#f39c12'),
('悬疑', '#34495e');

