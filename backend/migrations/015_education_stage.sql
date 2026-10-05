-- 015_education_stage.sql
-- Add education_stage to existing education JSONB arrays to migrate existing users

UPDATE user_profiles
SET education = (
    SELECT jsonb_agg(
        CASE 
            WHEN (elem->>'level') = 'Working Professional' THEN 
                elem || '{"education_stage": "WORKING_PROFESSIONAL"}'::jsonb
            WHEN (elem->>'level') IN ('12th / Higher Secondary', '12th') THEN 
                elem || '{"education_stage": "SCHOOL_12", "12th_status": "PURSUING"}'::jsonb
            ELSE 
                elem || '{"education_stage": "HIGHER_EDUCATION"}'::jsonb
        END
    )
    FROM jsonb_array_elements(education) AS elem
)
WHERE jsonb_array_length(education) > 0;
