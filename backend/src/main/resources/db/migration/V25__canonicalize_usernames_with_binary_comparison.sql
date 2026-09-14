UPDATE app_user
SET username = LOWER(TRIM(username))
WHERE BINARY username <> BINARY LOWER(TRIM(username));
