CREATE INDEX IF NOT EXISTS idx_user_skills_skill_id
  ON user_skills(skiil_id);

CREATE INDEX IF NOT EXISTS idx_career_opportuinties_opportunity_id
  ON career_opportunities(opportunity_id);

CREATE INDEX IF NOT EXISTS idx_saved_items_item_id
  ON saved_items(item_id, item_type);