DELIMITER //

CREATE PROCEDURE validate_and_canonicalize_usernames()
BEGIN
    IF EXISTS (
        SELECT 1
        FROM app_user
        WHERE LOWER(TRIM(username)) NOT REGEXP '^[a-z0-9][a-z0-9._-]{2,49}$'
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Username migration blocked: invalid username values require manual remediation.';
    END IF;

    IF EXISTS (
        SELECT canonical_username
        FROM (
            SELECT LOWER(TRIM(username)) AS canonical_username
            FROM app_user
        ) AS canonical_usernames
        GROUP BY canonical_username
        HAVING COUNT(*) > 1
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Username migration blocked: canonical username collision requires manual remediation.';
    END IF;

    UPDATE app_user
    SET username = LOWER(TRIM(username))
    WHERE username <> LOWER(TRIM(username));
END //

DELIMITER ;

CALL validate_and_canonicalize_usernames();
DROP PROCEDURE validate_and_canonicalize_usernames;
