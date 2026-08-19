-- The up migration moved pre-existing unverified phone_number values only from
-- non-anonymous users without an email, password, or linked provider. Subsequent
-- account changes and newly staged values make that original population
-- indistinguishable at rollback time, so this best-effort inverse restores only
-- the oldest claimant for each number and only when no user currently owns that
-- phone_number.
WITH restoration_candidates AS (
    SELECT
        id,
        new_phone_number,
        row_number() OVER (
            PARTITION BY new_phone_number
            ORDER BY created_at, id
        ) AS claimant_order
    FROM auth.users
    WHERE phone_number IS NULL
      AND new_phone_number IS NOT NULL
),
restorable AS (
    SELECT candidate.id, candidate.new_phone_number
    FROM restoration_candidates candidate
    WHERE candidate.claimant_order = 1
      AND NOT EXISTS (
          SELECT 1
          FROM auth.users owner
          WHERE owner.phone_number = candidate.new_phone_number
      )
)
UPDATE auth.users target
SET phone_number = restorable.new_phone_number,
    new_phone_number = NULL
FROM restorable
WHERE target.id = restorable.id;
